import type { FlowType } from "./types";

export interface ParsedUberLine {
  tur: FlowType;
  tutar: number;
  aciklama: string;
  hamSatir: string;
}

const INCOME_KEYS =
  /earnings?|kazanç|gelir|trip\s*fares?|fare|payment\s*received|net\s*earnings|brüt|brut|toplam\s*kazanç|total\s*earnings/i;
const EXPENSE_KEYS =
  /fee|ücret|ucret|service\s*fee|komisyon|charge|masraf|gider|deduction|tax|vergi|adjustment|refund\s*to\s*rider|promotion/i;

function parseMoney(s: string): number | null {
  const normalized = s
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const turkish = normalized.match(
    /(?:₺|TRY|TL|try|tl)\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i
  );
  if (turkish) {
    const n = turkish[1].replace(/\./g, "").replace(",", ".");
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : null;
  }
  const us = normalized.match(/\$?\s*([\d,]+\.\d{2})\b/);
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

function lineIntent(line: string): FlowType | null {
  const t = line.trim();
  if (INCOME_KEYS.test(t) && !/^[-–—]/.test(t)) return "Gelir";
  if (EXPENSE_KEYS.test(t)) return "Gider";
  return null;
}

/**
 * Uber haftalık özet PDF metninden satır satır tutar çıkarır (AI kullanmaz).
 */
export function parseUberWeeklyPdfText(fullText: string): ParsedUberLine[] {
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
