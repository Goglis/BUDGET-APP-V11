export type SheetTab = "Uber" | "Ozel" | "Gelir";

export type FlowType = "Gelir" | "Gider";

export type EntrySource = "fis" | "pdf" | "manuel";

export interface UberRow {
  id: string;
  tarih: string;
  tur: FlowType;
  tutar: number;
  aciklama: string;
  kaynak: EntrySource;
  uberMasrafi: "E" | "H";
}

export interface OzelRow {
  id: string;
  tarih: string;
  tutar: number;
  kategori: string;
  aciklama: string;
  kaynak: EntrySource;
  uberMi: "E" | "H";
}

export interface GelirRow {
  id: string;
  tarih: string;
  tutar: number;
  aciklama: string;
  kaynak: EntrySource;
}

export type AnyRow = UberRow | OzelRow | GelirRow;
