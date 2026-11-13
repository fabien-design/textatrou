import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const tokenizerFn = vi.fn((text) => ({ input_ids: { dims: [1, text.length] } }));
  const modelFn = vi.fn(async () => ({ waveform: { data: new Float32Array(2400).fill(0.1) } }));
  return {
    tokenizerFn,
    modelFn,
    tokFrom: vi.fn(async () => tokenizerFn),
    modelFrom: vi.fn(async () => modelFn),
    phonemize: vi.fn(async () => ['bɔ̃ʒuʁ']),
    env: { allowLocalModels: true, allowRemoteModels: true, localModelPath: '', backends: { onnx: { wasm: {} } } },
  };
});

vi.mock('@huggingface/transformers', () => ({
  env: h.env,
  AutoTokenizer: { from_pretrained: h.tokFrom },
  StyleTextToSpeech2Model: { from_pretrained: h.modelFrom },
  Tensor: class { constructor(type, data, dims) { Object.assign(this, { type, data, dims }); } },
}));
vi.mock('phonemizer', () => ({ phonemize: h.phonemize }));

async function load() {
  vi.resetModules();
  return import('../../src/lib/kokoro.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  h.env.allowRemoteModels = true;
  h.env.localModelPath = '';
  h.env.backends.onnx.wasm = {};
  h.tokFrom.mockImplementation(async () => h.tokenizerFn);
  h.modelFrom.mockImplementation(async () => h.modelFn);
  globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Float32Array(510 * 256).buffer }));
});

describe('kokoro engine', () => {
  it('loadKokoro resolves true', async () => {
    const k = await load();
    expect((await k.loadKokoro()) === true).toBe(true);
  });
  it('isKokoroReady true after load', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(k.isKokoroReady() === true).toBe(true);
  });
  it('isKokoroReady false before load', async () => {
    const k = await load();
    expect(k.isKokoroReady() === false).toBe(true);
  });
  it('disables remote models', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(h.env.allowRemoteModels === false).toBe(true);
  });
  it('sets localModelPath', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(h.env.localModelPath === '/models/').toBe(true);
  });
  it('sets wasmPaths', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(h.env.backends.onnx.wasm.wasmPaths === '/ort/').toBe(true);
  });
  it('model loaded from kokoro id', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(h.modelFrom.mock.calls[0]?.[0] === 'kokoro').toBe(true);
  });
  it('model options contain dtype, device, progress_callback', async () => {
    const k = await load();
    await k.loadKokoro();
    const o = h.modelFrom.mock.calls[0]?.[1] || {};
    expect('dtype' in o && 'device' in o && typeof o.progress_callback === 'function').toBe(true);
  });
  it('tokenizer loaded from kokoro id', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(h.tokFrom.mock.calls[0]?.[0] === 'kokoro').toBe(true);
  });
  it('fetches voice file', async () => {
    const k = await load();
    await k.loadKokoro();
    expect(globalThis.fetch.mock.calls.some((c) => c[0] === '/models/kokoro/voices/ff_siwis.bin')).toBe(true);
  });
  it('progress values stay in [0,1]', async () => {
    const k = await load();
    const vals = [];
    await k.loadKokoro((p) => vals.push(p));
    expect(vals.length > 0 && vals.every((p) => typeof p === 'number' && p >= 0 && p <= 1)).toBe(true);
  });
  it('progress ends with 1', async () => {
    const k = await load();
    const vals = [];
    await k.loadKokoro((p) => vals.push(p));
    expect(vals[vals.length - 1] === 1).toBe(true);
  });
  it('second load does not reload model', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.loadKokoro();
    expect(h.modelFrom.mock.calls.length === 1).toBe(true);
  });
  it('model failure resolves false', async () => {
    h.modelFrom.mockImplementation(async () => { throw new Error('boom'); });
    const k = await load();
    expect((await k.loadKokoro()) === false).toBe(true);
  });
  it('model failure leaves not ready', async () => {
    h.modelFrom.mockImplementation(async () => { throw new Error('boom'); });
    const k = await load();
    await k.loadKokoro();
    expect(k.isKokoroReady() === false).toBe(true);
  });
  it('synthesize returns null when not ready', async () => {
    const k = await load();
    expect((await k.synthesize('Bonjour')) === null).toBe(true);
  });
  it('synthesize returns null for empty text', async () => {
    const k = await load();
    await k.loadKokoro();
    expect((await k.synthesize('')) === null).toBe(true);
  });
  it('synthesize phonemizes with fr-fr', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour');
    expect(h.phonemize.mock.calls[0]?.[0] === 'Bonjour' && h.phonemize.mock.calls[0]?.[1] === 'fr-fr').toBe(true);
  });
  it('synthesize tokenizes phonemes', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour');
    expect(h.tokenizerFn.mock.calls[0]?.[0] === 'bɔ̃ʒuʁ').toBe(true);
  });
  it('returns Float32Array audio', async () => {
    const k = await load();
    await k.loadKokoro();
    const r = await k.synthesize('Bonjour');
    expect(r?.audio instanceof Float32Array).toBe(true);
  });
  it('returns 24000 sampling rate', async () => {
    const k = await load();
    await k.loadKokoro();
    const r = await k.synthesize('Bonjour');
    expect(r?.sampling_rate === 24000).toBe(true);
  });
  it('model called once with input_ids, style, speed', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour', { speed: 1.2 });
    const a = h.modelFn.mock.calls[0]?.[0] || {};
    expect(h.modelFn.mock.calls.length === 1 && 'input_ids' in a && 'style' in a && 'speed' in a).toBe(true);
  });
  it('style tensor has dims [1,256]', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour');
    const s = h.modelFn.mock.calls[0]?.[0]?.style;
    expect(JSON.stringify(s?.dims) === '[1,256]').toBe(true);
  });
  it('style tensor holds 256 floats', async () => {
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour');
    const s = h.modelFn.mock.calls[0]?.[0]?.style;
    expect(s?.data?.length === 256).toBe(true);
  });
  it('style row depends on token count', async () => {
    const buf = new Float32Array(510 * 256);
    for (let i = 0; i < 510; i++) buf.fill(i, i * 256, (i + 1) * 256);
    globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => buf.buffer }));
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('Bonjour');
    const s = h.modelFn.mock.calls[0]?.[0]?.style;
    const dims = h.tokenizerFn.mock.results[0]?.value?.input_ids?.dims;
    const expected = Math.min(Math.max((dims?.[dims.length - 1] ?? 0) - 2, 0), 509);
    expect(dims !== undefined && s?.data?.[0] === expected).toBe(true);
  });
  it('style row index clamped to 509', async () => {
    const buf = new Float32Array(510 * 256);
    for (let i = 0; i < 510; i++) buf.fill(i, i * 256, (i + 1) * 256);
    globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => buf.buffer }));
    h.phonemize.mockImplementationOnce(async () => ['a'.repeat(900)]);
    const k = await load();
    await k.loadKokoro();
    await k.synthesize('long');
    expect(h.modelFn.mock.calls[0]?.[0]?.style?.data?.[0] === 509).toBe(true);
  });
});
