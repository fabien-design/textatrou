// Phonémisation française via eSpeak-NG (wasm), exposée sous l'interface de `phonemizer`.
// Les fichiers espeak sont servis localement depuis /espeak/ (copiés par `npm run fetch-model`).
const ESPEAK_URL = '/espeak/espeak-ng.js';
const VOCAB_URL = '/models/kokoro/tokenizer.json';

let workerPromise = null;
let vocabPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod = await import(/* @vite-ignore */ ESPEAK_URL);
      const m = await mod.default();
      const w = new m.eSpeakNGWorker();
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

function getVocab() {
  if (!vocabPromise) {
    vocabPromise = fetch(VOCAB_URL)
      .then((r) => r.json())
      .then((j) => new Set(Object.keys(j?.model?.vocab || {})))
      .catch(() => {
        vocabPromise = null;
        return null;
      });
  }
  return vocabPromise;
}

// Retourne un tableau de chaînes IPA, comme `phonemizer`.
export async function phonemize(text, lang = 'fr-fr') {
  const w = await getWorker();
  const vocab = await getVocab();
  w.set_voice(lang === 'fr-fr' ? 'fr' : lang, '');
  const out = [];
  // Découpe aux ponctuations pour les conserver (la prosodie de Kokoro en dépend).
  const parts = String(text).split(/([,.!?…;:«»"]+)/);
  let acc = '';
  for (const part of parts) {
    if (!part) continue;
    if (/^[,.!?…;:«»"]+$/.test(part)) {
      acc = acc.trimEnd() + part + ' ';
      continue;
    }
    if (!part.trim()) continue;
    const r = w.synthesize_ipa(part.replace(/\s+/g, ' ').trim());
    const ipa = String(r?.ipa || '').replace(/_/g, '').replace(/\s*\n\s*/g, ' ').trim();
    acc += ipa;
  }
  let res = acc.trim();
  if (vocab) {
    res = Array.from(res).filter((c) => vocab.has(c) || c === ' ').join('');
  }
  out.push(res.replace(/\s+/g, ' ').trim());
  return out;
}
