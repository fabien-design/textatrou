export const VOICES = [
  { id: 'narrateur', emoji: '🎙️', name: 'Narrateur', price: null, model: 'fr_FR-siwis-medium', rate: 1, pitch: 1, effect: null },
  { id: 'robot', emoji: '🤖', name: 'Robot', price: '0,99 €', model: 'fr_FR-tom-medium', rate: 1, pitch: 1, effect: 'robot' },
  { id: 'ecureuil', emoji: '🐿️', name: 'Écureuil', price: '0,99 €', model: 'fr_FR-siwis-medium', rate: 1.35, pitch: 1.6, effect: 'chipmunk' },
  { id: 'mamie', emoji: '👵', name: 'Mamie', price: '0,99 €', model: 'fr_FR-siwis-medium', rate: 0.85, pitch: 0.9, effect: 'tremolo' },
  { id: 'commentateur', emoji: '🎤', name: 'Commentateur', price: '0,99 €', model: 'fr_FR-tom-medium', rate: 1.2, pitch: 1, effect: 'radio' },
];

export const VOICE_BUNDLE = {
  id: 'bundle',
  name: 'Toutes les voix',
  emoji: '🎁',
  price: '2,49 €',
  includes: ['robot', 'ecureuil', 'mamie', 'commentateur'],
};

const ready = new Set(); // ready models
let piperMod = null;
let audioCtx = null;
const active = new Set(); // pending speak states
let recog = null;
let recogDone = null;

const getVoice = (id) => VOICES.find((v) => v.id === id) || VOICES[0];

async function loadPiper() {
  if (!piperMod) piperMod = await import('@mintplex-labs/piper-tts-web');
  return piperMod;
}

