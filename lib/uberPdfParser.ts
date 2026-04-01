import type { FlowType } from "./types";

export interface ParsedUberLine {
  tur: FlowType;
  tutar: number;
  aciklama: string;
  hamSatir: string;
}

export interface UberOzetKalem {
  tur: FlowType;
  tutar: number;
  aciklama: string;
}

export interface UberPdfOzet {
  gelirToplam: number;
  giderToplam: number;
  kalemler: UberOzetKalem[];
  uyari?: string;
}

const INCOME_KEYS =
  /earnings?|kazanç|gelir|trip\s*fares?|fare|payment\s*received|net\s*earnings|brüt|brut|toplam\s*kazanç|total\s*earnings/i;
const EXPENSE_KEYS =
  /fee|ücret|ucret|service\s*fee|komisyon|charge|masraf|gider|deduction|tax|vergi|adjustment|refund\s*to\s*rider|promotion/i;

/** Haftalık özet bölümü başlığı (TR / EN) */
const HAFTALIK_OZET_BASLIK =
  /haftalık\s*özet|haftalik\s*ozet|weekly\s*summary/i;

/**
 * Uber haftalık ekstre: yalnızca bu etiketli satırlar (tüm PDF taranmaz).
 * Gelir = Kazançlarınız + Önceki haftalardaki etkinlikler
 * Gider = Para İadeleri ve Giderler (siz alıyorsunuz, devlete ödenecek taraf)
 * Başlangıç bakiyesi toplama dahil değil.
 */
const OZET_SATIR_TANIMLARI: {
  id: string;
  kisaAd: string;
  tur: FlowType;
  patterns: RegExp[];
}[] = [
  {
    id: "paraIadeGider",
    kisaAd: "Para İadeleri ve Giderler",
    tur: "Gider",
    /** Gevşek eşleşme kaldırıldı. \u0130 = Türkçe İ (PDF metninde sık). */
    patterns: [
      /para\s+(?:\u0130|I|i|ı|İ)\s*adeleri\s+ve\s+giderler/i,
      /refunds?\s+and\s+expenses/i,
    ],
  },
  {
    id: "oncekiHafta",
    kisaAd: "Önceki haftalardaki etkinlikler",
    tur: "Gelir",
    patterns: [
      /önceki\s+haftalardaki\s+etkinlikler/i,
      /onceki\s+haftalardaki\s+etkinlikler/i,
      /activities\s+from\s+previous\s+weeks?/i,
    ],
  },
  {
    id: "kazanclariniz",
    kisaAd: "Kazançlarınız",
    tur: "Gelir",
    patterns: [/kazançlarınız/i, /kazanclariniz/i, /your\s+earnings/i],
  },
];

