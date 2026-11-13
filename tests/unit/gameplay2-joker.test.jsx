import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.setConfig({ testTimeout: 30000 });
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

function setup(opts = {}, reader = null) {
  return render(
    <GamePlayScreen
      story={story}
      players={players}
      reader={reader}
      options={{ readerMode: 'voix', voiceId: 'narrateur', designationAuto: true, timerPression: false, ...opts }}
      jokers={jokers}
      onFinish={vi.fn()}
    />
  );
}
const never = () => new Promise(() => {});
const jokerBtn = () => screen.queryByRole('button', { name: /mot joker/i });
const rapid = (n) => {
  const b = jokerBtn();
  if (!b) return false;
  for (let i = 0; i < n; i++) fireEvent.click(b);
  return true;
};
const jokerPills = () => [...document.querySelectorAll('[data-testid="answer-pill"][data-joker="true"]')];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  speech.speak.mockImplementation(async () => {});
  speech.listen.mockImplementation(async () => 'banane');
  speech.isSttSupported.mockImplementation(() => true);
});

// joueur mode: card click starts listening (never resolves) so the joker button shows
async function openHoleJoueur() {
  speech.listen.mockImplementation(never);
  setup({ readerMode: 'joueur' }, 'Alex');
  fireEvent.click(await screen.findByTestId('hole-card'));
  await waitFor(() => expect(jokerBtn()).not.toBeNull());
}

describe('joker rapid clicks', () => {
  test('joueur: 5 rapid clicks call playJoker once and validate hole 1', async () => {
    await openHoleJoueur();
    rapid(5);
    const calls = audio.playJoker.mock.calls.length;
    await waitFor(() => expect(jokerPills().length).toBe(1), { timeout: 3000 });
    expect(calls === 1 && audio.playJoker.mock.calls.length === 1).toBe(true);
  });

  test('joueur: repeated rapid clicks reach end of story', async () => {
    speech.listen.mockImplementation(never);
    setup({ readerMode: 'joueur' }, 'Alex');
    for (let i = 1; i <= 3; i++) {
      await waitFor(() => expect(screen.queryByTestId('hole-card')).not.toBeNull(), { timeout: 5000 });
      fireEvent.click(screen.getByTestId('hole-card'));
      await waitFor(() => expect(jokerBtn()).not.toBeNull(), { timeout: 5000 });
      rapid(3);
      await waitFor(() => expect(jokerPills().length).toBe(i), { timeout: 5000 });
    }
    await screen.findByRole('button', { name: /fin de l'histoire/i }, { timeout: 15000 });
  });

  test('voix: 4 rapid clicks with listen pending call playJoker once', async () => {
    speech.listen.mockImplementation(never);
    setup();
    await screen.findByTestId('hole-card');
    await waitFor(() => expect(jokerBtn()).not.toBeNull(), { timeout: 4000 });
    rapid(4);
    await waitFor(() => expect(jokerPills().length).toBe(1), { timeout: 4000 });
    expect(audio.playJoker.mock.calls.length === 1 && jokerPills()[0].textContent.includes('grille-pain')).toBe(true);
  });

  test('joker button works again on hole 2', async () => {
    await openHoleJoueur();
    rapid(3);
    await waitFor(() => expect(jokerPills().length).toBe(1), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('hole-card').textContent.includes('CÉLÉBRITÉ')).toBe(true), { timeout: 5000 });
    fireEvent.click(screen.getByTestId('hole-card'));
    await waitFor(() => expect(jokerBtn()).not.toBeNull(), { timeout: 5000 });
    rapid(1);
    await waitFor(() => expect(jokerPills().length).toBe(2), { timeout: 4000 });
    expect(audio.playJoker.mock.calls.length).toBe(2);
  });
});
