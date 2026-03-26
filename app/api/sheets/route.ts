import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { appendRow, deleteRowById, readAllData } from "@/lib/googleSheets";
import type { SheetTab } from "@/lib/types";

export const runtime = "nodejs";

function isTab(s: string): s is SheetTab {
  return s === "Uber" || s === "Ozel" || s === "Gelir";
}

export async function GET() {
  try {
    const raw = await readAllData();
    const uber = raw.uber.map((r) => ({
      id: r[0] ?? "",
      tarih: r[1] ?? "",
      tur: (r[2] as "Gelir" | "Gider") ?? "Gider",
      tutar: parseFloat(String(r[3] ?? 0).replace(",", ".")) || 0,
      aciklama: r[4] ?? "",
      kaynak: (r[5] as "fis" | "pdf" | "manuel") ?? "manuel",
      uberMasrafi: (r[6] as "E" | "H") ?? "H",
    }));
    const ozel = raw.ozel.map((r) => ({
      id: r[0] ?? "",
      tarih: r[1] ?? "",
      tutar: parseFloat(String(r[2] ?? 0).replace(",", ".")) || 0,
      kategori: r[3] ?? "",
      aciklama: r[4] ?? "",
      kaynak: (r[5] as "fis" | "pdf" | "manuel") ?? "manuel",
      uberMi: (r[6] as "E" | "H") ?? "H",
    }));
    const gelir = raw.gelir.map((r) => ({
      id: r[0] ?? "",
      tarih: r[1] ?? "",
      tutar: parseFloat(String(r[2] ?? 0).replace(",", ".")) || 0,
      aciklama: r[3] ?? "",
      kaynak: (r[4] as "fis" | "pdf" | "manuel") ?? "manuel",
    }));
    return NextResponse.json({ uber, ozel, gelir });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tab = body.tab as string;
    if (!isTab(tab)) {
      return NextResponse.json({ error: "Geçersiz sekme" }, { status: 400 });
    }
    const id = typeof body.id === "string" ? body.id : uuidv4();

    if (tab === "Uber") {
      const { tarih, tur, tutar, aciklama, kaynak, uberMasrafi } = body;
      await appendRow("Uber", [
        id,
        tarih,
        tur,
        tutar,
        aciklama ?? "",
        kaynak ?? "manuel",
        uberMasrafi ?? "H",
      ]);
    } else if (tab === "Ozel") {
      const { tarih, tutar, kategori, aciklama, kaynak, uberMi } = body;
      await appendRow("Ozel", [
        id,
        tarih,
        tutar,
        kategori ?? "",
        aciklama ?? "",
        kaynak ?? "manuel",
        uberMi ?? "H",
      ]);
    } else {
      const { tarih, tutar, aciklama, kaynak } = body;
      await appendRow("Gelir", [
        id,
        tarih,
        tutar,
        aciklama ?? "",
        kaynak ?? "manuel",
      ]);
    }
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const tab = body.tab as string;
    const id = body.id as string;
    if (!isTab(tab) || !id) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }
    await deleteRowById(tab, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