function parseMoney(s: string): number | null {
  const normalized = s
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ca = normalized.match(
    /CA\s*\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i
  );
  if (ca) {
    const n = ca[1].replace(/\./g, "").replace(",", ".");
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  }

  const turkish = normalized.match(
    /(?:₺|TRY|TL|try|tl)\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i
  );
  if (turkish) {
    const n = turkish[1].replace(/\./g, "").replace(",", ".");
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  }

  const us = normalized.match(/\$\s*([\d,]+\.\d{2})\b/);
  if (us) {
    const v = parseFloat(us[1].replace(/,/g, ""));
    return Number.isFinite(v) ? v : null;
  }

  const plain = normalized.match(/(-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\b/);
  if (plain) {
    const raw = plain[1];
    const v = parseFloat(
      raw.includes(",") && raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "")
    );
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

/** Etiket eşleştikten sonra yalnızca aynı satırın geri kalanından tutar (yanlış ilk eşleşmeyi önler). */
function tutarEtiketSonrasi(block: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(block);
    if (!m || m.index === undefined) continue;
    const tail = block.slice(m.index + m[0].length);
    const v = parseMoney(tail);
    if (v != null && v !== 0) return Math.abs(v);
  }
  return null;
}

function tekOzetiBul(
  sectionLines: string[],
  tanim: (typeof OZET_SATIR_TANIMLARI)[0]
): UberOzetKalem | null {
  const n = sectionLines.length;
  for (let i = 0; i < n; i++) {
    const L0 = sectionLines[i] ?? "";
    const L1 = sectionLines[i + 1] ?? "";
    const ikiSatir = `${L0} ${L1}`.trim();

    const matchedBlock = tanim.patterns.some((re) => re.test(L0))
      ? L0
      : tanim.patterns.some((re) => re.test(ikiSatir))
        ? ikiSatir
        : null;
    if (!matchedBlock) continue;

    let tutar = tutarEtiketSonrasi(matchedBlock, tanim.patterns);
    if (tutar == null && L1.trim() !== "") {
      tutar = parseMoney(L1);
      if (tutar != null) tutar = Math.abs(tutar);
    }
    if (tutar != null && tutar > 0) {
      return {
        tur: tanim.tur,
        tutar,
        aciklama: tanim.kisaAd,
      };
    }
  }
  return null;
}

function satirlariAyikla(fullText: string): string[] {
  return fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * Yalnızca "Haftalık Özet" civarındaki satırlar; bulunamazsa tüm metinde sadece etiket eşlemesi (yine tüm sayfa sayıları toplanmaz).
 */
function haftalikOzetSatirlari(lines: string[]): string[] {
  const idx = lines.findIndex((l) => HAFTALIK_OZET_BASLIK.test(l));
  if (idx < 0) return lines;
  return lines.slice(idx, idx + 50);
}

function cikarHaftalikOzetKalemleri(sectionLines: string[]): UberOzetKalem[] {
  const kalemler: UberOzetKalem[] = [];
  for (const tanim of OZET_SATIR_TANIMLARI) {
    const k = tekOzetiBul(sectionLines, tanim);
    if (k) kalemler.push(k);
  }
  return kalemler;
}

/**
 * Sadece Uber "Haftalık Özet" satırları: Kazançlarınız, Önceki hafta, Para iadeleri+giderler.
 */
export function summarizeUberWeeklyPdf(fullText: string): UberPdfOzet {
  const lines = satirlariAyikla(fullText);
  const bolum = haftalikOzetSatirlari(lines);
  const kalemler = cikarHaftalikOzetKalemleri(bolum);

  const gelirToplam = kalemler
    .filter((k) => k.tur === "Gelir")
    .reduce((s, k) => s + k.tutar, 0);
  const giderToplam = kalemler
    .filter((k) => k.tur === "Gider")
    .reduce((s, k) => s + k.tutar, 0);

  let uyari: string | undefined;
  if (kalemler.length === 0) {
    uyari =
      "Haftalık Özet bölümünde Kazançlarınız / Önceki hafta / Para İadeleri ve Giderler satırları bulunamadı. PDF dilini veya dosyayı kontrol edin; tutarları aşağıdan elle girebilirsiniz.";
  } else if (kalemler.length < OZET_SATIR_TANIMLARI.length) {
    const eksik = OZET_SATIR_TANIMLARI.filter(
      (t) => !kalemler.some((k) => k.aciklama === t.kisaAd)
    ).map((t) => t.kisaAd);
    uyari = `Bazı özet satırları okunamadı: ${eksik.join(", ")}. Eksik tutarı tablodan ekleyin.`;
  }

  return { gelirToplam, giderToplam, kalemler, uyari };
}

function lineIntent(line: string): FlowType | null {
  const t = line.trim();
  if (INCOME_KEYS.test(t) && !/^[-–—]/.test(t)) return "Gelir";
  if (EXPENSE_KEYS.test(t)) return "Gider";
  return null;
}

export function parseUberWeeklyPdfText(fullText: string): ParsedUberLine[] {
  const lines = satirlariAyikla(fullText);
  const out: ParsedUberLine[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const intent = lineIntent(line);
    const amount = parseMoney(line);
    if (amount == null || amount === 0) continue;

    let tur: FlowType = intent ?? "Gelir";
    if (intent === null) {
      const prev = lines[i - 1] ?? "";
      const next = lines[i + 1] ?? "";
      if (lineIntent(prev) === "Gider" || lineIntent(next) === "Gider")
        tur = "Gider";
      else if (lineIntent(prev) === "Gelir" || lineIntent(next) === "Gelir")
        tur = "Gelir";
      else tur = amount < 0 ? "Gider" : "Gelir";
    }

    const key = `${tur}|${amount}|${line.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      tur,
      tutar: Math.abs(amount),
      aciklama: line.slice(0, 200),
      hamSatir: line,
    });
  }

  return out;
}
