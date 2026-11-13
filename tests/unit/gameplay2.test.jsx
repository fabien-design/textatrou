import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.setConfig({ testTimeout: 20000 });
const h = vi.hoisted(() => ({ releaseSpy: vi.fn() }));

vi.mock('../../src/lib/speech.js', () => ({
  VOICES: [{ id: 'narrateur', name: 'Narrateur', emoji: '🎙️', price: null, model: 'fr_FR-siwis-medium', rate: 1, pitch: 1, effect: null }],
  speak: vi.fn(async () => {}),
  cancelSpeech: vi.fn(),
  listen: vi.fn(async () => 'banane'),
  stopListening: vi.fn(),
  isSttSupported: vi.fn(() => true),
  requestMicPermission: vi.fn(async () => true),
  unlockSpeech: vi.fn(),
  preloadVoice: vi.fn(async () => true),
  isVoiceReady: vi.fn(() => true),
}));
vi.mock('../../src/lib/audio.js', () => ({
  unlockAudio: vi.fn(), playPop: vi.fn(), playJoker: vi.fn(), playBadumTss: vi.fn(),
  playScream: vi.fn(), playApplause: vi.fn(), playBeep: vi.fn(),
}));
vi.mock('../../src/lib/device.js', () => ({
  requestWakeLock: vi.fn(async () => h.releaseSpy),
  shareText: vi.fn(),
}));

import GamePlayScreen from '../../src/screens/GamePlayScreen.jsx';
import * as speech from '../../src/lib/speech.js';
import * as audio from '../../src/lib/audio.js';

const story = {
  id: 't', titre: 'T',
  segments: [
    { texte_avant: 'ZEBULON arrive avec :', trou: { consigne: 'OBJET', categorie_joker: 'objet_masc' } },
    { texte_avant: '. Puis PAPRIKA appelle', trou: { consigne: 'CÉLÉBRITÉ', categorie_joker: 'personne' } },
    { texte_avant: '. Enfin QUOKKA mange', trou: { consigne: 'NOURRITURE', categorie_joker: 'nourriture' } },
    { texte_fin: '. FINALEMENT tout va bien.' },
  ],
};
const jokers = { objet_masc: ['grille-pain'], personne: ['Batman'], nourriture: ['raclette'] };
const players = ['Alex', 'Sam', 'Léa'];

function setup(opts = {}, extra = {}) {
  const onFinish = vi.fn();
  const utils = render(
    <GamePlayScreen
      story={story}
      players={players}
      reader={extra.reader ?? null}
      options={{ readerMode: 'voix', voiceId: 'narrateur', designationAuto: true, timerPression: false, ...opts }}
      jokers={jokers}
      onFinish={onFinish}
    />
  );
  return { onFinish, ...utils };
}
const never = () => new Promise(() => {});
const spokenTexts = () => speech.speak.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  speech.speak.mockImplementation(async () => {});
  speech.listen.mockImplementation(async () => 'banane');
  speech.isSttSupported.mockImplementation(() => true);
});
afterEach(() => { vi.useRealTimers(); });

describe('common', () => {
  test('no textbox in DOM, even after clicking the hole card', async () => {
    speech.listen.mockImplementation(never);
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    const card = await screen.findByTestId('hole-card');
    await userEvent.click(card);
    expect(document.querySelector('input, textarea') === null && screen.queryByRole('textbox') === null).toBe(true);
  });

  test('no soundboard buttons', async () => {
    speech.listen.mockImplementation(never);
    setup();
    await screen.findByTestId('hole-card');
    const names = [/ba-dum tss/i, /suspense/i, /applaudissements/i];
    expect(names.every((n) => screen.queryByRole('button', { name: n }) === null)).toBe(true);
  });

  test('anti-spoiler text hidden before first answer', async () => {
    speech.listen.mockImplementation(never);
    setup();
    await screen.findByTestId('hole-card');
    const t = document.body.textContent;
    expect(['PAPRIKA', 'QUOKKA', 'FINALEMENT'].some((w) => t.includes(w))).toBe(false);
  });

  test('locked segments are blurred and aria-hidden', async () => {
    speech.listen.mockImplementation(never);
    setup();
    await screen.findByTestId('hole-card');
    const els = [...document.querySelectorAll('[data-testid="locked-segment"]')];
    const ok = els.length > 0 && els.every((e) =>
      ['blur-xl', 'select-none', 'opacity-40', 'pointer-events-none'].every((c) => e.classList.contains(c)) &&
      e.getAttribute('aria-hidden') === 'true');
    expect(ok).toBe(true);
  });

  test('hole card shows consigne', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const card = await screen.findByTestId('hole-card');
    expect(card.textContent.includes('OBJET')).toBe(true);
  });

  test('hole card shows designated player with designationAuto', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const card = await screen.findByTestId('hole-card');
    expect(/C'est à (Alex|Sam|Léa)/.test(card.textContent)).toBe(true);
  });

  test('hole card is vivid (bg-coral, no animate-pulse)', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const card = await screen.findByTestId('hole-card');
    expect(card.className.includes('bg-coral') && !card.className.includes('animate-pulse')).toBe(true);
  });

  test('answer pill has no space before the following period', async () => {
    setup();
    const pill = await screen.findByTestId('answer-pill', {}, { timeout: 4000 });
    expect(pill.parentElement.textContent.includes('banane.') && !pill.parentElement.textContent.includes('banane .')).toBe(true);
  });
});

