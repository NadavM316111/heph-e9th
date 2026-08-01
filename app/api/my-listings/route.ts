import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import { CATEGORIES } from "@/lib/categories";

async function ensureTables() {
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_listings (" +
    "id SERIAL PRIMARY KEY," +
    "seller_email TEXT NOT NULL," +
    "title TEXT NOT NULL," +
    "description TEXT," +
    "category_id INTEGER NOT NULL," +
    "condition TEXT NOT NULL," +
    "price_cents INTEGER NOT NULL," +
    "quantity INTEGER NOT NULL DEFAULT 1," +
    "status TEXT NOT NULL DEFAULT 'active'," +
    "created_at TIMESTAMPTZ DEFAULT now()" +
    ")"
  );
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_listing_photos (" +
    "id SERIAL PRIMARY KEY," +
    "listing_id INTEGER NOT NULL," +
    "seller_email TEXT NOT NULL," +
    "url TEXT NOT NULL," +
    "display_order INTEGER NOT NULL DEFAULT 0," +
    "created_at TIMESTAMPTZ DEFAULT now()" +
    ")"
  );
}

export async function GET(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();

  const rows = await q(
    "SELECT * FROM " + P + "_listings WHERE seller_email = $1 AND status != $2 ORDER BY created_at DESC",
    [email, "removed"]
  );

  const listingIds = (rows as Array<{ id: number }>).map((r) => r.id);
  let photoMap: Record<number, string[]> = {};

  if (listingIds.length > 0) {
    const photos = await q(
      "SELECT listing_id, url FROM " + P + "_listing_photos WHERE seller_email = $1 AND listing_id = ANY($2) ORDER BY display_order ASC",
      [email, listingIds]
    );
    for (const p of photos as Array<{ listing_id: number; url: string }>) {
      if (!photoMap[p.listing_id]) photoMap[p.listing_id] = [];
      photoMap[p.listing_id].push(p.url);
    }
  }

  const result = (rows as Array<{
    id: number;
    seller_email: string;
    title: string;
    description: string;
    category_id: number;
    condition: string;
    price_cents: number;
    quantity: number;
    status: string;
    created_at: string;
  }>).map((r) => {
    const cat = CATEGORIES.find((c) => c.id === r.category_id);
    return {
      ...r,
      photos: photoMap[r.id] || [],
      category_name: cat?.name || "Other",
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();

  const body = await req.json();
  const { title, description, category_id, condition, price_cents, quantity, photos } = body;

  if (!title || !category_id || !condition || !price_cents) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const rows = await q(
    "INSERT INTO " + P + "_listings (seller_email, title, description, category_id, condition, price_cents, quantity, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING id",
    [email, title, description || "", category_id, condition, price_cents, quantity || 1]
  );

  const listing = (rows as Array<{ id: number }>)[0];
  if (!listing) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  if (Array.isArray(photos) && photos.length > 0) {
    for (let i = 0; i < photos.length; i++) {
      await q(
        "INSERT INTO " + P + "_listing_photos (listing_id, seller_email, url, display_order) VALUES ($1,$2,$3,$4)",
        [listing.id, email, photos[i], i]
      );
    }
  }

  return NextResponse.json({ id: listing.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();

  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const allowed = ["active", "paused", "removed"];
  if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  await q(
    "UPDATE " + P + "_listings SET status = $1 WHERE id = $2 AND seller_email = $3",
    [status, id, email]
  );

  return NextResponse.json({ ok: true });
}