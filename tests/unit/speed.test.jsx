import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => ({ synthesize: vi.fn() }));

vi.mock('../../src/lib/kokoro.js', () => ({
  loadKokoro: vi.fn(async () => true),
  isKokoroReady: () => true,
  synthesize: h.synthesize,
}));

import { loadOptions, saveOptions } from '../../src/lib/storage.js';
import * as speechStatic from '../../src/lib/speech.js';
import LobbyScreen from '../../src/screens/LobbyScreen.jsx';
import HomeScreen from '../../src/screens/HomeScreen.jsx';
import App from '../../src/App.jsx';

function installAudio() {
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume = async () => {};
    createBuffer(ch, len, rate) { return { getChannelData: () => new Float32Array(len), duration: len / rate }; }
    createBufferSource() {
      const s = {
        buffer: null, onended: null, playbackRate: { value: 1 },
        connect() {}, stop() {},
        start() { setTimeout(() => s.onended && s.onended(), 0); },
      };
      return s;
    }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  }
  window.AudioContext = Ctx;
}

beforeEach(() => {
  localStorage.clear();
  h.synthesize.mockReset();
  h.synthesize.mockImplementation(async () => ({ audio: new Float32Array(2400), sampling_rate: 24000 }));
  installAudio();
});

describe('A) storage voiceSpeed', () => {
  it('defaults to 1.2', () => {
    expect(loadOptions().voiceSpeed === 1.2).toBe(true);
  });
  it('persists a saved value', () => {
    saveOptions({ voiceSpeed: 1.5 });
    expect(loadOptions().voiceSpeed === 1.5).toBe(true);
  });
});

describe('B) speech rate', () => {
  const load = async () => { vi.resetModules(); return import('../../src/lib/speech.js'); };
  it('exports setSpeechRate and getSpeechRate', async () => {
    const s = await load();
    expect(typeof s.setSpeechRate === 'function' && typeof s.getSpeechRate === 'function').toBe(true);
  });
  it('defaults to 1', async () => {
    const s = await load();
    expect(s.getSpeechRate?.() === 1).toBe(true);
  });
  it('stores a set value', async () => {
    const s = await load();
    s.setSpeechRate?.(1.5);
    expect(s.getSpeechRate?.() === 1.5).toBe(true);
  });
  it('clamps high to 2', async () => {
    const s = await load();
    s.setSpeechRate?.(5);
    expect(s.getSpeechRate?.() === 2).toBe(true);
  });
  it('clamps low to 0.5', async () => {
    const s = await load();
    s.setSpeechRate?.(0.1);
    expect(s.getSpeechRate?.() === 0.5).toBe(true);
  });
  it('ignores non-numbers', async () => {
    const s = await load();
    s.setSpeechRate?.(1.5);
    s.setSpeechRate?.('abc');
    s.setSpeechRate?.(undefined);
    expect(s.getSpeechRate?.() === 1.5).toBe(true);
  });
  it('speak multiplies voice speed by the rate', async () => {
    const s = await load();
    s.setSpeechRate?.(1.5);
    await s.preloadVoice('narrateur');
    await s.speak('Bonjour.', { voiceId: 'narrateur' });
    const base = s.VOICES.find((v) => v.id === 'narrateur').speed;
    const sp = h.synthesize.mock.calls[0]?.[1]?.speed;
    expect(typeof sp === 'number' && Math.abs(sp - base * 1.5) < 0.005).toBe(true);
  });
});

const lobbyProps = (over = {}) => ({
  voices: speechStatic.VOICES,
  unlockedVoices: ['narrateur'],
  voiceProgress: 1,
  players: ['A', 'B', 'C'],
  onPlayersChange: vi.fn(),
  options: { readerMode: 'voix', voiceId: 'narrateur', designationAuto: true, timerPression: false, voiceSpeed: 1.2, ...over },
  onOptionsChange: vi.fn(),
  packName: 'Gratuit',
  onOpenPacks: vi.fn(),
  onBack: vi.fn(),
  onStart: vi.fn(),
});

