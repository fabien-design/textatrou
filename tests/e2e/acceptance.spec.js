import { test, expect } from '@playwright/test';

async function fresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('TEXTATROU').first()).toBeVisible();
}

async function addPlayers(page, names) {
  const input = page.getByPlaceholder(/prénom/i);
  for (const n of names) {
    await input.fill(n);
    await input.press('Enter');
  }
}

async function openLobby(page) {
  await page.getByRole('button', { name: /nouvelle partie/i }).click();
  await expect(page.getByPlaceholder(/prénom/i)).toBeVisible();
}

async function startGame(page, names = ['Alex', 'Sam', 'Léa']) {
  await fresh(page);
  await openLobby(page);
  await addPlayers(page, names);
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await expect(page.getByText(/à toi de lire/i)).toBeVisible();
}

async function ready(page) {
  await page.getByRole('button', { name: /je suis prêt/i }).click();
  await expect(page.getByTestId('hole-card')).toBeVisible();
}

async function playAll(page) {
  const card = page.getByTestId('hole-card');
  for (let i = 0; i < 60; i++) {
    if (!(await card.count())) break;
    await card.click();
    await page.getByRole('button', { name: /passer/i }).click();
  }
  await expect(page.getByRole('button', { name: /fin de l'histoire/i })).toBeVisible();
}

async function noHScroll(page) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    root: document.getElementById('root').firstElementChild.getBoundingClientRect().width,
  }));
  expect(m.sw).toBeLessThanOrEqual(390);
  expect(m.root).toBeLessThanOrEqual(448);
}

test('1. anti-spoiler', async ({ page }) => {
  await startGame(page);
  await ready(page);
  const segs = page.getByTestId('locked-segment');
  const n = await segs.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const f = await segs.nth(i).evaluate((e) => getComputedStyle(e).filter);
    expect(f).toContain('blur');
  }
  const before = await page.evaluate(() => document.documentElement.outerHTML);
  const cardText = await page.getByTestId('hole-card').innerText();
  await page.getByTestId('hole-card').click();
  await page.getByRole('button', { name: /passer/i }).click();
  await expect(segs).toHaveCount(n - 1);
  const revealed = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="hole-card"]');
    const prev = card?.previousElementSibling ?? card?.previousSibling;
    return (prev?.textContent ?? '').trim();
  });
  expect(revealed.length).toBeGreaterThan(5);
  expect(before.includes(revealed)).toBe(false);
  expect(cardText.length).toBeGreaterThan(0);
});

test('2. reader rotation', async ({ page }) => {
  await startGame(page);
  await expect(page.getByText('Alex', { exact: true }).first()).toBeVisible();
  await ready(page);
  await playAll(page);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click();
  await expect(page.getByText(/histoire terminée/i)).toBeVisible();
  const unlocked = page.locator('button', { hasText: /ON ENCHAÎNE/i }).or(page.locator('button:not(:has-text("🔒")):has(span.text-4xl)'));
  await unlocked.first().click();
  await expect(page.getByText(/à toi de lire/i)).toBeVisible();
  await expect(page.getByText('Sam', { exact: true })).toBeVisible();
  await ready(page);
  await playAll(page);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click();
  await page.locator('button:not(:has-text("🔒")):has(span.text-4xl)').first().click();
  await expect(page.getByText('Léa', { exact: true })).toBeVisible();
});

test('3. persistence & injection', async ({ page }) => {
  await fresh(page);
  await openLobby(page);
  await addPlayers(page, ['Zoé', 'Marius', 'Inès']);
  await page.reload();
  await openLobby(page);
  for (const n of ['Zoé', 'Marius', 'Inès']) {
    await expect(page.getByRole('button', { name: `Retirer ${n}` })).toBeVisible();
  }
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await ready(page);
  const txt = await page.getByTestId('hole-card').innerText();
  expect(txt).toContain("C'est à");
  expect(/C'est à (Marius|Inès)/.test(txt)).toBe(true);
  expect(await page.content()).not.toContain('{JOUEUR_RANDOM}');
});

test('4. options & min players', async ({ page }) => {
  await fresh(page);
  await openLobby(page);
  await addPlayers(page, ['Alex', 'Sam']);
  const launch = page.getByRole('button', { name: /lancer la partie/i });
  await expect(launch).toBeDisabled();
  await addPlayers(page, ['Léa']);
  await expect(launch).toBeEnabled();
  await page.getByRole('switch', { name: /désignation auto/i }).click();
  await page.getByRole('switch', { name: /timer/i }).click();
  await launch.click();
  await ready(page);
  const card = page.getByTestId('hole-card');
  await expect(card).not.toContainText("C'est à");
  await expect(page.getByTestId('timer')).toBeVisible();
  await expect(card).toHaveAttribute('data-joker', 'true', { timeout: 20000 });
});

test('5. word input & recap', async ({ page }) => {
  await startGame(page);
  await ready(page);
  await page.getByTestId('hole-card').click();
  await page.getByLabel('Mot dit').fill('Saucisson');
  await page.getByLabel('Mot dit').press('Enter');
  await expect(page.getByTestId('answer-pill').filter({ hasText: 'Saucisson' })).toBeVisible();
  await playAll(page);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click();
  await expect(page.getByTestId('recap-word').filter({ hasText: 'Saucisson' })).toBeVisible();
});

test('6. soundboard', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  await ready(page);
  const card = page.getByTestId('hole-card');
  const before = await card.innerText();
  for (const n of ['Ba-dum Tss', 'Suspense', 'Applaudissements']) {
    await page.getByRole('button', { name: n }).click();
  }
  await page.waitForTimeout(300);
  expect(await card.innerText()).toBe(before);
  expect(errors).toEqual([]);
});

test('7. mobile layout', async ({ page }) => {
  await fresh(page);
  await noHScroll(page);
  await openLobby(page);
  await addPlayers(page, ['Alex', 'Sam', 'Léa']);
  await noHScroll(page);
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await ready(page);
  await noHScroll(page);
  await playAll(page);
  await page.getByRole('button', { name: /fin de l'histoire/i }).click();
  await expect(page.getByText(/histoire terminée/i)).toBeVisible();
  await noHScroll(page);
});
