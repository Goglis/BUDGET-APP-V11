/**
 * Fiş OCR metninden toplam ve tarih çıkarır (kural tabanlı, AI yok).
 */

const TOTAL_PATTERNS = [
  /TOPLAM\s*[:.]?\s*(?:₺|TL|TRY)?\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i,
  /GENEL\s*TOPLAM\s*[:.]?\s*(?:₺|TL|TRY)?\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i,
  /ÖDENECEK\s*TUTAR\s*[:.]?\s*(?:₺|TL|TRY)?\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i,
  /KDV\s*D[İI]L[İI]\s*TOPLAM\s*[:.]?\s*(?:₺|TL|TRY)?\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/i,
  /(?:₺|TL)\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
];

const DATE_PATTERNS = [
  /(\d{2})[./](\d{2})[./](\d{4})/,
  /(\d{4})[./-](\d{2})[./-](\d{2})/,
  /(\d{2})[./](\d{2})[./](\d{2})\b/,
];

function parseTrNumber(raw: string): number | null {
  const n = raw.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

export function extractTotalFromReceiptText(text: string): number | null {
  const upper = text.toUpperCase();
  let best: number | null = null;
  for (const re of TOTAL_PATTERNS) {
    const m = upper.match(re) || text.match(re);
    if (m?.[1]) {
      const v = parseTrNumber(m[1]);
      if (v != null && (best == null || v >= best)) best = v;
    }
  }
  if (best != null) return best;
  const amounts: number[] = [];
  const reAmt =
    /(?:₺|TL|TRY)\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|[\d]+(?:,\d{2})?)/gi;
  let mm;
  const t = text.replace(/\u00a0/g, " ");
  while ((mm = reAmt.exec(t)) !== null) {
    const v = parseTrNumber(mm[1]);
    if (v != null) amounts.push(v);
  }
  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

export function extractDateFromReceiptText(text: string): string | null {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (re === DATE_PATTERNS[0]) {
      const [, d, mo, y] = m;
      return `${y}-${mo}-${d}`;
    }
    if (re === DATE_PATTERNS[1]) {
      const [, y, mo, d] = m;
      return `${y}-${mo}-${d}`;
    }
    if (re === DATE_PATTERNS[2]) {
      const [, d, mo, y2] = m;
      const y = parseInt(y2, 10) < 100 ? `20${y2}` : y2;
      return `${y}-${mo}-${d}`;
    }
  }
  return null;
}
