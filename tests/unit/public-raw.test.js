import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolvePublicFile } from '../../scripts/public-raw.js';

const norm = (p, impl) => impl.normalize(p);

describe('resolvePublicFile (Windows, path.win32)', () => {
  it('maps /ort/ under a forward-slash publicDir to an absolute file path', () => {
    const r = resolvePublicFile('C:/Users/fabie/proj/public', '/ort/ort-wasm-simd-threaded.jsep.mjs', path.win32);
    const expected = norm('C:\\Users\\fabie\\proj\\public\\ort\\ort-wasm-simd-threaded.jsep.mjs', path.win32);
    const ok = typeof r === 'string' && norm(r, path.win32) === expected;
    expect(ok).toBe(true);
  });

  it('maps /models/ under a backslash publicDir to an absolute file path', () => {
    const r = resolvePublicFile('C:\\Users\\fabie\\proj\\public', '/models/kokoro/config.json', path.win32);
    const expected = norm('C:\\Users\\fabie\\proj\\public\\models\\kokoro\\config.json', path.win32);
    const ok = typeof r === 'string' && norm(r, path.win32) === expected;
    expect(ok).toBe(true);
  });

  it('ignores the query string for /espeak/ URLs', () => {
    const r = resolvePublicFile('C:/Users/fabie/proj/public', '/espeak/espeak-ng.js?v=123', path.win32);
    const ok = typeof r === 'string' && norm(r, path.win32).endsWith('espeak-ng.js');
    expect(ok).toBe(true);
  });

  it('rejects a /ort/ traversal segment written with backslashes', () => {
    const r = resolvePublicFile('C:/Users/fabie/proj/public', '/ort/..\\..\\x', path.win32);
    expect(r === null).toBe(true);
  });

  it('rejects a percent-encoded traversal under /models/', () => {
    const r = resolvePublicFile('C:/Users/fabie/proj/public', '/models/%2e%2e/%2e%2e/x', path.win32);
    expect(r === null).toBe(true);
  });

  it('rejects a plain traversal under /ort/', () => {
    const r = resolvePublicFile('C:/Users/fabie/proj/public', '/ort/../../secret.txt', path.win32);
    expect(r === null).toBe(true);
  });
});

describe('resolvePublicFile (POSIX, path.posix)', () => {
  it('maps /ort/ to publicDir + /ort/<file> exactly', () => {
    const r = resolvePublicFile('/home/u/p/public', '/ort/a.wasm', path.posix);
    expect(r === '/home/u/p/public/ort/a.wasm').toBe(true);
  });

  it('rejects a plain traversal under /ort/', () => {
    const r = resolvePublicFile('/home/u/p/public', '/ort/../../secret.txt', path.posix);
    expect(r === null).toBe(true);
  });

  it('rejects a percent-encoded traversal under /models/', () => {
    const r = resolvePublicFile('/home/u/p/public', '/models/%2e%2e/%2e%2e/x', path.posix);
    expect(r === null).toBe(true);
  });

  it('decodes percent-encoded file names', () => {
    const r = resolvePublicFile('/home/u/p/public', '/models/kokoro/a%20b.bin', path.posix);
    const ok = typeof r === 'string' && r.endsWith('a b.bin');
    expect(ok).toBe(true);
  });
});

describe('resolvePublicFile (other prefixes)', () => {
  it.each(['/src/main.jsx', '/', '/ortx/a.js'])('returns null for %s', (url) => {
    const r = resolvePublicFile('/home/u/p/public', url, path.posix);
    expect(r === null).toBe(true);
  });
});
