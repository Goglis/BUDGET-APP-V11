import { NextResponse } from "next/server";
import { clearAllDataRows } from "@/lib/googleSheets";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearAllDataRows();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Temizlenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
