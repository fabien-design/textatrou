// Web Audio synth: no audio files. Every export is safe (never throws).

let ctx = null;
const MASTER = 0.3;

function getCtx() {
  if (ctx) return ctx;
  try {
    const AC =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

function ready() {
  const c = getCtx();
  if (!c) return null;
  try {
    if (c.state === 'suspended') {
      const p = c.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch {
    /* ignore */
  }
  return c;
}

function safe(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch {
      /* never throw */
    }
  };
}

// Gain node with quick attack and exponential decay to silence.
function envelope(c, t, peak, attack, dur) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak * MASTER, 0.002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(c.destination);
  return g;
}

function noiseBuffer(c, seconds) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function osc(c, type, t, dur, dest) {
  const o = c.createOscillator();
  o.type = type;
  o.connect(dest);
  o.start(t);
  o.stop(t + dur);
  return o;
}

function noiseBurst(c, t, dur, peak, filterType, freq, q) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freq, t);
  if (q) f.Q.setValueAtTime(q, t);
  const g = envelope(c, t, peak, 0.005, dur);
  src.connect(f);
  f.connect(g);
  src.start(t);
  src.stop(t + dur);
}

function tom(c, t) {
  const g = envelope(c, t, 1, 0.005, 0.2);
  const o = osc(c, 'sine', t, 0.22, g);
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
}

export const unlockAudio = safe(() => {
  const c = ready();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(c.destination);
    s.start(0);
    s.stop(0.01);
  } catch {
    /* ignore */
  }
});

export const playPop = safe(() => {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const g = envelope(c, t, 1, 0.01, 0.12);
  const o = osc(c, 'sine', t, 0.14, g);
  o.frequency.setValueAtTime(600, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
});

export const playJoker = safe(() => {
  const c = ready();
  if (!c) return;
  const t0 = c.currentTime;
  // drum roll
  for (let i = 0; i < 6; i++) noiseBurst(c, t0 + i * 0.05, 0.05, 0.6, 'bandpass', 900, 1);
  // boing
  const t = t0 + 0.32;
  const g = envelope(c, t, 1, 0.02, 0.6);
  const o = osc(c, 'triangle', t, 0.62, g);
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.6);
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.setValueAtTime(14, t);
  lfoGain.gain.setValueAtTime(40, t);
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + 0.62);
});

export const playBadumTss = safe(() => {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  tom(c, t);
  tom(c, t + 0.18);
  noiseBurst(c, t + 0.4, 0.5, 0.8, 'highpass', 7000, 0);
});

export const playScream = safe(() => {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const dur = 0.8;
  const g = envelope(c, t, 1, 0.1, dur);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, t);
  f.connect(g);
  const o = osc(c, 'sawtooth', t, dur + 0.05, f);
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(900, t + dur);
  // tremolo
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.setValueAtTime(18, t);
  lg.gain.setValueAtTime(0.1, t);
  lfo.connect(lg);
  lg.connect(g.gain);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
});

export const playApplause = safe(() => {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const total = 1.5;
  for (let i = 0; i < 60; i++) {
    const at = Math.random() * total;
    const swell = Math.sin((Math.PI * at) / total); // swell then fade
    const peak = 0.15 + 0.6 * swell;
    const freq = 1500 + Math.random() * 1500;
    noiseBurst(c, t + at, 0.03 + Math.random() * 0.03, peak, 'bandpass', freq, 1);
  }
});

export const playBeep = safe(() => {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const g = envelope(c, t, 0.6, 0.005, 0.1);
  const o = osc(c, 'square', t, 0.12, g);
  o.frequency.setValueAtTime(880, t);
});