describe('voix mode', () => {
  test('speaks first segment, then announcement, then listens', async () => {
    setup();
    await waitFor(() => expect(speech.listen).toHaveBeenCalled(), { timeout: 4000 });
    const t = spokenTexts();
    const iSeg = t.findIndex((x) => x.includes('ZEBULON arrive avec'));
    const iAnn = t.findIndex((x) => x.includes('OBJET') && x.includes("C'est à"));
    expect(iSeg >= 0 && iAnn > iSeg).toBe(true);
  });

  test('speech order precedes listen call', async () => {
    const order = [];
    speech.speak.mockImplementation(async (txt) => { order.push('speak:' + txt); });
    speech.listen.mockImplementation(async () => { order.push('listen'); return 'banane'; });
    setup();
    await waitFor(() => expect(order.includes('listen')).toBe(true), { timeout: 4000 });
    const iL = order.indexOf('listen');
    const iAnn = order.findIndex((x) => x.includes('OBJET') && x.includes("C'est à"));
    expect(iAnn >= 0 && iAnn < iL).toBe(true);
  });

  test('designated players are valid and never repeat consecutively', async () => {
    const { onFinish } = setup();
    await waitFor(() => expect(onFinish).not.toHaveBeenCalled() && screen.getByRole('button', { name: /fin de l'histoire/i }), { timeout: 8000 });
    const names = spokenTexts()
      .map((x) => x.match(/C'est à (\S+)/))
      .filter(Boolean)
      .map((m) => m[1].replace(/[.,!:]$/, ''));
    const valid = names.length === 3 && names.every((n) => players.includes(n));
    const noRepeat = names.every((n, i) => i === 0 || n !== names[i - 1]);
    expect(valid && noRepeat).toBe(true);
  });

  test('after listen resolves, pill appears and sentence is NOT re-read; next segment follows', async () => {
    setup();
    await screen.findByTestId('answer-pill', {}, { timeout: 4000 });
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('PAPRIKA appelle'))).toBe(true), { timeout: 4000 });
    expect(spokenTexts().some((x) => x.includes('banane'))).toBe(false);
  });

  test('flow continues automatically to next hole', async () => {
    setup();
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('PAPRIKA appelle'))).toBe(true), { timeout: 8000 });
  });

  test('no word: retry, joker and skip buttons shown', async () => {
    speech.listen.mockImplementationOnce(async () => null);
    setup();
    await screen.findByRole('button', { name: /réessayer/i }, { timeout: 4000 });
    expect(screen.queryByRole('button', { name: /mot joker/i }) !== null && screen.queryByRole('button', { name: /passer/i }) !== null).toBe(true);
  });

  test('retry calls listen again', async () => {
    speech.listen.mockImplementationOnce(async () => null);
    setup();
    const btn = await screen.findByRole('button', { name: /réessayer/i }, { timeout: 4000 });
    const before = speech.listen.mock.calls.length;
    await userEvent.click(btn);
    await waitFor(() => expect(speech.listen.mock.calls.length).toBeGreaterThan(before));
  });

  test('skip validates without word', async () => {
    speech.listen.mockImplementationOnce(async () => null);
    speech.listen.mockImplementation(never);
    setup();
    const btn = await screen.findByRole('button', { name: /passer/i }, { timeout: 4000 });
    await userEvent.click(btn);
    const pill = await screen.findByTestId('answer-pill');
    expect(pill.textContent.includes('✓') && pill.textContent.includes('OBJET')).toBe(true);
  });

  test('joker click plays joker sound and speaks joker word', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const btn = await screen.findByRole('button', { name: /mot joker/i }, { timeout: 4000 });
    await userEvent.click(btn);
    await waitFor(() => expect(audio.playJoker).toHaveBeenCalled());
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('grille-pain'))).toBe(true), { timeout: 4000 });
  });

  test('joker pill is flagged data-joker', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const btn = await screen.findByRole('button', { name: /mot joker/i }, { timeout: 4000 });
    await userEvent.click(btn);
    const pill = await screen.findByTestId('answer-pill');
    expect(pill.getAttribute('data-joker') === 'true' && pill.textContent.includes('grille-pain')).toBe(true);
  });

  test('end: texte_fin visible and finish button present', async () => {
    setup();
    await screen.findByRole('button', { name: /fin de l'histoire/i }, { timeout: 10000 });
    expect(document.body.textContent.includes('FINALEMENT tout va bien')).toBe(true);
  });

  test('finish calls onFinish once with 3 answers in order', async () => {
    const { onFinish } = setup();
    const btn = await screen.findByRole('button', { name: /fin de l'histoire/i }, { timeout: 10000 });
    await userEvent.click(btn);
    const a = onFinish.mock.calls[0]?.[0];
    expect(onFinish.mock.calls.length === 1 && Array.isArray(a) && a.length === 3 &&
      a.every((x) => x.word === 'banane' && !x.joker)).toBe(true);
  });

  test('cancelSpeech and stopListening on unmount', async () => {
    speech.listen.mockImplementation(never);
    const { unmount } = setup();
    await screen.findByTestId('hole-card');
    vi.clearAllMocks();
    unmount();
    expect(speech.cancelSpeech.mock.calls.length > 0 && speech.stopListening.mock.calls.length > 0).toBe(true);
  });
});

describe('joueur mode', () => {
  test('does not speak automatically on mount', async () => {
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    await screen.findByTestId('hole-card');
    await new Promise((r) => setTimeout(r, 300));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  test('clicking card listens, pill appears, next hole active', async () => {
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    await userEvent.click(await screen.findByTestId('hole-card'));
    await waitFor(() => expect(speech.listen).toHaveBeenCalled());
    const pill = await screen.findByTestId('answer-pill');
    expect(pill.textContent.includes('banane')).toBe(true);
    await waitFor(() => expect(screen.getByTestId('hole-card').textContent.includes('CÉLÉBRITÉ')).toBe(true));
  });

  test('designated name is never the reader', async () => {
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    const seen = [];
    for (let i = 0; i < 3; i++) {
      const card = await screen.findByTestId('hole-card');
      seen.push(card.textContent);
      await userEvent.click(card);
      await waitFor(() => expect(screen.getAllByTestId('answer-pill').length).toBe(i + 1));
      if (i < 2) await waitFor(() => expect(screen.getByTestId('hole-card').textContent).not.toBe(seen[i]));
    }
    expect(seen.every((t) => /C'est à (Sam|Léa)/.test(t) && !t.includes('Alex'))).toBe(true);
  });

  test('STT unsupported: card click does not listen', async () => {
    speech.isSttSupported.mockImplementation(() => false);
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    await userEvent.click(await screen.findByTestId('hole-card'));
    expect(speech.listen).not.toHaveBeenCalled();
  });

  test('STT unsupported: help message mentions micro', async () => {
    speech.isSttSupported.mockImplementation(() => false);
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    await userEvent.click(await screen.findByTestId('hole-card'));
    expect((await screen.findAllByText(/micro/i)).length > 0).toBe(true);
  });

  test('STT unsupported: joker and skip buttons present and joker works', async () => {
    speech.isSttSupported.mockImplementation(() => false);
    setup({ readerMode: 'joueur' }, { reader: 'Alex' });
    await userEvent.click(await screen.findByTestId('hole-card'));
    const skip = screen.queryByRole('button', { name: /passer/i });
    const joker = await screen.findByRole('button', { name: /mot joker/i });
    await userEvent.click(joker);
    const pill = await screen.findByTestId('answer-pill');
    expect(skip !== null && pill.getAttribute('data-joker') === 'true').toBe(true);
  });
});

describe('timer', () => {
  test('timer shows 15 at start', async () => {
    speech.listen.mockImplementation(never);
    setup({ timerPression: true });
    const t = await screen.findByTestId('timer', {}, { timeout: 4000 });
    expect(t.textContent.includes('15')).toBe(true);
  });

  test('after 15s beep plays and joker is injected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    speech.listen.mockImplementation(never);
    setup({ timerPression: true });
    await screen.findByTestId('timer', {}, { timeout: 4000 });
    await act(async () => { await vi.advanceTimersByTimeAsync(16000); });
    await waitFor(() => expect(audio.playBeep).toHaveBeenCalled());
    const pill = await screen.findByTestId('answer-pill');
    expect(pill.getAttribute('data-joker') === 'true' && pill.textContent.includes('grille-pain')).toBe(true);
  });
});
