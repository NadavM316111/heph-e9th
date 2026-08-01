import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
export const runtime = "nodejs";

async function setup() {
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_watched_listings (id SERIAL PRIMARY KEY, buyer_email TEXT NOT NULL, listing_id INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now())"
  );
}

export async function GET(req: NextRequest) {
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const rows = await q(
    "SELECT listing_id FROM " + P + "_watched_listings WHERE buyer_email = $1 ORDER BY created_at DESC",
    [email]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const body = await req.json().catch(() => ({}));
  const listingId = Number(body.listing_id);
  const action: string = body.action;
  if (!listingId || !["watch", "unwatch"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (action === "watch") {
    const existing = await q(
      "SELECT id FROM " + P + "_watched_listings WHERE buyer_email = $1 AND listing_id = $2",
      [email, listingId]
    );
    if (!existing.length) {
      await q(
        "INSERT INTO " + P + "_watched_listings (buyer_email, listing_id) VALUES ($1, $2)",
        [email, listingId]
      );
    }
  } else {
    await q(
      "DELETE FROM " + P + "_watched_listings WHERE buyer_email = $1 AND listing_id = $2",
      [email, listingId]
    );
  }
  return NextResponse.json({ ok: true });
}