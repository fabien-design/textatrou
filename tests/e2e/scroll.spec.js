import { test, expect } from '@playwright/test';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 600 } });

const NAMES = ['Alex', 'Sam', 'Léa', 'Tom', 'Zoé', 'Max'];

async function toLobby(page) {
  for (const g of ['**/models/**', '**/ort/**', '**/espeak/**']) await page.route(g, (r) => r.abort());
  await page.goto('/');
  await page.evaluate((n) => localStorage.setItem('textatrou:players', JSON.stringify(n)), NAMES);
  await page.reload();
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  await page.waitForTimeout(500);
}

test('lobby is taller than the viewport', async ({ page }) => {
  await toLobby(page);
  const tall = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(tall).toBe(true);
});

test('lobby scrolls with mouse wheel', async ({ page }) => {
  await toLobby(page);
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => window.scrollY);
  expect(y > 100).toBe(true);
});

test('lobby scrolls with touch drag', async ({ page }) => {
  await toLobby(page);
  const client = await page.context().newCDPSession(page);
  const send = (type, y) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
  await send('touchStart', 500);
  await page.waitForTimeout(30);
  for (let y = 460; y >= 100; y -= 40) {
    await send('touchMove', y);
    await page.waitForTimeout(20);
  }
  await send('touchEnd', 100);
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => window.scrollY);
  expect(y > 50).toBe(true);
});

test('packs screen scrolls with mouse wheel', async ({ page }) => {
  await toLobby(page);
  await page.getByRole('button', { name: /classique/i }).click();
  await page.waitForTimeout(500);
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => window.scrollY);
  expect(y > 100).toBe(true);
});

test('lobby has no horizontal scroll', async ({ page }) => {
  await toLobby(page);
  const w = await page.evaluate(() => document.documentElement.scrollWidth <= 390);
  expect(w).toBe(true);
});
