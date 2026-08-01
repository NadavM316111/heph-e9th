import { NextRequest, NextResponse } from "next/server";
import { q, P, ensureTable } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
export const runtime = "nodejs";

async function setup() {
  await ensureTable(
    "CREATE TABLE IF NOT EXISTS " + P + "_pw_resets (id SERIAL PRIMARY KEY, email TEXT NOT NULL, token TEXT NOT NULL, used BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now())"
  );
}

function hashPw(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(pw, salt, 64).toString("hex");
}

function verifyPw(pw: string, stored: string) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 2) return false;
  const a = Buffer.from(parts[1], "hex");
  const b = scryptSync(pw, parts[0], 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST { mode: "request", email } → { token } (in production you'd email this)
// POST { mode: "reset", email, token, password } → { ok }
export async function POST(req: NextRequest) {
  await setup();
  const body = await req.json().catch(() => ({}));
  const mode = body.mode;

  if (mode === "request") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

    const users = await q("SELECT id FROM " + P + "_users WHERE email = $1", [email]);
    if (!users.length) {
      // Don't reveal whether account exists — return a fake token shape
      return NextResponse.json({ token: "NO_ACCOUNT" });
    }

    // Invalidate old tokens for this email
    await q("UPDATE " + P + "_pw_resets SET used = true WHERE email = $1 AND used = false", [email]);

    const token = randomBytes(4).toString("hex").toUpperCase(); // 8-char hex token, easy to type
    await q("INSERT INTO " + P + "_pw_resets (email, token) VALUES ($1, $2)", [email, token]);

    return NextResponse.json({ token });
  }

  if (mode === "reset") {
    const email = String(body.email || "").trim().toLowerCase();
    const token = String(body.token || "").trim().toUpperCase();
    const password = String(body.password || "");

    if (!email || !token || !password) {
      return NextResponse.json({ error: "Email, token and new password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Token valid for 15 minutes
    const rows = await q(
      "SELECT id FROM " + P + "_pw_resets WHERE email = $1 AND token = $2 AND used = false AND created_at > now() - interval '15 minutes'",
      [email, token]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Invalid or expired token. Please request a new one." }, { status: 400 });
    }

    await q("UPDATE " + P + "_pw_resets SET used = true WHERE email = $1 AND token = $2", [email, token]);
    await q("UPDATE " + P + "_users SET pass = $1 WHERE email = $2", [hashPw(password), email]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}