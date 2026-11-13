import React from 'react';
import { render, screen } from '@testing-library/react';
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

import App from '../../src/App.jsx';
import { STORIES, THEMES, PACKS } from '../../src/data/stories.js';

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

const NAMES = ['Alex', 'Sam', 'Léa'];

async function addPlayers(user, names = NAMES) {
  const input = await screen.findByPlaceholderText(/prénom/i);
  for (const n of names) {
    await user.type(input, `${n}{Enter}`);
  }
}

async function goLobby(user) {
  await user.click(await screen.findByRole('button', { name: /nouvelle partie/i }));
  await screen.findByRole('button', { name: /lancer la partie/i });
}

async function playThroughStory(user) {
  for (let i = 0; i < 40; i++) {
    const fin = screen.queryByRole('button', { name: /fin de l'histoire/i });
    if (fin) {
      await user.click(fin);
      return;
    }
    const card = await screen.findByTestId('hole-card');
    await user.click(card);
    await user.click(await screen.findByRole('button', { name: /passer/i }));
  }
  throw new Error('story did not finish');
}

async function startGame(user) {
  await goLobby(user);
  await addPlayers(user);
  await user.click(screen.getByRole('button', { name: /lancer la partie/i }));
  await screen.findByText(/à toi de lire/i);
}

async function pickUnlockedTheme(user) {
  await screen.findByText(/histoire terminée/i);
  const btn = THEMES.map((t) => screen.queryByText(t.label))
    .filter(Boolean)
    .map((el) => el.closest('button'))
    .find((b) => b && !b.textContent.includes('🔒'));
  await user.click(btn);
}

describe('App', () => {
  it('renders home with free pack count and layout classes', async () => {
    const { container } = render(<App />);
    expect(await screen.findByText('TEXTATROU')).toBeTruthy();
    const packs = await screen.findByRole('button', { name: /packs/i });
    expect(packs.textContent.includes('6 gratuits')).toBe(true);
    const cl = container.firstChild.classList;
    expect(['max-w-md', 'mx-auto', 'min-h-screen'].every((c) => cl.contains(c))).toBe(true);
  });

  it('lobby launch button enables with 3 players', async () => {
    const user = userEvent.setup();
    render(<App />);
    await goLobby(user);
    expect(screen.getByRole('button', { name: /lancer la partie/i }).disabled).toBe(true);
    await addPlayers(user);
    expect(screen.getByRole('button', { name: /lancer la partie/i }).disabled).toBe(false);
  });

  it('persists players across remount', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await goLobby(user);
    await addPlayers(user);
    const stored = JSON.parse(localStorage.getItem('textatrou:players'));
    expect(NAMES.every((n) => stored.includes(n))).toBe(true);
    first.unmount();
    render(<App />);
    await goLobby(user);
    expect(NAMES.every((n) => screen.queryByText(n) !== null)).toBe(true);
  });

  it('loads prefilled players from localStorage', async () => {
    localStorage.setItem('textatrou:players', JSON.stringify(NAMES));
    const user = userEvent.setup();
    render(<App />);
    await goLobby(user);
    expect(NAMES.every((n) => screen.queryByText(n) !== null)).toBe(true);
  });

  it('launch shows reader turn with first player then gameplay', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    expect(screen.queryByText('Alex') !== null).toBe(true);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    expect((await screen.findByTestId('hole-card')) !== null).toBe(true);
  });

  it('plays a free-pack story without raw placeholders', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    await screen.findByTestId('hole-card');
    const text = document.body.textContent;
    const frags = STORIES.filter((s) => s.pack === 'gratuit').map((s) => {
      const t = s.segments[0].texte_avant;
      return t.slice(t.lastIndexOf('}') + 1).trim().slice(0, 25);
    });
    expect(frags.some((f) => f && text.includes(f))).toBe(true);
    expect(text.includes('{JOUEUR_RANDOM}')).toBe(false);
  });

  it('full round reaches end screen with 3 themes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    await playThroughStory(user);
    await screen.findByText(/histoire terminée/i);
    const shown = THEMES.filter((t) => screen.queryByText(t.label) !== null);
    expect(shown.length).toBe(3);
  });

  it('rotates readers across rounds', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    await playThroughStory(user);
    await pickUnlockedTheme(user);
    await screen.findByText(/à toi de lire/i);
    expect(screen.queryByText('Sam') !== null).toBe(true);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    await playThroughStory(user);
    await pickUnlockedTheme(user);
    await screen.findByText(/à toi de lire/i);
    expect(screen.queryByText('Léa') !== null).toBe(true);
  });

  it('persists options when toggling timer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await goLobby(user);
    await user.click(screen.getByRole('switch', { name: /timer/i }));
    const opts = JSON.parse(localStorage.getItem('textatrou:options'));
    expect(opts.timerPression).toBe(true);
  });

  it('accueil returns home from end screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('button', { name: /je suis prêt/i }));
    await playThroughStory(user);
    await screen.findByText(/histoire terminée/i);
    await user.click(screen.getByRole('button', { name: /accueil/i }));
    expect((await screen.findByRole('button', { name: /nouvelle partie/i })) !== null).toBe(true);
  });

  it('unlocking a pack via purchase simulation persists it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await goLobby(user);
    await user.click(screen.getByRole('button', { name: new RegExp(PACKS[0].name) }));
    const buy = await screen.findAllByRole('button', { name: /simuler l'achat/i });
    await user.click(buy[0]);
    const stored = JSON.parse(localStorage.getItem('textatrou:packs') || '[]');
    const locked = PACKS.filter((p) => p.price).map((p) => p.id);
    expect(stored.includes(locked[0])).toBe(true);
  });
});
