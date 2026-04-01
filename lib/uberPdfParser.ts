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
    patterns: [
      /para\s*.{0,12}adeleri\s*.{0,12}giderler/i,
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

function amountFromWindow(parts: string[]): number | null {
  const joined = parts.filter(Boolean).join(" ");
  let m = parseMoney(joined);
  if (m != null && m !== 0) return Math.abs(m);
  for (const p of parts) {
    if (!p) continue;
    m = parseMoney(p);
    if (m != null && m !== 0) return Math.abs(m);
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
  const bulundu = new Set<string>();
  const n = sectionLines.length;

  for (let i = 0; i < n; i++) {
    const p = [
      sectionLines[i] ?? "",
      sectionLines[i + 1] ?? "",
      sectionLines[i + 2] ?? "",
    ];
    const birlesik = p.filter(Boolean).join(" ");

    for (const tanim of OZET_SATIR_TANIMLARI) {
      if (bulundu.has(tanim.id)) continue;
      if (!tanim.patterns.some((re) => re.test(birlesik))) continue;

      const tutar = amountFromWindow(p);
      if (tutar == null) continue;

      bulundu.add(tanim.id);
      kalemler.push({
        tur: tanim.tur,
        tutar,
        aciklama: tanim.kisaAd,
      });
      break;
    }
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
