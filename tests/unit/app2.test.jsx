import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.setConfig({ testTimeout: 30000 });

vi.mock('../../src/lib/speech.js', () => {
  const VOICES = [
    { id: 'narrateur', name: 'Narrateur', emoji: '🎙️', price: null, model: 'm0', rate: 1, pitch: 1, effect: null },
    { id: 'robot', name: 'Robot', emoji: '🤖', price: '0,99 €', model: 'm1', rate: 1, pitch: 1, effect: 'robot' },
    { id: 'ecureuil', name: 'Écureuil', emoji: '🐿️', price: '0,99 €', model: 'm2', rate: 1, pitch: 1.5, effect: null },
    { id: 'mamie', name: 'Mamie', emoji: '👵', price: '0,99 €', model: 'm3', rate: 0.9, pitch: 1, effect: null },
    { id: 'commentateur', name: 'Commentateur', emoji: '📣', price: '0,99 €', model: 'm4', rate: 1.2, pitch: 1, effect: null },
  ];
  return {
    VOICES,
    VOICE_BUNDLE: { id: 'bundle', name: 'Toutes les voix', emoji: '🎁', price: '2,49 €', includes: ['robot', 'ecureuil', 'mamie', 'commentateur'] },
    speak: vi.fn(async () => {}),
    cancelSpeech: vi.fn(),
    listen: vi.fn(async () => 'banane'),
    stopListening: vi.fn(),
    isSttSupported: vi.fn(() => true),
    requestMicPermission: vi.fn(async () => true),
    unlockSpeech: vi.fn(),
    preloadVoice: vi.fn(async (id, cb) => { cb && cb(1); return true; }),
    isVoiceReady: vi.fn(() => true),
  };
});
vi.mock('../../src/lib/audio.js', () => ({
  unlockAudio: vi.fn(), playPop: vi.fn(), playJoker: vi.fn(), playBadumTss: vi.fn(),
  playScream: vi.fn(), playApplause: vi.fn(), playBeep: vi.fn(),
}));
vi.mock('../../src/lib/device.js', () => ({
  requestWakeLock: vi.fn(async () => () => {}),
  shareText: vi.fn(async () => 'copied'),
}));

import App from '../../src/App.jsx';
import * as speech from '../../src/lib/speech.js';

const PLAYERS = ['Alex', 'Sam', 'Léa'];
const opts = () => JSON.parse(localStorage.getItem('textatrou:options') || '{}');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('textatrou:players', JSON.stringify(PLAYERS));
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  vi.clearAllMocks();
});

