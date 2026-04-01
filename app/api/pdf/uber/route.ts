import { NextResponse } from "next/server";
import { summarizeUberWeeklyPdf } from "@/lib/uberPdfParser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "PDF dosyası gerekli" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mod = await import("pdf-parse");
    const pdfParse = mod.default ?? mod;
    const data = await pdfParse(buf);
    const text = typeof data.text === "string" ? data.text : "";
    const ozet = summarizeUberWeeklyPdf(text);
    return NextResponse.json({
      ozet,
      karakterSayisi: text.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF okunamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
