// Télécharge Kokoro-82M (ONNX) et les fichiers wasm d'onnxruntime-web pour un usage hors-ligne.
import { mkdir, writeFile, copyFile, readdir, rm, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/';
const webgpu = process.argv.includes('--webgpu');
const files = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
  ...(webgpu ? ['onnx/model.onnx'] : []),
  'voices/ff_siwis.bin',
];

async function download(rel) {
  const dest = path.join(root, 'public/models/kokoro', rel);
  if (existsSync(dest)) {
    console.log(`= ${rel} (déjà présent)`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(BASE + rel);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const chunks = [];
  let got = 0;
  let last = 0;
  for await (const c of res.body) {
    chunks.push(c);
    got += c.length;
    if (total && Date.now() - last > 1000) {
      last = Date.now();
      console.log(`  ${rel} ${Math.round((got / total) * 100)}%`);
    }
  }
  const tmp = dest + '.part';
  await writeFile(tmp, Buffer.concat(chunks));
  await rename(tmp, dest);
  console.log(`+ ${rel} (${(got / 1048576).toFixed(1)} Mo)`);
}

async function copyOrt() {
  const candidates = [
    'node_modules/onnxruntime-web/dist',
    'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist',
  ].map((p) => path.join(root, p));
  const src = candidates.find((p) => existsSync(p));
  if (!src) throw new Error('onnxruntime-web introuvable (npm install ?)');
  const out = path.join(root, 'public/ort');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  let n = 0;
  for (const f of await readdir(src)) {
    if (/^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(f)) {
      await copyFile(path.join(src, f), path.join(out, f));
      n++;
    }
  }
  console.log(`+ ${n} fichiers copiés dans public/ort/`);
}

async function copyEspeak() {
  const src = path.join(root, 'node_modules/@echogarden/espeak-ng-emscripten');
  if (!existsSync(src)) throw new Error('espeak-ng-emscripten introuvable (npm install ?)');
  const out = path.join(root, 'public/espeak');
  await mkdir(out, { recursive: true });
  for (const f of ['espeak-ng.js', 'espeak-ng.data']) await copyFile(path.join(src, f), path.join(out, f));
  console.log('+ espeak-ng copié dans public/espeak/');
}

let current = '';
try {
  for (const f of files) {
    current = f;
    await download(f);
  }
  await copyOrt();
  await copyEspeak();
} catch (err) {
  console.error(`\nÉchec du téléchargement de « ${current || 'copie des fichiers'} »${current ? ` (${BASE + current})` : ''} : ${err.message}${err.cause ? ` (${err.cause.message || err.cause})` : ''}`);
  console.error('Derrière un proxy, relancez avec NODE_USE_ENV_PROXY=1 (Node >= 22) et au besoin NODE_EXTRA_CA_CERTS=<ca.pem>.');
  console.error("Sans modèle, l'application utilisera la voix système du téléphone.");
  process.exit(1);
}
console.log('Terminé.');