async function toLobby(user) {
  await user.click(screen.getByRole('button', { name: /nouvelle partie/i }));
}
async function launchVoice(user) {
  await toLobby(user);
  await user.click(screen.getByRole('button', { name: /lancer la partie/i }));
}
async function playVoiceToEnd(user) {
  await launchVoice(user);
  await user.click(await screen.findByRole('button', { name: /c'est parti/i }));
  await user.click(await screen.findByRole('button', { name: /fin de l'histoire/i }, { timeout: 15000 }));
  await screen.findByText(/histoire terminée/i);
}
const readerName = () => PLAYERS.find((p) => screen.queryByText(p, { exact: true }));
async function playerRoundToEnd(user) {
  await user.click(await screen.findByRole('button', { name: /je suis prêt/i }));
  for (let i = 0; i < 400; i++) {
    const fin = screen.queryByRole('button', { name: /fin de l'histoire/i });
    if (fin) { await user.click(fin); break; }
    const joker = screen.queryByRole('button', { name: /mot joker/i });
    if (joker) await user.click(joker);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  }
  await screen.findByText(/histoire terminée/i, {}, { timeout: 5000 });
}
async function pickUnlockedTheme(user) {
  const labels = ['Aventure', 'Amour', 'Boulot', 'Absurde', 'Fête', 'Écrans'];
  const btn = screen.getAllByRole('button').find((b) => labels.some((l) => b.textContent.includes(l)) && !b.textContent.includes('🔒') && !b.querySelector('[aria-hidden="true"]:not(.text-4xl)'));
  await user.click(btn);
}

describe('App v2 voice/mode wiring', () => {
  it('root keeps layout classes', () => {
    const { container } = render(<App />);
    expect(container.firstChild.className.includes('max-w-md mx-auto min-h-screen')).toBe(true);
  });

  it('lobby defaults to voice reader mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    expect(screen.getByRole('radio', { name: /voix auto/i }).checked).toBe(true);
  });

  it('lobby shows voice picker built from VOICES', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    expect(screen.queryByRole('radio', { name: /robot/i }) !== null).toBe(true);
  });

  it('preloads the selected voice when lobby is shown in voice mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await waitFor(() => expect(speech.preloadVoice.mock.calls.some((c) => c[0] === 'narrateur')).toBe(true));
  });

  it('voice launch shows center-phone transition, not reader prompt', async () => {
    const user = userEvent.setup();
    render(<App />);
    await launchVoice(user);
    expect(screen.queryByText(/posez le téléphone au centre/i) !== null).toBe(true);
    expect(screen.queryByText(/à toi de lire/i)).toBeNull();
  });

  it('voice mode: c\'est parti starts gameplay and the voice speaks', async () => {
    const user = userEvent.setup();
    render(<App />);
    await launchVoice(user);
    await user.click(await screen.findByRole('button', { name: /c'est parti/i }));
    await waitFor(() => expect(speech.speak).toHaveBeenCalled());
  });

  it('voice mode shows no human reader pill', async () => {
    const user = userEvent.setup();
    render(<App />);
    await launchVoice(user);
    await user.click(await screen.findByRole('button', { name: /c'est parti/i }));
    await waitFor(() => expect(speech.speak).toHaveBeenCalled());
    expect(PLAYERS.some((p) => screen.queryByText(`📖 ${p}`) !== null)).toBe(false);
  });

  it('voice mode progresses automatically to end and shows recap word', async () => {
    const user = userEvent.setup();
    render(<App />);
    await playVoiceToEnd(user);
    expect(screen.getAllByTestId('recap-word').some((b) => b.textContent.includes('banane'))).toBe(true);
  });

  it('answers can be edited at the end', async () => {
    const user = userEvent.setup();
    render(<App />);
    await playVoiceToEnd(user);
    await user.click(screen.getAllByTestId('recap-word')[0]);
    await user.click(await screen.findByRole('button', { name: /écrire/i }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'pantoufle{Enter}');
    await waitFor(() => expect(screen.getAllByTestId('recap-word').some((b) => b.textContent.includes('pantoufle'))).toBe(true));
  });

  it('listen to story speaks text with the corrected word and narrator voice', async () => {
    const user = userEvent.setup();
    render(<App />);
    await playVoiceToEnd(user);
    await user.click(screen.getAllByTestId('recap-word')[0]);
    await user.click(await screen.findByRole('button', { name: /écrire/i }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'pantoufle{Enter}');
    await waitFor(() => expect(screen.getAllByTestId('recap-word').some((b) => b.textContent.includes('pantoufle'))).toBe(true));
    speech.speak.mockClear();
    await user.click(screen.getByRole('button', { name: /écouter l'histoire/i }));
    await waitFor(() => expect(speech.speak).toHaveBeenCalled());
    const [text, o] = speech.speak.mock.calls[0];
    expect(String(text).includes('pantoufle') && o && o.voiceId === 'narrateur').toBe(true);
  });

  it('switching to player mode persists readerMode joueur', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('radio', { name: /un joueur/i }));
    expect(opts().readerMode).toBe('joueur');
  });

  it('player mode launch shows reader prompt with one of the players', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('radio', { name: /un joueur/i }));
    await user.click(screen.getByRole('button', { name: /lancer la partie/i }));
    expect(screen.queryByText(/à toi de lire/i) !== null).toBe(true);
    expect(readerName() !== undefined).toBe(true);
  });

  it('player mode rotates to next player after a round', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('radio', { name: /un joueur/i }));
    await user.click(screen.getByRole('button', { name: /lancer la partie/i }));
    await screen.findByText(/à toi de lire/i);
    const first = readerName();
    await playerRoundToEnd(user);
    await pickUnlockedTheme(user);
    await screen.findByText(/à toi de lire/i);
    expect(readerName()).toBe(PLAYERS[(PLAYERS.indexOf(first) + 1) % PLAYERS.length]);
  }, 40000);

  it('simulated purchase of a voice stores it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('button', { name: /classique/i }));
    const card = screen.getByText('Robot', { selector: 'div' }).closest('div.flex.flex-col');
    await user.click(within(card).getByRole('button', { name: /simuler l'achat/i }));
    expect(JSON.parse(localStorage.getItem('textatrou:voices') || '[]').includes('robot')).toBe(true);
  });

  it('bundle purchase unlocks all paid voices', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('button', { name: /classique/i }));
    const card = screen.getByText('Toutes les voix').closest('div.flex.flex-col');
    await user.click(within(card).getByRole('button', { name: /simuler l'achat/i }));
    const v = JSON.parse(localStorage.getItem('textatrou:voices') || '[]');
    expect(['robot', 'ecureuil', 'mamie', 'commentateur'].every((x) => v.includes(x))).toBe(true);
  });

  it('readerMode and voiceId persist across reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('radio', { name: /un joueur/i }));
    await user.click(screen.getByRole('radio', { name: /voix auto/i }));
    await user.click(screen.getByRole('radio', { name: /narrateur/i }));
    unmount();
    expect(opts().readerMode === 'voix' && opts().voiceId === 'narrateur').toBe(true);
    const u2 = userEvent.setup();
    render(<App />);
    await toLobby(u2);
    expect(screen.getByRole('radio', { name: /voix auto/i }).checked).toBe(true);
  });

  it('player mode persists across reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await toLobby(user);
    await user.click(screen.getByRole('radio', { name: /un joueur/i }));
    unmount();
    const u2 = userEvent.setup();
    render(<App />);
    await toLobby(u2);
    expect(screen.getByRole('radio', { name: /un joueur/i }).checked).toBe(true);
  });
});
