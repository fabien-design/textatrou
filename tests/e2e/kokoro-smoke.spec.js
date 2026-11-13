import { test, expect } from '@playwright/test';

test.setTimeout(240000);

test('Kokoro FR: local model load, real synthesis, no external network', async ({ page }) => {
  const errors = [];
  const responses = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => {
    if (/huggingface\.co|cdn\.jsdelivr\.net/.test(r.url())) external.push(r.url());
  });
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

  await page.addInitScript(() => {
    window.__speakCalls = 0;
    window.__buffers = [];
    const ss = window.speechSynthesis;
    const realSpeak = ss && ss.speak ? ss.speak.bind(ss) : null;
    try {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: {
        speak(u) { if (u && u.text) window.__speakCalls++; setTimeout(() => u.onend && u.onend(), 10); },
        cancel() {}, getVoices() { return [{ lang: 'fr-FR', name: 'Test' }]; },
        speaking: false, pending: false, addEventListener() {}, removeEventListener() {},
      } });
    } catch { /* ignore */ }
    void realSpeak;
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    const AC = window.AudioContext || window.webkitAudioContext;
    const origCreate = AC.prototype.createBuffer;
    AC.prototype.createBuffer = function (ch, len, sr) {
      const b = origCreate.call(this, ch, len, sr);
      b.__rec = { length: len, sampleRate: sr, max: 0 };
      window.__buffers.push(b.__rec);
      return b;
    };
    const origCopy = AudioBuffer.prototype.copyToChannel;
    AudioBuffer.prototype.copyToChannel = function (src, ch, off) {
      let m = 0;
      for (let i = 0; i < src.length; i++) { const a = Math.abs(src[i]); if (a > m) m = a; }
      if (this.__rec) this.__rec.max = Math.max(this.__rec.max, m);
      return origCopy.call(this, src, ch, off);
    };
    const origGet = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (ch) {
      const d = origGet.call(this, ch);
      if (this.__rec) this.__rec.data = d;
      return d;
    };
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /nouvelle partie/i }).click();

  // 1. voice preload: progressbar vanishes (or never needed) within 120 s
  await expect(page.getByRole('progressbar', { name: /téléchargement de la voix/i })).toHaveCount(0, { timeout: 120000 });

  const input = page.getByPlaceholder(/ajouter un prénom/i);
  for (const n of ['Alex', 'Sam', 'Léa']) { await input.fill(n); await input.press('Enter'); }

  const ok = (frag) => responses.filter((r) => r.url.includes(frag));
  for (const frag of ['/models/kokoro/', '/ort/']) {
    const rs = ok(frag);
    expect(rs.length, `requests for ${frag}`).toBeGreaterThan(0);
    for (const r of rs) expect(r.status, r.url).toBe(200);
  }

  // 2. launch and wait for real audio
  await page.getByRole('button', { name: /lancer la partie/i }).click();
  await expect(page.getByText(/posez le téléphone au centre/i)).toBeVisible();
  await page.getByRole('button', { name: /c'est parti/i }).click();

  await expect.poll(async () => page.evaluate(() =>
    window.__buffers.some((b) => b.length > 24000 && Math.max(b.max, b.data ? b.data.reduce((m, v) => Math.max(m, Math.abs(v)), 0) : 0) > 0.01)
      ? (window.__speakAtAudio = window.__speakAtAudio ?? window.__speakCalls, true) : false
  ), { timeout: 120000, intervals: [250] }).toBe(true);

  // the first synthesized sentence must not have fallen back to speechSynthesis
  expect(await page.evaluate(() => window.__speakAtAudio)).toBe(0);
  for (const frag of ['/models/kokoro/', '/ort/', '/espeak/']) {
    expect(ok(frag).length, `requests for ${frag}`).toBeGreaterThan(0);
    for (const r of ok(frag)) expect(r.status, r.url).toBe(200);
  }
  expect(external, 'external requests').toEqual([]);
  expect(errors).toEqual([]);
});