describe('C) LobbyScreen speed slider', () => {
  it('renders slider with attributes', () => {
    render(<LobbyScreen {...lobbyProps()} />);
    const s = screen.queryByRole('slider', { name: /vitesse/i });
    expect(!!s && s.value === '1.2' && s.min === '0.8' && s.max === '1.8' && s.step === '0.1').toBe(true);
  });
  it('change emits numeric voiceSpeed', () => {
    const p = lobbyProps();
    render(<LobbyScreen {...p} />);
    const s = screen.queryByRole('slider', { name: /vitesse/i });
    if (s) fireEvent.change(s, { target: { value: '1.5' } });
    const last = p.onOptionsChange.mock.calls.at(-1)?.[0];
    expect(!!last && last.voiceSpeed === 1.5).toBe(true);
  });
  it('slower button subtracts 0.1', async () => {
    const p = lobbyProps();
    render(<LobbyScreen {...p} />);
    const b = screen.queryByRole('button', { name: 'Ralentir la voix' });
    if (b) await userEvent.click(b);
    const v = p.onOptionsChange.mock.calls.at(-1)?.[0]?.voiceSpeed;
    expect(typeof v === 'number' && Math.abs(v - 1.1) < 0.001).toBe(true);
  });
  it('faster button adds 0.1', async () => {
    const p = lobbyProps();
    render(<LobbyScreen {...p} />);
    const b = screen.queryByRole('button', { name: 'Accélérer la voix' });
    if (b) await userEvent.click(b);
    const v = p.onOptionsChange.mock.calls.at(-1)?.[0]?.voiceSpeed;
    expect(typeof v === 'number' && Math.abs(v - 1.3) < 0.001).toBe(true);
  });
  it('slower clamps at 0.8', async () => {
    const p = lobbyProps({ voiceSpeed: 0.8 });
    render(<LobbyScreen {...p} />);
    const b = screen.queryByRole('button', { name: 'Ralentir la voix' });
    if (b) await userEvent.click(b);
    const v = p.onOptionsChange.mock.calls.at(-1)?.[0]?.voiceSpeed;
    expect(typeof v === 'number' && Math.abs(v - 0.8) < 0.001).toBe(true);
  });
  it('faster clamps at 1.8', async () => {
    const p = lobbyProps({ voiceSpeed: 1.8 });
    render(<LobbyScreen {...p} />);
    const b = screen.queryByRole('button', { name: 'Accélérer la voix' });
    if (b) await userEvent.click(b);
    const v = p.onOptionsChange.mock.calls.at(-1)?.[0]?.voiceSpeed;
    expect(typeof v === 'number' && Math.abs(v - 1.8) < 0.001).toBe(true);
  });
  it('shows the multiplier label', () => {
    render(<LobbyScreen {...lobbyProps()} />);
    expect(!!screen.queryByText(/×1[.,]2/)).toBe(true);
  });
  it('test button speaks once', async () => {
    render(<LobbyScreen {...lobbyProps()} />);
    const b = screen.queryByRole('button', { name: 'Tester la vitesse' });
    if (b) await userEvent.click(b);
    await new Promise((r) => setTimeout(r, 50));
    expect(!!b && h.synthesize.mock.calls.length === 1).toBe(true);
  });
  it('no slider in joueur mode', () => {
    render(<LobbyScreen {...lobbyProps({ readerMode: 'joueur' })} />);
    expect(screen.queryByRole('slider', { name: /vitesse/i }) === null).toBe(true);
  });
});

describe('D) HomeScreen settings slider', () => {
  it('shows slider reflecting options and emits changes', async () => {
    const onOptionsChange = vi.fn();
    render(<HomeScreen freeCount={3} onPlay={vi.fn()} onPacks={vi.fn()} onOptionsChange={onOptionsChange}
      options={{ readerMode: 'voix', designationAuto: true, timerPression: false, voiceSpeed: 1.5 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    const s = screen.queryByRole('slider', { name: /vitesse/i });
    if (s) fireEvent.change(s, { target: { value: '1.3' } });
    const last = onOptionsChange.mock.calls.at(-1)?.[0];
    expect(!!s && s.value === '1.5' && !!last && last.voiceSpeed === 1.3).toBe(true);
  });
});

describe('E) App applies stored speed', () => {
  it('sets the speech rate from stored options', async () => {
    localStorage.setItem('textatrou:options', JSON.stringify({ voiceSpeed: 1.6 }));
    render(<App />);
    await waitFor(() => expect(speechStatic.getSpeechRate?.() === 1.6).toBe(true));
  });
});
