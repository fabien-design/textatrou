import { test, expect } from '@playwright/test';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });

async function setup(page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__rates = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: {
      speak(u) { setTimeout(() => u.onend && u.onend(), 10); window.__spoken.push(u.text); window.__rates.push(u.rate); },
      cancel() {}, getVoices() { return [{ lang: 'fr-FR', name: 'Test' }]; },
      speaking: false, pending: false, addEventListener() {}, removeEventListener() {},
    } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.SpeechRecognition = class {
      start() { setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: 'Saucisson', confidence: 0.9 }]] }); this.onend && this.onend(); }, 50); }
      stop() { this.onend && this.onend(); }
      abort() { this.onend && this.onend(); }
    };
    window.webkitSpeechRecognition = window.SpeechRecognition;
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  });
  await page.route('**/*huggingface*/**', (r) => r.abort());
  await page.route('**/*.onnx*', (r) => r.abort());
  for (const g of ['**/models/**', '**/ort/**', '**/espeak/**']) await page.route(g, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test('a. lobby slider default, accelerate, persistence', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  const slider = page.getByRole('slider', { name: /vitesse de la voix/i });
  await expect(slider).toHaveValue('1.2');
  const btn = page.getByRole('button', { name: 'Accélérer la voix' });
  for (let i = 0; i < 3; i++) await btn.click();
  await expect(page.getByText('×1.5')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  await expect(page.getByRole('slider', { name: /vitesse de la voix/i })).toHaveValue('1.5');
});

test('b. test speed uses narrateur rate x 1.5', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  const btn = page.getByRole('button', { name: 'Accélérer la voix' });
  for (let i = 0; i < 3; i++) await btn.click();
  await page.evaluate(() => { window.__rates.length = 0; });
  await page.getByRole('button', { name: 'Tester la vitesse' }).click();
  await expect.poll(() => page.evaluate(() => window.__rates.length)).toBeGreaterThan(0);
  const rates = await page.evaluate(() => window.__rates);
  expect(rates[0]).toBeGreaterThan(1.3);
  expect(rates[0]).toBeCloseTo(1.5, 5);
});

test('c. home settings modal shows slider', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await expect(page.getByRole('slider', { name: /vitesse de la voix/i })).toHaveValue('1.2');
});
