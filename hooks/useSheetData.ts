"use client";

import { useCallback, useState } from "react";
import type { GelirRow, OzelRow, UberRow } from "@/lib/types";

export interface SheetBundle {
  uber: UberRow[];
  ozel: OzelRow[];
  gelir: GelirRow[];
}

export function useSheetData() {
  const [data, setData] = useState<SheetBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sheets");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Veri alınamadı");
      setData({
        uber: j.uber ?? [],
        ozel: j.ozel ?? [],
        gelir: j.gelir ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh, setError };
}
