import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";

export async function GET() {
  return NextResponse.json(CATEGORIES);
}