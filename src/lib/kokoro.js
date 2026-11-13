// Kokoro-82M (voix française ff_siwis) exécuté dans le navigateur, 100 % hors-ligne.
const VOICE_URL = '/models/kokoro/voices/ff_siwis.bin';
const SAMPLE_RATE = 24000;

let loadPromise = null;
let ready = false;
let model = null;
let tokenizer = null;
let phonemize = null;
let Tensor = null;
let voiceData = null;

export function isKokoroReady() {
  return ready;
}

export function loadKokoro(onProgress) {
  const report = (p) => {
    try { onProgress && onProgress(Math.max(0, Math.min(1, p))); } catch { /* ignore */ }
  };
  if (ready) {
    report(1);
    return Promise.resolve(true);
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const tf = await import('@huggingface/transformers');
        const ph = await import('phonemizer');
        const { env, AutoTokenizer, StyleTextToSpeech2Model } = tf;
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.localModelPath = '/models/';
        env.backends.onnx.wasm.wasmPaths = '/ort/';
        let device = 'wasm';
        try {
          if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
            const adapter = navigator.gpu && navigator.gpu.requestAdapter ? await navigator.gpu.requestAdapter() : null;
            if (adapter) device = 'webgpu';
          }
        } catch { /* wasm */ }
        const dtype = device === 'webgpu' ? 'fp32' : 'q8';
        const progress_callback = (e) => {
          if (e && e.status === 'progress' && typeof e.progress === 'number') report((e.progress / 100) * 0.95);
        };
        model = await StyleTextToSpeech2Model.from_pretrained('kokoro', { dtype, device, progress_callback });
        tokenizer = await AutoTokenizer.from_pretrained('kokoro');
        const res = await fetch(VOICE_URL);
        if (!res.ok) throw new Error('voice file missing');
        voiceData = new Float32Array(await res.arrayBuffer());
        phonemize = ph.phonemize;
        Tensor = tf.Tensor;
        ready = true;
        report(1);
        return true;
      } catch (err) {
        console.warn('[kokoro] load failed', err);
        loadPromise = null;
        ready = false;
        return false;
      }
    })();
  }
  return loadPromise.then((ok) => {
    if (ok) report(1);
    return ok;
  });
}

let queue = Promise.resolve();

// Sérialise tous les appels au modèle : jamais deux inférences en même temps.
export function synthesize(text, opts) {
  const run = queue.then(() => doSynthesize(text, opts));
  queue = run.catch(() => {});
  return run;
}

async function doSynthesize(text, { speed = 1 } = {}) {
  if (!ready) return null;
  const t = String(text ?? '').trim();
  if (!t) return null;
  const phonemes = ((await phonemize(t, 'fr-fr')).join(' ')).trim();
  if (!phonemes) return null;
  const { input_ids } = tokenizer(phonemes, { truncation: true });
  const n = Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509);
  const style = voiceData.slice(n * 256, n * 256 + 256);
  const { waveform } = await model({
    input_ids,
    style: new Tensor('float32', style, [1, 256]),
    speed: new Tensor('float32', [speed], [1]),
  });
  return { audio: waveform.data, sampling_rate: SAMPLE_RATE };
}
