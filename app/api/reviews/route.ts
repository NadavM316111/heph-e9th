import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";

async function setup() {
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_reviews (" +
    "id SERIAL PRIMARY KEY, " +
    "order_item_id INTEGER NOT NULL, " +
    "buyer_email TEXT NOT NULL, " +
    "seller_email TEXT NOT NULL, " +
    "rating INTEGER NOT NULL, " +
    "body TEXT, " +
    "created_at TIMESTAMPTZ DEFAULT now())"
  );
  // Unique constraint: one review per order item
  await q(
    "CREATE UNIQUE INDEX IF NOT EXISTS " + P + "_reviews_order_item_unique ON " + P + "_reviews (order_item_id)"
  );
}

export async function GET(req: NextRequest) {
  await setup();
  const seller_email = req.nextUrl.searchParams.get("seller_email");
  if (!seller_email) {
    return NextResponse.json({ error: "seller_email required" }, { status: 400 });
  }
  const rows = await q(
    "SELECT * FROM " + P + "_reviews WHERE seller_email = $1 ORDER BY created_at DESC",
    [seller_email]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await setup();
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { order_item_id, seller_email, rating, body } = await req.json();
  if (!order_item_id || !seller_email || !rating) {
    return NextResponse.json({ error: "order_item_id, seller_email and rating are required" }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  // Verify this buyer owns this order item
  const items = await q(
    "SELECT id FROM " + P + "_order_items WHERE id = $1 AND buyer_email = $2",
    [order_item_id, email]
  );
  if (!items.length) {
    return NextResponse.json({ error: "Order item not found or not yours" }, { status: 403 });
  }

  // Check for duplicate
  const existing = await q(
    "SELECT id FROM " + P + "_reviews WHERE order_item_id = $1",
    [order_item_id]
  );
  if (existing.length) {
    return NextResponse.json({ error: "You have already reviewed this item" }, { status: 409 });
  }

  await q(
    "INSERT INTO " + P + "_reviews (order_item_id, buyer_email, seller_email, rating, body) VALUES ($1, $2, $3, $4, $5)",
    [order_item_id, email, seller_email, rating, body || ""]
  );
  return NextResponse.json({ ok: true });
}