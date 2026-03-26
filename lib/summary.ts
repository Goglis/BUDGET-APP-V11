import type { GelirRow, OzelRow, UberRow } from "./types";

export interface MonthBucket {
  ayEtiket: string;
  gelir: number;
  gider: number;
}

function parseIsoDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfSixMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const aylar = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ];
  return `${aylar[(m ?? 1) - 1]} ${y}`;
}

export function buildSixMonthSummary(
  uber: UberRow[],
  ozel: OzelRow[],
  gelir: GelirRow[]
): MonthBucket[] {
  const start = startOfSixMonthsAgo();
  const map = new Map<string, { gelir: number; gider: number }>();

  const add = (key: string, gelirAmt: number, giderAmt: number) => {
    const cur = map.get(key) ?? { gelir: 0, gider: 0 };
    cur.gelir += gelirAmt;
    cur.gider += giderAmt;
    map.set(key, cur);
  };

  for (const u of uber) {
    const d = parseIsoDate(u.tarih);
    if (!d || d < start) continue;
    const key = monthKey(d);
    if (u.tur === "Gelir") add(key, u.tutar, 0);
    else add(key, 0, u.tutar);
  }
  for (const o of ozel) {
    const d = parseIsoDate(o.tarih);
    if (!d || d < start) continue;
    add(monthKey(d), 0, o.tutar);
  }
  for (const g of gelir) {
    const d = parseIsoDate(g.tarih);
    if (!d || d < start) continue;
    add(monthKey(d), g.tutar, 0);
  }

  const keys = [...map.keys()].sort();
  return keys.map((k) => ({
    ayEtiket: monthLabel(k),
    gelir: map.get(k)!.gelir,
    gider: map.get(k)!.gider,
  }));
}
