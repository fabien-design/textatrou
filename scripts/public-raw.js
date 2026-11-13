import path from 'node:path';

const PREFIX = /^\/(ort|models|espeak)\//;

export function resolvePublicFile(publicDir, url, pathImpl = path) {
  const raw = String(url || '').split(/[?#]/)[0];
  if (!PREFIX.test(raw)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!PREFIX.test(decoded)) return null;
  if (decoded.split(/[\\/]/).includes('..')) return null;
  const root = pathImpl.resolve(publicDir);
  const file = pathImpl.resolve(root, '.' + decoded);
  const rel = pathImpl.relative(root, file);
  if (!rel || rel.startsWith('..') || pathImpl.isAbsolute(rel)) return null;
  return file;
}
