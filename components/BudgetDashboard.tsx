"use client";

import {
  Camera,
  Car,
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
import type { ParsedUberLine } from "@/lib/uberPdfParser";

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
  const [pdfLines, setPdfLines] = useState<ParsedUberLine[]>([]);
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
    setPdfLines([]);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/pdf/uber", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "PDF okunamadı");
      setPdfLines(j.lines ?? []);
      if ((j.lines ?? []).length === 0) playWarn();
      else playSuccess();
    } catch (e) {
      playWarn();
      setError(e instanceof Error ? e.message : "PDF hatası");
    } finally {
      setPdfBusy(false);
    }
  };

  const pdfUberIsareti = pdfUberSoru === "E" ? "E" : "H";

  const kaydetPdfSatirlari = async () => {
    await resumeAudio();
    if (pdfLines.length === 0) {
      playWarn();
      return;
    }
    setError(null);
    try {
      for (const line of pdfLines) {
        await postJson("/api/sheets", {
          tab: "Uber",
          tarih: pdfTarih,
          tur: line.tur,
          tutar: line.tutar,
          aciklama: line.aciklama.slice(0, 180),
          kaynak: "pdf",
          uberMasrafi: pdfUberIsareti,
        });
        if (line.tur === "Gelir") playIncome();
        else playExpense();
      }
      playSuccess();
      setPdfLines([]);
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
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-300">
            <Car className="h-6 w-6" />
            Uber haftalık PDF
          </h2>
          <p className="text-sm text-[var(--muted)]">
            PDF yükleyin; metin satırlarından tutarlar kural tabanlı çıkarılır (AI
            yok). Önce Uber iş kaydı mı işaretleyin.
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
          {pdfLines.length > 0 && (
            <>
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[#0f1419] p-3 text-xs">
                {pdfLines.map((l, i) => (
                  <li
                    key={`${l.hamSatir}-${i}`}
                    className="flex justify-between gap-2 border-b border-[var(--border)]/50 py-2 last:border-0"
                  >
                    <span
                      className={
                        l.tur === "Gelir" ? "text-income" : "text-expense"
                      }
                    >
                      {l.tur}
                    </span>
                    <span className="text-white">
                      ₺{l.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={kaydetPdfSatirlari}
                className="w-full rounded-xl bg-amber-600 py-4 font-semibold text-white"
              >
                Tüm satırları Uber sayfasına yaz
              </button>
            </>
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
