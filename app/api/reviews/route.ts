import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";

export const runtime = "nodejs";

const CREATE_REVIEWS =
  "CREATE TABLE IF NOT EXISTS " + P +
  "_reviews (id SERIAL PRIMARY KEY, order_item_id INTEGER NOT NULL UNIQUE, buyer_email TEXT NOT NULL, seller_email TEXT NOT NULL, rating INTEGER NOT NULL, body TEXT, created_at TIMESTAMPTZ DEFAULT now())";

export async function GET(req: NextRequest) {
  await ensureTable(CREATE_REVIEWS);
  const { searchParams } = new URL(req.url);
  const sellerEmail = searchParams.get("seller_email");
  const orderItemId = searchParams.get("order_item_id");

  // Return avg + count for a seller (public)
  if (sellerEmail) {
    const rows = await q(
      "SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as review_count FROM " + P + "_reviews WHERE seller_email = $1",
      [sellerEmail]
    );
    const row = (rows as Array<{ avg_rating: string | null; review_count: string }>)[0];
    return NextResponse.json({
      avg_rating: row.avg_rating ? parseFloat(row.avg_rating) : null,
      review_count: parseInt(row.review_count, 10),
    });
  }

  // Return whether caller has reviewed a specific order item
  if (orderItemId) {
    const email = getSessionEmail(req);
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await q(
      "SELECT id, rating, body FROM " + P + "_reviews WHERE order_item_id = $1 AND buyer_email = $2",
      [parseInt(orderItemId, 10), email]
    );
    return NextResponse.json((rows as unknown[])[0] ?? null);
  }

  return NextResponse.json({ error: "Missing seller_email or order_item_id" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  await ensureTable(CREATE_REVIEWS);
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const order_item_id = parseInt(body.order_item_id, 10);
  const rating = parseInt(body.rating, 10);
  const reviewBody = String(body.body ?? "").slice(0, 2000);

  if (!order_item_id || isNaN(order_item_id)) return NextResponse.json({ error: "Invalid order_item_id" }, { status: 400 });
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });

  // Verify this order item belongs to the buyer and is delivered
  const items = await q(
    "SELECT seller_email, status FROM " + P + "_order_items WHERE id = $1 AND buyer_email = $2",
    [order_item_id, email]
  );
  const item = (items as Array<{ seller_email: string; status: string }>)[0];
  if (!item) return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  if (item.status !== "delivered") return NextResponse.json({ error: "Item must be delivered before reviewing" }, { status: 400 });
  if (item.seller_email === email) return NextResponse.json({ error: "You cannot review yourself" }, { status: 400 });

  // Upsert (one review per order item enforced by UNIQUE)
  await q(
    "INSERT INTO " + P + "_reviews (order_item_id, buyer_email, seller_email, rating, body) VALUES ($1,$2,$3,$4,$5) " +
    "ON CONFLICT (order_item_id) DO UPDATE SET rating=$4, body=$5",
    [order_item_id, email, item.seller_email, rating, reviewBody]
  );
  return NextResponse.json({ ok: true });
}