let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

export async function resumeAudio() {
  const c = getCtx();
  if (c?.state === "suspended") await c.resume();
}

function beep(freq: number, duration: number, type: OscillatorType) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration);
}

/** Genel tıklama / seçim */
export function playTap() {
  beep(520, 0.06, "sine");
}

/** Gelir (yeşil his) */
export function playIncome() {
  beep(660, 0.1, "triangle");
}

/** Gider (daha alçak ton) */
export function playExpense() {
  beep(220, 0.12, "square");
}

/** Başarı / kayıt */
export function playSuccess() {
  beep(523, 0.08, "sine");
  setTimeout(() => beep(659, 0.1, "sine"), 90);
}

/** Uyarı */
export function playWarn() {
  beep(180, 0.15, "sawtooth");
}
