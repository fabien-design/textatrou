import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok   - ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL - ${name}: ${e.message}`);
  }
}

const p = (...s) => path.join(root, ...s);
const exists = (f) => fs.existsSync(p(f));
const read = (f) => {
  assert.ok(exists(f), `${f} does not exist`);
  return fs.readFileSync(p(f), 'utf8');
};
const has = (text, sub, label) => assert.ok(text.includes(sub), `${label} must contain ${sub}`);
const hasI = (text, sub, label) =>
  assert.ok(text.toLowerCase().includes(sub.toLowerCase()), `${label} must contain ${sub} (case-insensitive)`);

// package.json
let pkg = {};
check('package.json exists and parses', () => {
  pkg = JSON.parse(read('package.json'));
});
check('package.json name is "textatrou"', () => assert.strictEqual(pkg.name, 'textatrou'));
check('package.json type is "module"', () => assert.strictEqual(pkg.type, 'module'));
for (const s of ['dev', 'build', 'preview', 'test', 'e2e']) {
  check(`package.json has script "${s}"`, () => assert.ok(pkg.scripts && pkg.scripts[s], `missing script ${s}`));
}
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const d of [
  'react', 'react-dom', 'vite', 'tailwindcss', '@tailwindcss/vite', 'vite-plugin-pwa',
  'vitest', '@testing-library/react', 'jsdom', '@playwright/test',
]) {
  check(`package.json has dependency ${d}`, () => assert.ok(deps[d], `missing dependency ${d}`));
}
check('@playwright/test version contains 1.63.0', () =>
  assert.ok(String(deps['@playwright/test'] || '').includes('1.63.0'), `got ${deps['@playwright/test']}`));
check('dev script contains --host', () =>
  assert.ok(String(pkg.scripts?.dev || '').includes('--host'), `got ${pkg.scripts?.dev}`));

// index.html
check('index.html has <title>TEXTATROU</title>', () => has(read('index.html'), '<title>TEXTATROU</title>', 'index.html'));
check('index.html has html lang="fr"', () =>
  assert.match(read('index.html'), /<html[^>]*\blang=["']fr["']/i, 'index.html needs <html lang="fr">'));
check('index.html has meta viewport', () =>
  assert.match(read('index.html'), /<meta[^>]*name=["']viewport["']/i, 'index.html needs meta viewport'));
check('index.html has Google Fonts link', () => {
  const h = read('index.html');
  has(h, 'fonts.googleapis.com', 'index.html');
  has(h, 'Fredoka', 'index.html');
  has(h, 'Plus+Jakarta+Sans', 'index.html');
});
check('index.html references /src/main.jsx', () => has(read('index.html'), '/src/main.jsx', 'index.html'));

// vite config
check('vite.config.js imports @tailwindcss/vite', () => has(read('vite.config.js'), '@tailwindcss/vite', 'vite.config.js'));
check('vite.config.js imports vite-plugin-pwa', () => has(read('vite.config.js'), 'vite-plugin-pwa', 'vite.config.js'));
for (const k of ['name', 'short_name']) {
  check(`vite.config.js manifest ${k} is TEXTATROU`, () =>
    assert.match(read('vite.config.js'), new RegExp(`\\b${k}\\s*:\\s*['"]TEXTATROU['"]`), `manifest ${k}: 'TEXTATROU' missing`));
}
check('vite.config.js has #FFFDF7 background_color', () => hasI(read('vite.config.js'), '#FFFDF7', 'vite.config.js'));
check('vite.config.js has #FFD166 theme_color', () => hasI(read('vite.config.js'), '#FFD166', 'vite.config.js'));
check('vitest config uses jsdom (vite.config.js or vitest.config.js)', () => {
  const ok = ['vite.config.js', 'vitest.config.js'].some((f) => exists(f) && read(f).includes('jsdom'));
  assert.ok(ok, 'jsdom not found in vite.config.js or vitest.config.js');
});

// index.css
let css = '';
check('src/index.css exists', () => {
  css = read('src/index.css');
});
check('index.css imports tailwindcss', () =>
  assert.match(css, /@import\s+["']tailwindcss["']/, 'missing @import "tailwindcss"'));
check('index.css has @theme block', () => assert.match(css, /@theme\b/, 'missing @theme block'));
const colors = {
  cream: '#FFFDF7', ink: '#1A1A1A', sun: '#FFD166', coral: '#FF6B6B',
  mint: '#06D6A0', cyan: '#118AB2', grape: '#9B5DE5',
};
for (const [n, v] of Object.entries(colors)) {
  check(`index.css --color-${n} is ${v}`, () =>
    assert.match(css, new RegExp(`--color-${n}\\s*:\\s*${v}\\b`, 'i'), `--color-${n}: ${v} missing`));
}
check('index.css --font-display contains Fredoka', () =>
  assert.match(css, /--font-display\s*:[^;]*Fredoka/i, '--font-display with Fredoka missing'));
check('index.css --font-body contains Plus Jakarta Sans', () =>
  assert.match(css, /--font-body\s*:[^;]*Plus Jakarta Sans/i, '--font-body with Plus Jakarta Sans missing'));
check('index.css --shadow-brutal has 4px 4px 0 and #1A1A1A', () =>
  assert.match(css, /--shadow-brutal\s*:[^;]*4px 4px 0[^;]*#1A1A1A/i, '--shadow-brutal "4px 4px 0 ... #1A1A1A" missing'));

// files
for (const f of ['src/main.jsx', 'src/App.jsx', 'tests/setup.js', 'playwright.config.js']) {
  check(`${f} exists`, () => assert.ok(exists(f), `${f} does not exist`));
}
check('playwright.config.js contains 390 and 844', () => {
  const t = read('playwright.config.js');
  has(t, '390', 'playwright.config.js');
  has(t, '844', 'playwright.config.js');
});
check('public/ contains an icon (png or svg)', () => {
  assert.ok(exists('public'), 'public/ does not exist');
  const files = fs.readdirSync(p('public'));
  assert.ok(files.some((f) => /\.(png|svg)$/i.test(f)), `no png/svg in public/ (found: ${files.join(', ') || 'nothing'})`);
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll scaffold checks passed');
