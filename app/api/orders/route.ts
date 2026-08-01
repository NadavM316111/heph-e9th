import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
export const runtime = "nodejs";

async function ensure() {
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_orders (" +
    "id SERIAL PRIMARY KEY, " +
    "buyer_email TEXT NOT NULL, " +
    "status TEXT NOT NULL DEFAULT 'pending', " +
    "total_cents INTEGER NOT NULL, " +
    "shipping_address JSONB, " +
    "stripe_session_id TEXT, " +
    "created_at TIMESTAMPTZ DEFAULT now())"
  );
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_order_items (" +
    "id SERIAL PRIMARY KEY, " +
    "order_id INTEGER NOT NULL, " +
    "listing_id INTEGER NOT NULL, " +
    "buyer_email TEXT NOT NULL, " +
    "seller_email TEXT NOT NULL, " +
    "quantity INTEGER NOT NULL DEFAULT 1, " +
    "unit_price_cents INTEGER NOT NULL, " +
    "title_snapshot TEXT NOT NULL, " +
    "status TEXT NOT NULL DEFAULT 'pending', " +
    "created_at TIMESTAMPTZ DEFAULT now())"
  );
}

// GET — buyer sees their orders; ?role=seller returns incoming orders for seller
export async function GET(req: NextRequest) {
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await ensure();

  const role = req.nextUrl.searchParams.get("role");

  if (role === "seller") {
    // Return order_items where seller_email = me, joined with order for address
    const rows = await q(
      "SELECT oi.id, oi.order_id, oi.listing_id, oi.buyer_email, oi.quantity, " +
      "oi.unit_price_cents, oi.title_snapshot, oi.status, oi.created_at, " +
      "o.shipping_address, o.stripe_session_id " +
      "FROM " + P + "_order_items oi " +
      "JOIN " + P + "_orders o ON o.id = oi.order_id " +
      "WHERE oi.seller_email = $1 " +
      "ORDER BY oi.created_at DESC LIMIT 100",
      [email]
    );
    return NextResponse.json(rows);
  }

  // Buyer: their orders with items
  const orders = await q(
    "SELECT o.id, o.status, o.total_cents, o.shipping_address, o.stripe_session_id, o.created_at " +
    "FROM " + P + "_orders o WHERE o.buyer_email = $1 ORDER BY o.created_at DESC LIMIT 50",
    [email]
  );
  if (orders.length === 0) return NextResponse.json([]);

  const orderIds = orders.map((o: { id: number }) => o.id);
  const items = await q(
    "SELECT oi.order_id, oi.listing_id, oi.seller_email, oi.quantity, " +
    "oi.unit_price_cents, oi.title_snapshot, oi.status " +
    "FROM " + P + "_order_items oi WHERE oi.buyer_email = $1 AND oi.order_id = ANY($2)",
    [email, orderIds]
  );

  const itemsByOrder: Record<number, typeof items.rows> = {};
  for (const item of items.rows) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  }

  return NextResponse.json(
    orders.map((o: { id: number; status: string; total_cents: number; shipping_address: object; stripe_session_id: string; created_at: string }) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }))
  );
}

// POST — create order + items before redirecting to Stripe
export async function POST(req: NextRequest) {
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await ensure();

  const body = await req.json().catch(() => ({}));
  const { shipping_address, items, stripe_session_id } = body;

  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: "No items" }, { status: 400 });

  const total = items.reduce(
    (s: number, i: { unit_price_cents: number; quantity: number }) => s + i.unit_price_cents * i.quantity, 0
  );

  const orderRows = await q(
    "INSERT INTO " + P + "_orders (buyer_email, status, total_cents, shipping_address, stripe_session_id) " +
    "VALUES ($1, 'pending', $2, $3, $4) RETURNING id",
    [email, total, JSON.stringify(shipping_address || {}), stripe_session_id || null]
  );
  const orderId = orderRows[0].id;

  for (const item of items) {
    await q(
      "INSERT INTO " + P + "_order_items " +
      "(order_id, listing_id, buyer_email, seller_email, quantity, unit_price_cents, title_snapshot) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        orderId,
        item.listing_id,
        email,
        item.seller_email,
        item.quantity,
        item.unit_price_cents,
        item.title_snapshot,
      ]
    );
  }

  return NextResponse.json({ orderId });
}

// PATCH — mark order paid once Stripe confirms
export async function PATCH(req: NextRequest) {
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await ensure();

  const body = await req.json().catch(() => ({}));
  const { stripe_session_id } = body;
  if (!stripe_session_id) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  await q(
    "UPDATE " + P + "_orders SET status = 'paid' WHERE stripe_session_id = $1 AND buyer_email = $2",
    [stripe_session_id, email]
  );
  await q(
    "UPDATE " + P + "_order_items SET status = 'pending' " +
    "WHERE order_id IN (SELECT id FROM " + P + "_orders WHERE stripe_session_id = $1 AND buyer_email = $2)",
    [stripe_session_id, email]
  );
  return NextResponse.json({ ok: true });
}