export async function preloadVoice(id, onProgress) {
  try {
    const v = getVoice(id);
    const piper = await loadPiper();
    await piper.download(v.model, (p) => {
      try {
        if (onProgress && p && p.total) onProgress(Math.min(1, p.loaded / p.total));
      } catch { /* ignore */ }
    });
    ready.add(v.model);
    try { onProgress && onProgress(1); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

export function isVoiceReady(id) {
  try {
    return ready.has(getVoice(id).model);
  } catch {
    return false;
  }
}

function getCtx() {
  try {
    if (audioCtx) return audioCtx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

function buildChain(ctx, src, effect, nodes) {
  const out = ctx.destination;
  if (effect === 'robot') {
    const g = ctx.createGain();
    g.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 50;
    const depth = ctx.createGain();
    depth.gain.value = 1;
    osc.connect(depth);
    depth.connect(g.gain);
    osc.start();
    nodes.push(osc);
    src.connect(g);
    g.connect(out);
  } else if (effect === 'tremolo') {
    const g = ctx.createGain();
    g.gain.value = 0.75;
    const osc = ctx.createOscillator();
    osc.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    osc.connect(depth);
    depth.connect(g.gain);
    osc.start();
    nodes.push(osc);
    src.connect(g);
    g.connect(out);
  } else if (effect === 'radio') {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.8;
    const drive = ctx.createGain();
    drive.gain.value = 1.6;
    src.connect(bp);
    bp.connect(drive);
    drive.connect(out);
  } else {
    src.connect(out);
  }
}

function playBlobWebAudio(blob, voice, state) {
  const ctx = getCtx();
  if (!ctx) return null;
  return new Promise((resolve) => {
    let finished = false;
    let timer = null;
    const nodes = [];
    let src = null;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      nodes.forEach((n) => { try { n.stop(); } catch { /* ignore */ } });
      resolve(ok);
    };
    state.stop = () => {
      try { src && src.stop(); } catch { /* ignore */ }
      done(true);
    };
    (async () => {
      try {
        await Promise.race([
          Promise.resolve(ctx.resume()).catch(() => {}),
          new Promise((r) => setTimeout(r, 1000)),
        ]);
        if (finished) return;
        if (ctx.state !== 'running') return done(false);
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        if (finished) return;
        src = ctx.createBufferSource();
        src.buffer = buf;
        const rate = voice.rate * (voice.effect === 'chipmunk' ? voice.pitch : 1);
        src.playbackRate.value = rate;
        buildChain(ctx, src, voice.effect, nodes);
        src.onended = () => done(true);
        timer = setTimeout(() => done(true), ((buf.duration || 30) / rate + 1) * 1000);
        src.start(0);
      } catch {
        done(false);
      }
    })();
  });
}

function playBlobAudioEl(blob, voice, state) {
  if (typeof window === 'undefined' || !window.Audio) return null;
  return new Promise((resolve) => {
    let url = null;
    let audio;
    let finished = false;
    let timer = null;
    const done = (ok = true) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { url && URL.revokeObjectURL(url); } catch { /* ignore */ }
      resolve(ok);
    };
    try {
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      const rate = voice.rate * (voice.effect === 'chipmunk' ? voice.pitch : 1);
      audio.playbackRate = rate;
      audio.addEventListener('ended', () => done(true));
      audio.onended = () => done(true);
      const fail = () => {
        try { audio.pause(); } catch { /* ignore */ }
        done(false);
      };
      audio.onerror = fail;
      audio.onstalled = fail;
      audio.addEventListener('loadedmetadata', () => {
        if (finished || !isFinite(audio.duration) || !audio.duration) return;
        clearTimeout(timer);
        timer = setTimeout(() => done(true), (audio.duration / rate + 1) * 1000);
      });
      timer = setTimeout(() => done(true), 30000);
      state.stop = () => {
        try { audio.pause(); } catch { /* ignore */ }
        done(true);
      };
      const p = audio.play();
      if (p && p.catch) p.catch(() => done(false));
    } catch {
      done(false);
    }
  });
}

function pickFrVoice() {
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    const fr = vs.filter((v) => /^fr/i.test(v.lang || ''));
    const good = fr.find((v) => /Natural|Enhanced|Premium|Neural|Siri|Amélie|Thomas/i.test(v.name || ''));
    return good || fr[0] || null;
  } catch {
    return null;
  }
}

function synthChunk(text, voice, state) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return resolve();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = voice.rate;
      u.pitch = voice.pitch;
      const fv = pickFrVoice();
      if (fv) u.voice = fv;
      let finished = false;
      let timer = null;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(done, (text.length * 90) / (voice.rate || 1) + 2000);
      u.onend = done;
      u.onerror = done;
      state.stop = done;
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

async function speakChunk(text, voice, state) {
  if (ready.has(voice.model)) {
    try {
      const piper = await loadPiper();
      const blob = await piper.predict({ text, voiceId: voice.model });
      if (state.cancelled) return;
      const w = playBlobWebAudio(blob, voice, state);
      if (w && (await w)) return;
      if (state.cancelled) return;
      const el = playBlobAudioEl(blob, voice, state);
      if (el && (await el)) return;
    } catch {
      if (state.cancelled) return;
    }
  }
  if (state.cancelled) return;
  await synthChunk(text, voice, state);
}

function splitSentences(text) {
  const parts = String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export async function speak(text, { voiceId } = {}) {
  try {
    const t = String(text ?? '').trim();
    if (!t) return;
    const voice = getVoice(voiceId);
    const state = { cancelled: false, stop: null };
    active.add(state);
    try {
      const chunks = splitSentences(t);
      for (let i = 0; i < chunks.length && !state.cancelled; i++) {
        await speakChunk(chunks[i], voice, state);
        if (i < chunks.length - 1 && !state.cancelled) await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      active.delete(state);
    }
  } catch { /* never throw */ }
}

export function cancelSpeech() {
  try {
    for (const s of active) {
      s.cancelled = true;
      try { s.stop && s.stop(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  } catch { /* ignore */ }
}

export function unlockSpeech() {
  try {
    const ctx = getCtx();
    if (ctx && ctx.resume) Promise.resolve(ctx.resume()).catch(() => {});
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const u = new window.SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch { /* ignore */ }
}

function getRecognitionCtor() {
  try {
    return typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;
  } catch {
    return null;
  }
}

export function isSttSupported() {
  return !!getRecognitionCtor();
}

export function listen({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    try {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return resolve(null);
      stopListening();
      const r = new Ctor();
      let result = null;
      let finished = false;
      let timer = null;
      const finish = (val) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (recog === r) { recog = null; recogDone = null; }
        resolve(val);
      };
      recog = r;
      recogDone = () => {
        try { r.abort(); } catch { /* ignore */ }
        finish(null);
      };
      r.lang = 'fr-FR';
      r.interimResults = false;
      r.maxAlternatives = 3;
      r.continuous = false;
      r.onresult = (e) => {
        try {
          const alt = e.results?.[0]?.[0];
          const tr = alt && typeof alt.transcript === 'string' ? alt.transcript.trim() : '';
          if (tr) result = tr;
        } catch { /* ignore */ }
      };
      r.onerror = () => finish(null);
      r.onnomatch = () => finish(null);
      r.onend = () => finish(result);
      timer = setTimeout(() => {
        try { r.abort(); } catch { /* ignore */ }
        finish(null);
      }, timeoutMs);
      r.start();
    } catch {
      resolve(null);
    }
  });
}

export function stopListening() {
  try {
    if (recogDone) recogDone();
  } catch { /* ignore */ }
}

export async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}
