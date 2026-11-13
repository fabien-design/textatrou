import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const h = vi.hoisted(() => ({
  ready: { v: false },
  loadKokoro: vi.fn(),
  isKokoroReady: vi.fn(),
  synthesize: vi.fn(),
}));

vi.mock('../../src/lib/kokoro.js', () => ({
  loadKokoro: h.loadKokoro,
  isKokoroReady: h.isKokoroReady,
  synthesize: h.synthesize,
}));

let speakSpy;

function installMocks() {
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume = async () => {};
    createBuffer(ch, len, rate) { return { getChannelData: () => new Float32Array(len), duration: len / rate }; }
    createBufferSource() {
      const s = {
        buffer: null, onended: null, playbackRate: { value: 1 },
        connect() {}, stop() {},
        start() { setTimeout(() => s.onended && s.onended(), 0); },
      };
      return s;
    }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  }
  window.AudioContext = Ctx;
  speakSpy = vi.fn((u) => setTimeout(() => u.onend && u.onend(), 0));
  window.speechSynthesis = { speak: speakSpy, cancel: vi.fn(), getVoices: () => [] };
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
}

async function load() {
  vi.resetModules();
  return import('../../src/lib/speech.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  h.ready.v = false;
  h.loadKokoro.mockImplementation(async (cb) => { cb && cb(0.5); cb && cb(1); h.ready.v = true; return true; });
  h.isKokoroReady.mockImplementation(() => h.ready.v);
  h.synthesize.mockImplementation(async () => ({ audio: new Float32Array(2400), sampling_rate: 24000 }));
  installMocks();
});

describe('speech with kokoro', () => {
  it('VOICES keeps 5 voice ids', async () => {
    const s = await load();
    expect(s.VOICES.map((v) => v.id).join() === 'narrateur,robot,ecureuil,mamie,commentateur').toBe(true);
  });
  it('narrateur is free', async () => {
    const s = await load();
    expect(s.VOICES.find((v) => v.id === 'narrateur').price === null).toBe(true);
  });
  it('paid voices cost 0,99 €', async () => {
    const s = await load();
    expect(s.VOICES.filter((v) => v.id !== 'narrateur').every((v) => v.price === '0,99 €')).toBe(true);
  });
  it('every voice uses kokoro engine', async () => {
    const s = await load();
    expect(s.VOICES.every((v) => v.engine === 'kokoro')).toBe(true);
  });
  it('every voice has numeric speed', async () => {
    const s = await load();
    expect(s.VOICES.every((v) => typeof v.speed === 'number' && v.speed > 0)).toBe(true);
  });
  it('narrateur speed is dynamic (>=1.05)', async () => {
    const s = await load();
    expect(s.VOICES.find((v) => v.id === 'narrateur').speed >= 1.05).toBe(true);
  });
  it('VOICE_BUNDLE price unchanged', async () => {
    const s = await load();
    expect(s.VOICE_BUNDLE.price === '2,49 €').toBe(true);
  });
  it('preloadVoice calls loadKokoro', async () => {
    const s = await load();
    await s.preloadVoice('narrateur');
    expect(h.loadKokoro.mock.calls.length >= 1).toBe(true);
  });
  it('preloadVoice resolves true', async () => {
    const s = await load();
    expect((await s.preloadVoice('narrateur')) === true).toBe(true);
  });
  it('preloadVoice forwards progress ending with 1', async () => {
    const s = await load();
    const vals = [];
    await s.preloadVoice('narrateur', (p) => vals.push(p));
    expect(vals[vals.length - 1] === 1).toBe(true);
  });
  it('isVoiceReady true after preload', async () => {
    const s = await load();
    await s.preloadVoice('narrateur');
    expect(s.isVoiceReady('narrateur') === true).toBe(true);
  });
  it('speak when ready calls synthesize with text', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('Bonjour le monde', { voiceId: 'narrateur' });
    expect(h.synthesize.mock.calls[0]?.[0] === 'Bonjour le monde').toBe(true);
  });
  it('speak passes voice speed', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'mamie' });
    const sp = s.VOICES.find((v) => v.id === 'mamie').speed;
    expect(h.synthesize.mock.calls[0]?.[1]?.speed === sp).toBe(true);
  });
  it('two sentences synthesize twice', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('Salut toi. Comment vas-tu ?', { voiceId: 'narrateur' });
    expect(h.synthesize.mock.calls.length === 2).toBe(true);
  });
  it('sentences synthesized in order', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('Salut toi. Comment vas-tu ?', { voiceId: 'narrateur' });
    expect(h.synthesize.mock.calls[0]?.[0].startsWith('Salut') && h.synthesize.mock.calls[1]?.[0].startsWith('Comment')).toBe(true);
  });
  it('speak when ready does not use speechSynthesis', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'narrateur' });
    expect(speakSpy.mock.calls.length === 0).toBe(true);
  });
  it('speak when not ready falls back to speechSynthesis', async () => {
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'narrateur' });
    expect(speakSpy.mock.calls.length >= 1).toBe(true);
  });
  it('speak when not ready does not synthesize', async () => {
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'narrateur' });
    expect(h.synthesize.mock.calls.length === 0).toBe(true);
  });
  it('synthesize throwing falls back to speechSynthesis', async () => {
    h.ready.v = true;
    h.synthesize.mockImplementation(async () => { throw new Error('x'); });
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'narrateur' });
    expect(speakSpy.mock.calls.length >= 1).toBe(true);
  });
  it('synthesize returning null falls back to speechSynthesis', async () => {
    h.ready.v = true;
    h.synthesize.mockImplementation(async () => null);
    const s = await load();
    await s.speak('Bonjour', { voiceId: 'narrateur' });
    expect(speakSpy.mock.calls.length >= 1).toBe(true);
  });
  it('empty text resolves immediately without synthesizing', async () => {
    h.ready.v = true;
    const s = await load();
    await s.speak('   ', { voiceId: 'narrateur' });
    expect(h.synthesize.mock.calls.length === 0 && speakSpy.mock.calls.length === 0).toBe(true);
  });
  it('cancelSpeech resolves a pending speak', async () => {
    h.ready.v = true;
    let release;
    h.synthesize.mockImplementation(() => new Promise((r) => { release = () => r(null); }));
    const s = await load();
    const p = s.speak('Bonjour', { voiceId: 'narrateur' });
    await new Promise((r) => setTimeout(r, 10));
    s.cancelSpeech();
    release && release();
    const res = await Promise.race([p.then(() => 'done'), new Promise((r) => setTimeout(() => r('hang'), 1500))]);
    expect(res === 'done').toBe(true);
  });
  it('speech.js does not reference piper', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/speech.js'), 'utf8');
    expect(src.includes('@mintplex-labs/piper-tts-web')).toBe(false);
  });
  it('speech.js imports kokoro', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/speech.js'), 'utf8');
    expect(src.includes('kokoro')).toBe(true);
  });
  it('STT and permission API still exported', async () => {
    const s = await load();
    expect([s.listen, s.stopListening, s.isSttSupported, s.requestMicPermission].every((f) => typeof f === 'function')).toBe(true);
  });
});
