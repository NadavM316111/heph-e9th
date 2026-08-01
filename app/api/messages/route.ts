import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";

const CREATE = "CREATE TABLE IF NOT EXISTS " + P + "_messages (" +
  "id SERIAL PRIMARY KEY, " +
  "listing_id INTEGER NOT NULL, " +
  "sender_email TEXT NOT NULL, " +
  "recipient_email TEXT NOT NULL, " +
  "body TEXT NOT NULL, " +
  "created_at TIMESTAMPTZ DEFAULT now()" +
  ")";

export async function GET(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable(CREATE);

  const listingId = req.nextUrl.searchParams.get("listing_id");

  if (listingId) {
    // Return thread for a specific listing — both parties can read
    const rows = await q(
      "SELECT * FROM " + P + "_messages WHERE listing_id = $1 AND (sender_email = $2 OR recipient_email = $3) ORDER BY created_at ASC",
      [Number(listingId), email, email]
    );
    return NextResponse.json(rows);
  }

  // Return all threads where this user is a participant, grouped by listing_id
  // Latest message per thread, deduplicated
  const rows = await q(
    "SELECT DISTINCT ON (listing_id) listing_id, sender_email, recipient_email, body, created_at " +
    "FROM " + P + "_messages " +
    "WHERE sender_email = $1 OR recipient_email = $2 " +
    "ORDER BY listing_id, created_at DESC",
    [email, email]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable(CREATE);

  const { listing_id, recipient_email, body } = await req.json();
  if (!listing_id || !recipient_email || !body || !body.trim()) {
    return NextResponse.json({ error: "listing_id, recipient_email and body are required" }, { status: 400 });
  }
  if (recipient_email === email) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const rows = await q(
    "INSERT INTO " + P + "_messages (listing_id, sender_email, recipient_email, body) VALUES ($1, $2, $3, $4) RETURNING *",
    [Number(listing_id), email, recipient_email, body.trim()]
  );
  return NextResponse.json(rows[0]);
}