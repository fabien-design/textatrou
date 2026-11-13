import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  requestWakeLock: vi.fn(async () => () => {}),
  shareText: vi.fn(async () => 'copied'),
}));

import { unlockAudio } from '../../src/lib/audio.js';
import { shareText } from '../../src/lib/device.js';
import { buildStoryText } from '../../src/game/engine.js';
import ReaderTurnScreen from '../../src/screens/ReaderTurnScreen.jsx';
import EndGameScreen from '../../src/screens/EndGameScreen.jsx';

const story = {
  id: 't1',
  pack: 'gratuit',
  theme: 'Test',
  thematique: 'amour',
  titre: 'Le Grand Chambardement',
  segments: [
    { texte_avant: 'AVANT-UN', trou: { consigne: 'UN FRUIT', categorie_joker: 'nourriture' } },
    { texte_avant: ', AVANT-DEUX', trou: { consigne: 'UN ADJECTIF LOUCHE', categorie_joker: 'adjectif_masc' } },
    { texte_avant: '. AVANT-TROIS', trou: { consigne: 'UN ANIMAL', categorie_joker: 'animal' } },
    { texte_fin: 'FIN-DISTINCTE.' },
  ],
};
const answers = [
  { word: 'banane', joker: false },
  { word: '', joker: false },
  { word: 'lama', joker: true },
];
const themes = [
  { id: 'amour', label: 'Amour', emoji: '💘', locked: false },
  { id: 'boulot', label: 'Boulot', emoji: '💼', locked: false },
  { id: 'fete', label: 'Fête', emoji: '🍾', locked: true },
];

describe('ReaderTurnScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the prompt and reader name', () => {
    render(<ReaderTurnScreen reader="Jeanne" onReady={() => {}} />);
    expect(!!screen.queryByText(/à toi de lire/i)).toBe(true);
    expect(!!screen.queryByText(/Jeanne/)).toBe(true);
  });

  it('ready button unlocks audio once', async () => {
    render(<ReaderTurnScreen reader="Jeanne" onReady={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /je suis prêt/i }));
    expect(unlockAudio).toHaveBeenCalledTimes(1);
  });

  it('ready button calls onReady once', async () => {
    const onReady = vi.fn();
    render(<ReaderTurnScreen reader="Jeanne" onReady={onReady} />);
    await userEvent.click(screen.getByRole('button', { name: /je suis prêt/i }));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('EndGameScreen', () => {
  let h;
  const setup = () => {
    h = { onNextTheme: vi.fn(), onLockedTheme: vi.fn(), onHome: vi.fn() };
    return render(
      <EndGameScreen story={story} answers={answers} themes={themes} {...h} />
    );
  };
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('shows the finished heading', () => {
    expect(!!screen.queryByText(/histoire terminée/i)).toBe(true);
  });

  it('shows the story title', () => {
    expect(!!screen.queryByText(/Le Grand Chambardement/)).toBe(true);
  });

  it('shows every texte_avant', () => {
    const t = document.body.textContent;
    expect(['AVANT-UN', 'AVANT-DEUX', 'AVANT-TROIS'].every((s) => t.includes(s))).toBe(true);
  });

  it('shows texte_fin', () => {
    expect(document.body.textContent.includes('FIN-DISTINCTE')).toBe(true);
  });

  it('renders one recap-word per hole', () => {
    expect(screen.getAllByTestId('recap-word').length === 3).toBe(true);
  });

  it('recap words appear in order with answers', () => {
    const w = screen.getAllByTestId('recap-word');
    expect(w[0].textContent.includes('banane') && w[2].textContent.includes('lama')).toBe(true);
  });

  it('non-joker pill is not marked joker', () => {
    const w = screen.getAllByTestId('recap-word');
    expect(w[0].getAttribute('data-joker') === 'true').toBe(false);
  });

  it('joker pill is marked joker', () => {
    const w = screen.getAllByTestId('recap-word');
    expect(w[2].getAttribute('data-joker')).toBe('true');
  });

  it('skipped hole pill shows its consigne', () => {
    const w = screen.getAllByTestId('recap-word');
    expect(w[1].textContent.includes('UN ADJECTIF LOUCHE')).toBe(true);
  });

  it('shows the on enchaîne section', () => {
    expect(!!screen.queryByText(/on enchaîne/i)).toBe(true);
  });

  it('shows label and emoji for each theme', () => {
    const t = document.body.textContent;
    expect(
      themes.every((x) => t.includes(x.label) && t.includes(x.emoji))
    ).toBe(true);
  });

  it('unlocked theme calls onNextTheme with id', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Amour/ }));
    expect(h.onNextTheme).toHaveBeenCalledWith('amour');
  });

  it('locked theme shows a lock', () => {
    const b = screen.getByRole('button', { name: /Fête/ });
    expect(b.textContent.includes('🔒')).toBe(true);
  });

  it('locked theme calls onLockedTheme with id', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Fête/ }));
    expect(h.onLockedTheme).toHaveBeenCalledWith('fete');
  });

  it('locked theme does not call onNextTheme', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Fête/ }));
    expect(h.onNextTheme).not.toHaveBeenCalled();
  });

  it('share calls shareText once', async () => {
    await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    expect(shareText).toHaveBeenCalledTimes(1);
  });

  it('share text equals the built story text', async () => {
    await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    expect(shareText.mock.calls[0][0].text === buildStoryText(story, answers)).toBe(true);
  });

  it('share title contains TEXTATROU', async () => {
    await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    expect(String(shareText.mock.calls[0][0].title).includes('TEXTATROU')).toBe(true);
  });

  it('shows copied message after share', async () => {
    await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    expect(!!(await screen.findByText(/copié/i))).toBe(true);
  });

  it('home button calls onHome', async () => {
    await userEvent.click(screen.getByRole('button', { name: /accueil/i }));
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });
});
