import { test, expect } from '@playwright/test';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });

const CONSIGNES = ['OBJET', 'NOMBRE', 'CÉLÉBRITÉ', 'ANIMAL', 'LIEU', 'ADJECTIF', 'VERBE', 'NOURRITURE', 'PARTIE DU CORPS', 'MÉTIER'];
const NAMES = ['Alex', 'Sam', 'Léa'];

async function setup(page, { word = 'Saucisson' } = {}) {
  await page.addInitScript((w) => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: {
      speak(u) { setTimeout(() => u.onend && u.onend(), 10); window.__spoken = (window.__spoken || []).concat(u.text); },
      cancel() {}, getVoices() { return [{ lang: 'fr-FR', name: 'Test' }]; },
      speaking: false, pending: false, addEventListener() {}, removeEventListener() {},
    } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.SpeechRecognition = class {
      start() {
        setTimeout(() => {
          const x = window.__nextWord;
          if (x) this.onresult && this.onresult({ results: [[{ transcript: x, confidence: 0.9 }]] });
          else this.onerror && this.onerror({ error: 'no-speech' });
          this.onend && this.onend();
        }, 50);
      }
      stop() { this.onend && this.onend(); }
      abort() { this.onend && this.onend(); }
    };
    window.webkitSpeechRecognition = window.SpeechRecognition;
    window.__nextWord = w;
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
  }, word);
  await page.route('**/*huggingface*/**', (r) => r.abort());
  await page.route('**/*.onnx*', (r) => r.abort());
  for (const g of ['**/models/**', '**/ort/**', '**/espeak/**']) await page.route(g, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function toLobby(page, { addPlayers = true } = {}) {
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  if (addPlayers) {
    const input = page.getByPlaceholder(/ajouter un prénom/i);
    for (const n of NAMES) { await input.fill(n); await input.press('Enter'); }
  }
}

async function launchVoice(page) {
  await toLobby(page);
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await expect(page.getByText(/posez le téléphone au centre/i)).toBeVisible();
  await page.getByRole('button', { name: /c'est parti/i }).click();
}

async function toEnd(page) {
  await launchVoice(page);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click({ timeout: 30000 });
  await expect(page.getByText(/histoire terminée/i)).toBeVisible();
}

test('1. no soundboard & no keyboard during play', async ({ page }) => {
  await setup(page);
  await launchVoice(page);
  await expect(page.getByTestId('hole-card')).toBeVisible();
  for (const n of [/ba-dum tss/i, /suspense/i, /applaudissements/i]) {
    await expect(page.getByRole('button', { name: n })).toHaveCount(0);
  }
  await expect(page.locator('input, textarea')).toHaveCount(0);
});

test('2. anti-spoiler & simplified consigne', async ({ page }) => {
  await setup(page, { word: null });
  await launchVoice(page);
  const card = page.getByTestId('hole-card');
  await expect(card).toBeVisible();
  const consigne = await card.getAttribute('aria-label');
  expect(CONSIGNES).toContain(consigne);
  expect(consigne).not.toMatch(/[(+]/);
  const seg = page.getByTestId('locked-segment').first();
  await expect(seg).toBeAttached();
  const filter = await seg.evaluate((e) => getComputedStyle(e).filter);
  expect(filter).toMatch(/blur/);
});

test('3. voice mode hands-free', async ({ page }) => {
  await setup(page);
  await toEnd(page);
  const spoken = await page.evaluate(() => window.__spoken);
  expect(spoken.some((t) => t.includes('Saucisson'))).toBe(true);
  await expect(page.getByTestId('recap-word').filter({ hasText: 'Saucisson' }).first()).toBeVisible();
});

test('4. editable recap', async ({ page }) => {
  await setup(page);
  await toEnd(page);
  await page.getByTestId('recap-word').first().click();
  await page.getByRole('button', { name: /écrire/i }).click();
  const input = page.getByRole('dialog').locator('input').first();
  await input.fill('Pantoufle');
  await input.press('Enter');
  await expect(page.getByTestId('recap-word').filter({ hasText: 'Pantoufle' })).toHaveCount(1);
  await page.getByRole('button', { name: /écouter l'histoire/i }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken.some((t) => t.includes('Pantoufle')))).toBe(true);
});

test('5. no word heard: retry / joker / pass', async ({ page }) => {
  await setup(page, { word: null });
  await launchVoice(page);
  await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /mot joker/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /passer/i })).toBeVisible();
  await page.getByRole('button', { name: /mot joker/i }).click();
  await expect(page.locator('[data-joker="true"]').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-testid="answer-pill"][data-joker="true"]').first()).toBeVisible({ timeout: 20000 });
});

test('6. player mode', async ({ page }) => {
  await setup(page);
  await toLobby(page);
  await page.getByRole('radio', { name: /un joueur/i }).check({ force: true });
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await expect(page.getByText(/à toi de lire/i)).toBeVisible();
  const readerRaw = (await page.locator('div.bg-cyan').first().innerText()).trim();
  const reader = NAMES.find((n) => n.toLowerCase() === readerRaw.toLowerCase());
  expect(reader).toBeTruthy();
  await page.getByRole('button', { name: /je suis prêt/i }).click();
  const card = page.getByTestId('hole-card');
  await expect(card).toBeVisible();
  const txt = await card.innerText();
  const m = txt.match(/C'est à (\S+)/);
  if (m) expect(m[1]).not.toBe(reader);
  await card.click({ force: true });
  await expect(page.getByTestId('answer-pill').filter({ hasText: 'Saucisson' }).first()).toBeVisible({ timeout: 15000 });
});

test('7. shop voices', async ({ page }) => {
  await setup(page);
  await toLobby(page);
  await page.getByText('PACK SÉLECTIONNÉ').locator('xpath=following-sibling::button').click();
  await expect(page.getByRole('heading', { name: 'VOIX' })).toBeVisible();
  await expect(page.getByText('Robot', { exact: true })).toBeVisible();
  await expect(page.getByText('Toutes les voix')).toBeVisible();
  await expect(page.getByText('2,49 €')).toBeVisible();
  const card = page.getByRole('button', { name: 'Écouter Robot' }).locator("xpath=ancestor::div[.//button[normalize-space()=\"Simuler l'achat MVP\"]][1]");
  await card.getByRole('button', { name: /simuler l'achat/i }).click();
  await page.getByRole('button', { name: /retour/i }).click();
  await expect(page.getByRole('radio', { name: /Robot/ })).toBeEnabled();
});

test('8. persistence', async ({ page }) => {
  await setup(page);
  await toLobby(page);
  await page.getByRole('radio', { name: /un joueur/i }).check({ force: true });
  await page.reload();
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  for (const n of NAMES) await expect(page.getByRole('button', { name: `Retirer ${n}` })).toBeVisible();
  await expect(page.getByRole('radio', { name: /un joueur/i })).toBeChecked();
});

test('9. mobile layout & no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setup(page);
  const w = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await w()).toBeLessThanOrEqual(390);
  await toLobby(page);
  expect(await w()).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await page.getByRole('button', { name: /c'est parti/i }).click();
  await expect(page.getByTestId('hole-card')).toBeVisible();
  expect(await w()).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click({ timeout: 30000 });
  await expect(page.getByText(/histoire terminée/i)).toBeVisible();
  expect(await w()).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
