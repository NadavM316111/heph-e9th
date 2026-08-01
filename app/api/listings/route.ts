import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
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
  await ensureTables();

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");

  let rows: Array<{
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
  }>;

  if (categoryParam) {
    rows = await q(
      "SELECT * FROM " + P + "_listings WHERE status = $1 AND category_id = $2 ORDER BY created_at DESC",
      ["active", parseInt(categoryParam)]
    );
  } else {
    rows = await q(
      "SELECT * FROM " + P + "_listings WHERE status = $1 ORDER BY created_at DESC",
      ["active"]
    );
  }

  const listingIds = rows.map((r) => r.id);
  let photoMap: Record<number, string[]> = {};

  if (listingIds.length > 0) {
    const photos = await q(
      "SELECT listing_id, url FROM " + P + "_listing_photos WHERE listing_id = ANY($1) ORDER BY display_order ASC",
      [listingIds]
    );
    for (const p of photos as Array<{ listing_id: number; url: string }>) {
      if (!photoMap[p.listing_id]) photoMap[p.listing_id] = [];
      photoMap[p.listing_id].push(p.url);
    }
  }

  const result = rows.map((r) => {
    const cat = CATEGORIES.find((c) => c.id === r.category_id);
    return {
      ...r,
      photos: photoMap[r.id] || [],
      category_name: cat?.name || "Other",
    };
  });

  return NextResponse.json(result);
}