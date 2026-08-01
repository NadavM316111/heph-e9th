import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";

export const runtime = "nodejs";

const CREATE =
  "CREATE TABLE IF NOT EXISTS " +
  P +
  "_profiles (id SERIAL PRIMARY KEY, owner_email TEXT UNIQUE NOT NULL, display_name TEXT, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'buyer', created_at TIMESTAMPTZ DEFAULT now())";

export async function GET(req: NextRequest) {
  await ensureTable(CREATE);
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await q(
    "SELECT display_name, avatar_url, role FROM " + P + "_profiles WHERE owner_email = $1",
    [email]
  );
  if (!rows.length) {
    return NextResponse.json({ display_name: "", avatar_url: "", role: "buyer" });
  }
  return NextResponse.json(rows[0]);
}

export async function POST(req: NextRequest) {
  await ensureTable(CREATE);
  const email = getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const display_name = String(body.display_name ?? "").slice(0, 80);
  const avatar_url = String(body.avatar_url ?? "").slice(0, 500);
  const role = body.role === "seller" ? "seller" : "buyer";

  await q(
    "INSERT INTO " + P + "_profiles (owner_email, display_name, avatar_url, role) VALUES ($1,$2,$3,$4) " +
    "ON CONFLICT (owner_email) DO UPDATE SET display_name=$2, avatar_url=$3, role=$4",
    [email, display_name, avatar_url, role]
  );
  return NextResponse.json({ ok: true });
}