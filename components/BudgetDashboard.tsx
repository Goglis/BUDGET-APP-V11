"use client";

import {
  Camera,
  Car,
  Eraser,
  FileUp,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { OZEL_KATEGORILER } from "@/lib/constants";
import { extractDateFromReceiptText, extractTotalFromReceiptText } from "@/lib/receiptParse";
import { buildSixMonthSummary } from "@/lib/summary";
import {
  playExpense,
  playIncome,
  playSuccess,
  playTap,
  playWarn,
  resumeAudio,
} from "@/lib/sound";
import { useSheetData } from "@/hooks/useSheetData";
import { SummaryChart } from "@/components/SummaryChart";
import type { GelirRow, OzelRow, UberRow } from "@/lib/types";
import type { UberPdfOzet } from "@/lib/uberPdfParser";

type Panel = "ozet" | "gelir" | "gider" | "pdf" | "liste";

export function BudgetDashboard() {
  const { data, loading, error, refresh, setError } = useSheetData();
  const [panel, setPanel] = useState<Panel>("ozet");

  const [gelirTutar, setGelirTutar] = useState("");
  const [gelirAciklama, setGelirAciklama] = useState("");
  const [gelirTarih, setGelirTarih] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [giderTutar, setGiderTutar] = useState("");
  const [giderAciklama, setGiderAciklama] = useState("");
  const [giderTarih, setGiderTarih] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [giderKategori, setGiderKategori] = useState("Ev");
  const [uberMasrafGider, setUberMasrafGider] = useState<"E" | "H">("H");

  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [fisTutar, setFisTutar] = useState("");
  const [fisTarih, setFisTarih] = useState("");
  const [fisUber, setFisUber] = useState<"E" | "H">("H");
  const [fisKategori, setFisKategori] = useState("Ev");

  const [pdfUberSoru, setPdfUberSoru] = useState<"E" | "H">("E");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfOzet, setPdfOzet] = useState<UberPdfOzet | null>(null);
  const [pdfGelirStr, setPdfGelirStr] = useState("");
  const [pdfGiderStr, setPdfGiderStr] = useState("");
  const [pdfTarih, setPdfTarih] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const buckets = useMemo(() => {
    if (!data) return [];
    return buildSixMonthSummary(data.uber, data.ozel, data.gelir);
  }, [data]);

  const toplam6Ay = useMemo(() => {
    return buckets.reduce(
      (a, b) => ({ gelir: a.gelir + b.gelir, gider: a.gider + b.gider }),
      { gelir: 0, gider: 0 }
    );
  }, [buckets]);

  const goPanel = useCallback(async (p: Panel) => {
    await resumeAudio();
    playTap();
    setPanel(p);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const temizleHersey = useCallback(async () => {
    await resumeAudio();
    playTap();
    setError(null);
    setGelirTutar("");
    setGelirAciklama("");
    setGiderTutar("");
    setGiderAciklama("");
    setOcrBusy(false);
    setOcrText("");
    setFisTutar("");
    setFisUber("H");
    setFisKategori("Ev");
    setPdfOzet(null);
    setPdfGelirStr("");
    setPdfGiderStr("");
    setPdfUberSoru("E");
    const t = new Date().toISOString().slice(0, 10);
    setGelirTarih(t);
    setGiderTarih(t);
    setFisTarih(t);
    setPdfTarih(t);
  }, [setError]);

  const temizlePdfOzet = useCallback(async () => {
    await resumeAudio();
    playTap();
    setError(null);
    setPdfOzet(null);
    setPdfGelirStr("");
    setPdfGiderStr("");
    setPdfBusy(false);
  }, [setError]);

  const postJson = async (url: string, body: object) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "İstek başarısız");
    return j;
  };

  const delJson = async (body: object) => {
    const r = await fetch("/api/sheets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Silinemedi");
    return j;
  };

  const kaydetGelir = async () => {
    await resumeAudio();
    const t = parseFloat(gelirTutar.replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) {
      playWarn();
      setError("Geçerli bir gelir tutarı girin.");
      return;
    }
    setError(null);
    try {
      await postJson("/api/sheets", {
        tab: "Gelir",
        tarih: gelirTarih,
        tutar: t,
        aciklama: gelirAciklama || "Manuel gelir",
        kaynak: "manuel",
      });
      playIncome();
      playSuccess();
      setGelirTutar("");
      setGelirAciklama("");
      await refresh();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "Hata");
    }
  };

  const kaydetManuelGider = async () => {
    await resumeAudio();
    const t = parseFloat(giderTutar.replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) {
      playWarn();
      setError("Geçerli bir gider tutarı girin.");
      return;
    }
    setError(null);
    try {
      if (uberMasrafGider === "E") {
        await postJson("/api/sheets", {
          tab: "Uber",
          tarih: giderTarih,
          tur: "Gider",
          tutar: t,
          aciklama: giderAciklama || "Manuel Uber gideri",
          kaynak: "manuel",
          uberMasrafi: "E",
        });
      } else {
        await postJson("/api/sheets", {
          tab: "Ozel",
          tarih: giderTarih,
          tutar: t,
          kategori: giderKategori,
          aciklama: giderAciklama || giderKategori,
          kaynak: "manuel",
          uberMi: "H",
        });
      }
      playExpense();
      playSuccess();
      setGiderTutar("");
      setGiderAciklama("");
      await refresh();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "Hata");
    }
  };

  const runOcr = async (file: File) => {
    await resumeAudio();
    playTap();
    setOcrBusy(true);
    setOcrText("");
    setError(null);
    try {
      const T = await import("tesseract.js");
      const r = await T.recognize(file, "tur+eng", {
        logger: () => undefined,
      });
      const text = r.data.text;
      setOcrText(text);
      const total = extractTotalFromReceiptText(text);
      const d = extractDateFromReceiptText(text);
      if (total != null) setFisTutar(String(total));
      if (d) setFisTarih(d);
      else setFisTarih(new Date().toISOString().slice(0, 10));
      playSuccess();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "OCR hatası");
    } finally {
      setOcrBusy(false);
    }
  };

  const kaydetFis = async () => {
    await resumeAudio();
    const t = parseFloat(fisTutar.replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) {
      playWarn();
      setError("Fiş tutarını kontrol edin.");
      return;
    }
    setError(null);
    try {
      if (fisUber === "E") {
        await postJson("/api/sheets", {
          tab: "Uber",
          tarih: fisTarih,
          tur: "Gider",
          tutar: t,
          aciklama: "Fiş",
          kaynak: "fis",
          uberMasrafi: "E",
        });
      } else {
        await postJson("/api/sheets", {
          tab: "Ozel",
          tarih: fisTarih,
          tutar: t,
          kategori: fisKategori,
          aciklama: "Fiş",
          kaynak: "fis",
          uberMi: "H",
        });
      }
      playExpense();
      playSuccess();
      setOcrText("");
      setFisTutar("");
      await refresh();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "Hata");
    }
  };

  const parseUberPdf = async (file: File) => {
    await resumeAudio();
    playTap();
    setPdfBusy(true);
    setPdfOzet(null);
    setPdfGelirStr("");
    setPdfGiderStr("");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/pdf/uber", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "PDF okunamadı");
      const ozet = j.ozet as UberPdfOzet | undefined;
      if (!ozet) throw new Error("Özet verisi yok");
      setPdfOzet(ozet);
      const fmt = (n: number) =>
        n > 0
          ? n.toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";
      setPdfGelirStr(fmt(ozet.gelirToplam));
      setPdfGiderStr(fmt(ozet.giderToplam));
      if (ozet.gelirToplam + ozet.giderToplam > 0) playSuccess();
      else playWarn();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "PDF hatası");
    } finally {
      setPdfBusy(false);
    }
  };

  const pdfUberIsareti = pdfUberSoru === "E" ? "E" : "H";

  const parseTrMoney = (s: string) => {
    const t = s.trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };

  const kaydetPdfOzet = async () => {
    await resumeAudio();
    const gelir = parseTrMoney(pdfGelirStr);
    const gider = parseTrMoney(pdfGiderStr);
    if (gelir <= 0 && gider <= 0) {
      playWarn();
      setError("En az bir tutar girin (gelir veya gider).");
      return;
    }
    setError(null);
    try {
      if (gelir > 0) {
        await postJson("/api/sheets", {
          tab: "Uber",
          tarih: pdfTarih,
          tur: "Gelir",
          tutar: gelir,
          aciklama: "Uber PDF — gelir özeti",
          kaynak: "pdf",
          uberMasrafi: pdfUberIsareti,
        });
        playIncome();
      }
      if (gider > 0) {
        await postJson("/api/sheets", {
          tab: "Uber",
          tarih: pdfTarih,
          tur: "Gider",
          tutar: gider,
          aciklama: "Uber PDF — gider özeti",
          kaynak: "pdf",
          uberMasrafi: pdfUberIsareti,
        });
        playExpense();
      }
      playSuccess();
      setPdfOzet(null);
      setPdfGelirStr("");
      setPdfGiderStr("");
      await refresh();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "Hata");
    }
  };

  const navBtn = (p: Panel, label: string, icon: ReactNode) => (
    <button
      type="button"
      key={p}
      onClick={() => goPanel(p)}
      className={`flex flex-1 min-w-[100px] flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition ${
        panel === p
          ? "border-emerald-500/60 bg-emerald-500/15 text-white"
          : "border-[var(--border)] bg-[var(--card)]/60 text-[var(--muted)] hover:border-[#3d4f6a]"
      }`}
    >
      <span className="text-[var(--text)]">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Kişisel Bütçe
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Google E-Tablolar ile senkron
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={temizleHersey}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-red-500/40 hover:text-red-200"
            title="Tüm formları ve PDF özetini temizle"
          >
            <Eraser className="h-4 w-4" />
            Sıfırla
          </button>
          <button
            type="button"
            onClick={async () => {
              await resumeAudio();
              playTap();
              await refresh();
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--muted)] hover:text-white"
            aria-label="Yenile"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && (
        <div
          className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <nav className="mb-6 flex flex-wrap gap-2">
        {navBtn("ozet", "6 ay özeti", <Wallet className="h-5 w-5" />)}
        {navBtn("gelir", "Gelir", <TrendingUp className="h-5 w-5 text-income" />)}
        {navBtn("gider", "Gider", <TrendingDown className="h-5 w-5 text-expense" />)}
        {navBtn("pdf", "Uber PDF", <Car className="h-5 w-5 text-amber-400" />)}
        {navBtn("liste", "Kayıtlar", <List className="h-5 w-5" />)}
      </nav>

      {panel === "ozet" && (
        <section className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <span className="inline-block h-3 w-3 rounded-full bg-income" />
            <span className="inline-block h-3 w-3 rounded-full bg-expense" />
            Son 6 ay
          </h2>
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-income-muted/20 px-4 py-3 border border-income/30">
              <p className="text-income text-xs font-medium">Toplam gelir</p>
              <p className="text-xl font-bold text-income">
                ₺{toplam6Ay.gelir.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-xl bg-expense-muted/20 px-4 py-3 border border-expense/30">
              <p className="text-expense text-xs font-medium">Toplam gider</p>
              <p className="text-xl font-bold text-expense">
                ₺{toplam6Ay.gider.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <SummaryChart buckets={buckets} />
        </section>
      )}

      {panel === "gelir" && (
        <section className="card-surface space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-income">
            <TrendingUp className="h-6 w-6" />
            Gelir ekle
          </h2>
          <label className="block text-sm text-[var(--muted)]">
            Tarih
            <input
              type="date"
              value={gelirTarih}
              onChange={(e) => setGelirTarih(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm text-[var(--muted)]">
            Tutar (₺)
            <input
              inputMode="decimal"
              value={gelirTutar}
              onChange={(e) => setGelirTutar(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm text-[var(--muted)]">
            Açıklama
            <input
              value={gelirAciklama}
              onChange={(e) => setGelirAciklama(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
            />
          </label>
          <button
            type="button"
            onClick={kaydetGelir}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-income py-4 font-semibold text-white shadow-lg shadow-income/20"
          >
            <Plus className="h-5 w-5" />
            Geliri kaydet
          </button>
        </section>
      )}

      {panel === "gider" && (
        <div className="space-y-6">
          <section className="card-surface space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-expense">
              <Camera className="h-6 w-6" />
              Fiş okut
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Kamera veya galeriden fiş fotoğrafı seçin. Toplam ve tarih otomatik
              çıkarılır (AI kullanılmaz).
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[#0f1419]/80 py-10">
              <Camera className="mb-2 h-10 w-10 text-[var(--muted)]" />
              <span className="text-sm text-[var(--muted)]">Fotoğraf seç</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runOcr(f);
                  e.target.value = "";
                }}
              />
            </label>
            {ocrBusy && (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fiş okunuyor…
              </div>
            )}
            {(fisTutar || ocrText) && (
              <>
                <label className="block text-sm text-[var(--muted)]">
                  Tutar (₺)
                  <input
                    inputMode="decimal"
                    value={fisTutar}
                    onChange={(e) => setFisTutar(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
                  />
                </label>
                <label className="block text-sm text-[var(--muted)]">
                  Tarih
                  <input
                    type="date"
                    value={fisTarih}
                    onChange={(e) => setFisTarih(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
                  />
                </label>
                <p className="text-sm font-medium text-white">
                  Bu Uber iş masrafı mı?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await resumeAudio();
                      playTap();
                      setFisUber("E");
                    }}
                    className={`flex-1 rounded-xl border py-3 text-sm font-medium ${
                      fisUber === "E"
                        ? "border-amber-400 bg-amber-500/20 text-amber-200"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <Car className="mx-auto mb-1 h-5 w-5" />
                    Evet, Uber
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await resumeAudio();
                      playTap();
                      setFisUber("H");
                    }}
                    className={`flex-1 rounded-xl border py-3 text-sm font-medium ${
                      fisUber === "H"
                        ? "border-sky-400 bg-sky-500/20 text-sky-200"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    Hayır
                  </button>
                </div>
                {fisUber === "H" && (
                  <div>
                    <p className="mb-2 text-sm text-[var(--muted)]">Kategori</p>
                    <div className="grid grid-cols-2 gap-2">
                      {OZEL_KATEGORILER.map((c) => {
                        const Icon = c.icon;
                        const active = fisKategori === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={async () => {
                              await resumeAudio();
                              playTap();
                              setFisKategori(c.id);
                            }}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm ${
                              active
                                ? "border-expense bg-expense/15 text-white"
                                : "border-[var(--border)] text-[var(--muted)]"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0 text-expense" />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={kaydetFis}
                  className="w-full rounded-xl bg-expense py-4 font-semibold text-white"
                >
                  Fiş giderini kaydet
                </button>
              </>
            )}
          </section>

          <section className="card-surface space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-expense">
              <Plus className="h-6 w-6" />
              Manuel gider
            </h2>
            <label className="block text-sm text-[var(--muted)]">
              Tarih
              <input
                type="date"
                value={giderTarih}
                onChange={(e) => setGiderTarih(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
              />
            </label>
            <label className="block text-sm text-[var(--muted)]">
              Tutar (₺)
              <input
                inputMode="decimal"
                value={giderTutar}
                onChange={(e) => setGiderTutar(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
              />
            </label>
            <label className="block text-sm text-[var(--muted)]">
              Açıklama
              <input
                value={giderAciklama}
                onChange={(e) => setGiderAciklama(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
              />
            </label>
            <p className="text-sm font-medium text-white">Uber masrafı mı?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await resumeAudio();
                  playTap();
                  setUberMasrafGider("E");
                }}
                className={`flex-1 rounded-xl border py-3 text-sm ${
                  uberMasrafGider === "E"
                    ? "border-amber-400 bg-amber-500/20"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                Evet
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resumeAudio();
                  playTap();
                  setUberMasrafGider("H");
                }}
                className={`flex-1 rounded-xl border py-3 text-sm ${
                  uberMasrafGider === "H"
                    ? "border-sky-400 bg-sky-500/20"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                Hayır
              </button>
            </div>
            {uberMasrafGider === "H" && (
              <div className="grid grid-cols-2 gap-2">
                {OZEL_KATEGORILER.map((c) => {
                  const Icon = c.icon;
                  const active = giderKategori === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={async () => {
                        await resumeAudio();
                        playTap();
                        setGiderKategori(c.id);
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm ${
                        active
                          ? "border-expense bg-expense/15"
                          : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                    >
                      <Icon className="h-5 w-5 text-expense" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={kaydetManuelGider}
              className="w-full rounded-xl bg-expense py-4 font-semibold text-white"
            >
              Gideri kaydet
            </button>
          </section>
        </div>
      )}

      {panel === "pdf" && (
        <section className="card-surface space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-300">
              <Car className="h-6 w-6" />
              Uber haftalık PDF
            </h2>
            <button
              type="button"
              onClick={temizlePdfOzet}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-amber-500/50 hover:text-amber-200"
            >
              <Eraser className="h-3.5 w-3.5" />
              Özeti sıfırla
            </button>
          </div>
          <p className="text-sm text-[var(--muted)]">
            PDF’teki <strong className="text-[var(--text)]">Haftalık Özet</strong> bölümünden
            yalnızca şu satırlar okunur:{" "}
            <strong className="text-income">Kazançlarınız</strong>,{" "}
            <strong className="text-income">Önceki haftalardaki etkinlikler</strong> (gelir),{" "}
            <strong className="text-expense">Para İadeleri ve Giderler</strong> (gider — siz
            alırsınız, devlete ödenecek taraf). Başlangıç bakiyesi toplama dahil değil. CA$ / ₺
            desteklenir.
          </p>
          <p className="text-sm font-medium text-white">Uber iş özeti mi?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await resumeAudio();
                playTap();
                setPdfUberSoru("E");
              }}
              className={`flex-1 rounded-xl border py-3 text-sm ${
                pdfUberSoru === "E"
                  ? "border-amber-400 bg-amber-500/20"
                  : "border-[var(--border)]"
              }`}
            >
              Evet
            </button>
            <button
              type="button"
              onClick={async () => {
                await resumeAudio();
                playTap();
                setPdfUberSoru("H");
              }}
              className={`flex-1 rounded-xl border py-3 text-sm ${
                pdfUberSoru === "H"
                  ? "border-sky-400 bg-sky-500/20"
                  : "border-[var(--border)]"
              }`}
            >
              Hayır
            </button>
          </div>
          <label className="block text-sm text-[var(--muted)]">
            Özet tarihi (tek tarih alanı)
            <input
              type="date"
              value={pdfTarih}
              onChange={(e) => setPdfTarih(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#0f1419] px-4 py-3 text-white"
            />
          </label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-950/20 py-12">
            <FileUp className="mb-2 h-10 w-10 text-amber-400" />
            <span className="text-sm text-amber-200/90">PDF seç</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseUberPdf(f);
                e.target.value = "";
              }}
            />
          </label>
          {pdfBusy && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF ayrıştırılıyor…
            </div>
          )}
          {pdfOzet && (
            <div className="space-y-3">
              {pdfOzet.uyari && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                  {pdfOzet.uyari}
                </p>
              )}
              <p className="text-sm font-medium text-white">PDF özeti — düzenleyebilirsiniz</p>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0f1419]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[#151d2e] text-left text-[var(--muted)]">
                      <th className="px-4 py-3 font-medium">Tür</th>
                      <th className="px-4 py-3 font-medium">Tutar (₺ / CA$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]/80">
                      <td className="px-4 py-3 font-medium text-income">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-income align-middle" />
                        Gelir toplamı
                      </td>
                      <td className="px-4 py-2">
                        <input
                          inputMode="decimal"
                          value={pdfGelirStr}
                          onChange={(e) => setPdfGelirStr(e.target.value)}
                          placeholder="0,00"
                          className="w-full rounded-lg border border-income/40 bg-[#0f1419] px-3 py-2 text-white"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-expense">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-expense align-middle" />
                        Gider toplamı
                      </td>
                      <td className="px-4 py-2">
                        <input
                          inputMode="decimal"
                          value={pdfGiderStr}
                          onChange={(e) => setPdfGiderStr(e.target.value)}
                          placeholder="0,00"
                          className="w-full rounded-lg border border-expense/40 bg-[#0f1419] px-3 py-2 text-white"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {pdfOzet.kalemler.length > 0 && (
                <details className="rounded-xl border border-[var(--border)] bg-[#0f1419]/80 p-3 text-xs text-[var(--muted)]">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
                    PDF’teki özet satırları ({pdfOzet.kalemler.length})
                  </summary>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {pdfOzet.kalemler.map((k, i) => (
                      <li
                        key={`${k.aciklama}-${i}`}
                        className="flex justify-between gap-2 border-b border-[var(--border)]/40 pb-2 last:border-0"
                      >
                        <span
                          className={
                            k.tur === "Gelir" ? "text-income shrink-0" : "text-expense shrink-0"
                          }
                        >
                          {k.tur}
                        </span>
                        <span className="text-right text-white">
                          ₺
                          {k.tutar.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                type="button"
                onClick={kaydetPdfOzet}
                className="w-full rounded-xl bg-amber-600 py-4 font-semibold text-white"
              >
                Toplamları Uber sayfasına yaz (en fazla 2 satır)
              </button>
            </div>
          )}
        </section>
      )}

      {panel === "liste" && !data && !loading && (
        <p className="text-center text-[var(--muted)] py-8">
          Kayıtlar yüklenemedi. Ortam değişkenlerini ve e-tablo paylaşımını kontrol edin.
        </p>
      )}
      {panel === "liste" && data && (
        <div className="space-y-6">
          <UberList
            rows={data.uber}
            onDelete={async (id) => {
              await resumeAudio();
              playTap();
              try {
                await delJson({ tab: "Uber", id });
                playSuccess();
                await refresh();
              } catch (e) {
                playWarn();
                setError(e instanceof Error ? e.message : "Hata");
              }
            }}
          />
          <OzelList
            rows={data.ozel}
            onDelete={async (id) => {
              await resumeAudio();
              playTap();
              try {
                await delJson({ tab: "Ozel", id });
                playSuccess();
                await refresh();
              } catch (e) {
                playWarn();
                setError(e instanceof Error ? e.message : "Hata");
              }
            }}
          />
          <GelirList
            rows={data.gelir}
            onDelete={async (id) => {
              await resumeAudio();
              playTap();
              try {
                await delJson({ tab: "Gelir", id });
                playSuccess();
                await refresh();
              } catch (e) {
                playWarn();
                setError(e instanceof Error ? e.message : "Hata");
              }
            }}
          />
        </div>
      )}

      {loading && !data && (
        <p className="py-12 text-center text-[var(--muted)]">Yükleniyor…</p>
      )}
    </div>
  );
}

function UberList({
  rows,
  onDelete,
}: {
  rows: UberRow[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card-surface p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-200">
        <Car className="h-5 w-5" />
        Uber (tab)
      </h3>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && (
          <li className="text-[var(--muted)]">Kayıt yok</li>
        )}
        {[...rows].reverse().map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[#0f1419]/80 px-3 py-2"
          >
            <div>
              <span
                className={
                  r.tur === "Gelir" ? "text-income font-medium" : "text-expense font-medium"
                }
              >
                {r.tur}
              </span>
              <span className="text-[var(--muted)]"> · {r.tarih}</span>
              <p className="text-white">
                ₺{r.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs text-[var(--muted)]">{r.aciklama}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(r.id)}
              className="rounded-lg p-2 text-expense hover:bg-expense/10"
              aria-label="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OzelList({
  rows,
  onDelete,
}: {
  rows: OzelRow[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card-surface p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-sky-200">
        <TrendingDown className="h-5 w-5 text-expense" />
        Özel harcamalar (tab)
      </h3>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && (
          <li className="text-[var(--muted)]">Kayıt yok</li>
        )}
        {[...rows].reverse().map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[#0f1419]/80 px-3 py-2"
          >
            <div>
              <span className="text-expense font-medium">{r.kategori}</span>
              <span className="text-[var(--muted)]"> · {r.tarih}</span>
              <p className="text-white">
                ₺{r.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(r.id)}
              className="rounded-lg p-2 text-expense hover:bg-expense/10"
              aria-label="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GelirList({
  rows,
  onDelete,
}: {
  rows: GelirRow[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card-surface p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-income">
        <TrendingUp className="h-5 w-5" />
        Genel gelir (tab)
      </h3>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && (
          <li className="text-[var(--muted)]">Kayıt yok</li>
        )}
        {[...rows].reverse().map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[#0f1419]/80 px-3 py-2"
          >
            <div>
              <span className="text-income font-medium">Gelir</span>
              <span className="text-[var(--muted)]"> · {r.tarih}</span>
              <p className="text-white">
                ₺{r.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}{" "}
                <span className="text-xs text-[var(--muted)]">{r.aciklama}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(r.id)}
              className="rounded-lg p-2 text-expense hover:bg-expense/10"
              aria-label="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
