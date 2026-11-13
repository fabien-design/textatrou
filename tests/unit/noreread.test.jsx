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

describe('no re-read after answer', () => {
  test('(a) sequence: first segment, announcement, next segment; never the word', async () => {
    setup();
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('PAPRIKA'))).toBe(true), { timeout: 8000 });
    const t = spokenTexts();
    const iSeg = t.findIndex((x) => x.includes('ZEBULON arrive avec'));
    const iAnn = t.findIndex((x) => x.includes('OBJET'));
    const iNext = t.findIndex((x) => x.includes('PAPRIKA'));
    expect(iSeg >= 0 && iAnn > iSeg && iNext > iAnn).toBe(true);
    expect(t.slice(iAnn + 1, iNext + 1)).toEqual([t[iNext]]);
    expect(t.some((x) => x.includes('banane'))).toBe(false);
  });

  test('(b) joker: one announcement with word, next spoken is next segment', async () => {
    speech.listen.mockImplementation(never);
    setup();
    const btn = await screen.findByRole('button', { name: /mot joker/i }, { timeout: 4000 });
    await userEvent.click(btn);
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('PAPRIKA'))).toBe(true), { timeout: 8000 });
    const t = spokenTexts();
    const idx = t.map((x, i) => (x.includes('grille-pain') ? i : -1)).filter((i) => i >= 0);
    expect(idx.length).toBe(1);
    expect(t[idx[0] + 1]).toContain('PAPRIKA');
  });

  test('(c) texte_fin spoken, no recognized word ever spoken', async () => {
    setup();
    await waitFor(() => expect(spokenTexts().some((x) => x.includes('FINALEMENT'))).toBe(true), { timeout: 10000 });
    expect(spokenTexts().some((x) => x.includes('banane'))).toBe(false);
  });
});
