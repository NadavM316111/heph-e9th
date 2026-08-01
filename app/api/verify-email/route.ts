import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";
import { randomBytes } from "crypto";
export const runtime = "nodejs";

const TABLE = "CREATE TABLE IF NOT EXISTS " + P + "_email_verifications (id SERIAL PRIMARY KEY, email TEXT NOT NULL, token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now())";

function makeToken(): string {
  // 6 uppercase alphanumeric characters
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

export async function POST(req: NextRequest) {
  await ensureTable(TABLE);

  // Also ensure the email_verified column exists on users
  await q("ALTER TABLE " + P + "_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false");

  const body = await req.json().catch(() => ({}));
  const mode = body.mode as string;

  // ── send ──────────────────────────────────────────────────────────────────
  if (mode === "send") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

    // Invalidate old tokens for this email
    await q("UPDATE " + P + "_email_verifications SET used = true WHERE email = $1 AND used = false", [email]);

    const token = makeToken();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await q(
      "INSERT INTO " + P + "_email_verifications (email, token, expires_at) VALUES ($1, $2, $3)",
      [email, token, expires.toISOString()]
    );

    // In production you'd email the token. In dev we return it directly.
    return NextResponse.json({ ok: true, token });
  }

  // ── verify ────────────────────────────────────────────────────────────────
  if (mode === "verify") {
    const email = String(body.email || "").trim().toLowerCase();
    const token = String(body.token || "").trim().toUpperCase();
    if (!email || !token) return NextResponse.json({ error: "Email and code required." }, { status: 400 });

    const rows = await q(
      "SELECT id FROM " + P + "_email_verifications WHERE email = $1 AND token = $2 AND used = false AND expires_at > now()",
      [email, token]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    // Mark token used
    await q("UPDATE " + P + "_email_verifications SET used = true WHERE id = $1", [rows[0].id]);

    // Mark user verified
    await q("UPDATE " + P + "_users SET email_verified = true WHERE email = $1", [email]);

    return NextResponse.json({ ok: true });
  }

  // ── status (optional, for session-protected check) ────────────────────────
  if (mode === "status") {
    const sessionEmail = getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const rows = await q("SELECT email_verified FROM " + P + "_users WHERE email = $1", [sessionEmail]);
    const verified = rows.length === 0 || rows[0].email_verified === null || rows[0].email_verified === true;
    return NextResponse.json({ verified });
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}