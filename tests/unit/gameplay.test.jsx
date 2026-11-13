import React from 'react';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const releaseSpy = vi.fn();

vi.mock('../../src/lib/audio.js', () => ({
  unlockAudio: vi.fn(),
  playPop: vi.fn(),
  playJoker: vi.fn(),
  playBadumTss: vi.fn(),
  playScream: vi.fn(),
  playApplause: vi.fn(),
  playBeep: vi.fn(),
}));
vi.mock('../../src/lib/device.js', () => ({
  requestWakeLock: vi.fn(() => Promise.resolve(releaseSpy)),
  shareText: vi.fn(),
}));

import * as audio from '../../src/lib/audio.js';
import * as device from '../../src/lib/device.js';
import GamePlayScreen from '../../src/screens/GamePlayScreen.jsx';

const SEG0 = 'Au matin ZEBULON est arrivé avec un';
const SEG1 = 'puis PAPRIKA a crié devant un';
const SEG2 = 'et ensuite QUOKKA a mangé';
const FIN = 'FINALEMENT tout le monde est rentré.';

const story = {
  id: 'fixture_01',
  titre: 'Histoire de test',
  segments: [
    { texte_avant: SEG0, trou: { consigne: 'UN OBJET (MASCULIN)', categorie_joker: 'objet_masc' } },
    { texte_avant: SEG1, trou: { consigne: 'UN NOMBRE ET UNE MONNAIE', categorie_joker: 'nombre' } },
    { texte_avant: SEG2, trou: { consigne: 'UN ANIMAL SAUVAGE', categorie_joker: 'animal' } },
    { texte_fin: FIN },
  ],
};
const jokers = { objet_masc: ['grille-pain'], animal: ['lama'], nombre: ['douze'] };
const players = ['Alex', 'Sam', 'Léa'];

function setup(opts = {}, extra = {}) {
  const onFinish = vi.fn();
  const utils = render(
    <GamePlayScreen
      story={story}
      players={players}
      reader="Alex"
      options={{ designationAuto: true, timerPression: false, ...opts }}
      jokers={jokers}
      onFinish={onFinish}
      {...extra}
    />
  );
  return { onFinish, ...utils };
}

const body = () => document.body.textContent;
const card = () => screen.getByTestId('hole-card');
const designated = () => (card().textContent.match(/C'est à\s+(Alex|Sam|Léa)/) || [])[1];

async function answer(user, word) {
  await user.click(card());
  const input = screen.getByLabelText('Mot dit');
  await user.type(input, `${word}{Enter}`);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('GamePlayScreen', () => {
  it('header shows the reader name', () => {
    setup();
    expect(body().includes('Alex')).toBe(true);
  });

  it('Ba-dum Tss button plays badumtss', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ba-dum Tss' }));
    expect(audio.playBadumTss).toHaveBeenCalled();
  });

  it('Suspense button plays scream', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Suspense' }));
    expect(audio.playScream).toHaveBeenCalled();
  });

  it('Applaudissements button plays applause', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Applaudissements' }));
    expect(audio.playApplause).toHaveBeenCalled();
  });

  it('soundboard clicks do not change the active hole', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ba-dum Tss' }));
    await user.click(screen.getByRole('button', { name: 'Suspense' }));
    await user.click(screen.getByRole('button', { name: 'Applaudissements' }));
    expect(card().textContent.includes('UN OBJET (MASCULIN)')).toBe(true);
  });

  it('initially shows segment 0 text', () => {
    setup();
    expect(body().includes(SEG0)).toBe(true);
  });

  it('active hole card shows the consigne', () => {
    setup();
    expect(card().textContent.includes('UN OBJET (MASCULIN)')).toBe(true);
  });

  it('anti-spoiler: later segment text is absent from the DOM', () => {
    setup();
    expect(['PAPRIKA', 'QUOKKA', 'FINALEMENT'].some((w) => body().includes(w))).toBe(false);
  });

  it('locked segments exist with obfuscation classes and aria-hidden', () => {
    setup();
    const locked = screen.getAllByTestId('locked-segment');
    const ok = locked.every(
      (el) =>
        ['blur-xl', 'select-none', 'opacity-40', 'pointer-events-none'].every((c) =>
          el.classList.contains(c)
        ) && el.getAttribute('aria-hidden') === 'true'
    );
    expect(locked.length > 0 && ok).toBe(true);
  });

  it('locked fake text has the same length as the original', () => {
    setup();
    const lens = screen.getAllByTestId('locked-segment').map((el) => el.textContent.trim().length).sort();
    const expected = [SEG1, SEG2, FIN].map((t) => t.length).sort();
    expect(JSON.stringify(lens) === JSON.stringify(expected)).toBe(true);
  });

  it('designationAuto true names a player other than the reader', () => {
    setup({ designationAuto: true });
    expect(/C'est à/.test(card().textContent) && ['Sam', 'Léa'].includes(designated())).toBe(true);
  });

  it('designationAuto false shows no designation', () => {
    setup({ designationAuto: false });
    expect(body().includes("C'est à")).toBe(false);
  });

  it('clicking the card opens a focused input', async () => {
    setup();
    await userEvent.setup().click(card());
    expect(screen.getByLabelText('Mot dit')).toHaveFocus();
  });

  it('typing a word and Enter plays pop', async () => {
    setup();
    await answer(userEvent.setup(), 'banane');
    expect(audio.playPop).toHaveBeenCalled();
  });

  it('validated word appears in an answer pill', async () => {
    setup();
    await answer(userEvent.setup(), 'banane');
    expect(screen.getByTestId('answer-pill').textContent.includes('banane')).toBe(true);
  });

  it('validating unlocks segment 1 only', async () => {
    setup();
    await answer(userEvent.setup(), 'banane');
    expect(body().includes('PAPRIKA')).toBe(true);
  });

  it('validating hole 1 keeps segment 2 hidden', async () => {
    setup();
    await answer(userEvent.setup(), 'banane');
    expect(body().includes('QUOKKA')).toBe(false);
  });

  it('Valider button validates the word', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(card());
    await user.type(screen.getByLabelText('Mot dit'), 'banane');
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(screen.getByTestId('answer-pill').textContent.includes('banane')).toBe(true);
  });

  it('Passer validates without a word showing check mark', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(card());
    await user.click(screen.getByRole('button', { name: /passer/i }));
    expect(screen.getByTestId('answer-pill').textContent.includes('✓')).toBe(true);
  });

  it('Passer pill shows the consigne', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(card());
    await user.click(screen.getByRole('button', { name: /passer/i }));
    expect(screen.getByTestId('answer-pill').textContent.includes('UN OBJET (MASCULIN)')).toBe(true);
  });

  it('Mot joker plays the joker sound', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: /mot joker/i }));
    expect(audio.playJoker).toHaveBeenCalled();
  });

  it('Mot joker shows the joker word on the card', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: /mot joker/i }));
    expect(card().textContent.includes('grille-pain')).toBe(true);
  });

  it('Mot joker flags the card with data-joker', async () => {
    setup();
    await userEvent.setup().click(screen.getByRole('button', { name: /mot joker/i }));
    expect(card().getAttribute('data-joker')).toBe('true');
  });

  it('clicking the joker card validates with the joker word', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /mot joker/i }));
    await user.click(card());
    const pill = screen.getByTestId('answer-pill');
    expect(pill.textContent.includes('grille-pain')).toBe(true);
  });

  it('joker answer pill has data-joker true', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /mot joker/i }));
    await user.click(card());
    expect(screen.getByTestId('answer-pill').getAttribute('data-joker')).toBe('true');
  });

  it('never designates the same player twice in a row', async () => {
    setup();
    const first = designated();
    await answer(userEvent.setup(), 'banane');
    const second = designated();
    expect(Boolean(first) && Boolean(second) && first !== second).toBe(true);
  });

  it('timer shows 15 at start', () => {
    setup({ timerPression: true });
    expect(screen.getByTestId('timer').textContent.trim()).toBe('15');
  });

  it('timer expiry plays beep', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ timerPression: true });
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(audio.playBeep).toHaveBeenCalled();
  });

  it('timer expiry fills the card with the joker word', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ timerPression: true });
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(card().textContent.includes('grille-pain') && card().getAttribute('data-joker') === 'true').toBe(true);
  });

  it('no timer element when timerPression is false', () => {
    setup({ timerPression: false });
    expect(screen.queryByTestId('timer')).toBeNull();
  });

  async function playAll(user) {
    await answer(user, 'banane');
    await user.click(card());
    await user.click(screen.getByRole('button', { name: /passer/i }));
    await user.click(screen.getByRole('button', { name: /mot joker/i }));
    await user.click(card());
  }

  it('after all holes the final text is visible', async () => {
    setup();
    await playAll(userEvent.setup());
    expect(body().includes('FINALEMENT')).toBe(true);
  });

  it('after all holes a fin de l\'histoire button appears', async () => {
    setup();
    await playAll(userEvent.setup());
    expect(screen.getByRole('button', { name: /fin de l'histoire/i })).toBeInTheDocument();
  });

  it('fin button calls onFinish exactly once', async () => {
    const { onFinish } = setup();
    const user = userEvent.setup();
    await playAll(user);
    await user.click(screen.getByRole('button', { name: /fin de l'histoire/i }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('onFinish receives ordered answers with words and joker flags', async () => {
    const { onFinish } = setup();
    const user = userEvent.setup();
    await playAll(user);
    await user.click(screen.getByRole('button', { name: /fin de l'histoire/i }));
    const a = onFinish.mock.calls[0][0];
    const empty = (w) => w === '' || w == null;
    expect(
      Array.isArray(a) &&
        a.length === 3 &&
        a[0].word === 'banane' && a[0].joker === false &&
        empty(a[1].word) && a[1].joker === false &&
        a[2].word === 'lama' && a[2].joker === true
    ).toBe(true);
  });

  it('requests a wake lock on mount', () => {
    setup();
    expect(device.requestWakeLock).toHaveBeenCalled();
  });

  it('releases the wake lock on unmount', async () => {
    const { unmount } = setup();
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(releaseSpy).toHaveBeenCalled();
  });
});
