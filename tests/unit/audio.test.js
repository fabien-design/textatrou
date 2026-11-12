// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let startCount;
let ctorCount;
let instances;

function makeParam() {
  const p = { value: 0 };
  for (const m of [
    'setValueAtTime',
    'linearRampToValueAtTime',
    'exponentialRampToValueAtTime',
    'setTargetAtTime',
    'cancelScheduledValues',
  ]) {
    p[m] = vi.fn(() => p);
  }
  return p;
}

function makeNode(extra = {}) {
  return { connect: vi.fn((n) => n), disconnect: vi.fn(), ...extra };
}

function makeSource(extra = {}) {
  return makeNode({
    start: vi.fn(() => {
      startCount++;
    }),
    stop: vi.fn(),
    onended: null,
    ...extra,
  });
}

class MockAudioContext {
  constructor() {
    ctorCount++;
    instances.push(this);
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = makeNode();
    this.resume = vi.fn(() => Promise.resolve());
  }
  createOscillator() {
    return makeSource({
      type: 'sine',
      frequency: makeParam(),
      detune: makeParam(),
    });
  }
  createGain() {
    return makeNode({ gain: makeParam() });
  }
  createBiquadFilter() {
    return makeNode({
      type: 'lowpass',
      frequency: makeParam(),
      Q: makeParam(),
      gain: makeParam(),
    });
  }
  createBuffer(channels, len, rate) {
    return {
      length: len,
      sampleRate: rate,
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(len),
    };
  }
  createBufferSource() {
    return makeSource({ buffer: null, loop: false, playbackRate: makeParam() });
  }
  createDynamicsCompressor() {
    return makeNode({
      threshold: makeParam(),
      knee: makeParam(),
      ratio: makeParam(),
      attack: makeParam(),
      release: makeParam(),
    });
  }
}

const PLAYERS = ['playPop', 'playJoker', 'playBadumTss', 'playScream', 'playApplause', 'playBeep'];

let origAC;
let origWebkit;
let origFetch;
let origAudio;
let fetchSpy;
let audioSpy;

async function load() {
  vi.resetModules();
  return await import('../../src/lib/audio.js');
}

beforeEach(() => {
  startCount = 0;
  ctorCount = 0;
  instances = [];
  origAC = window.AudioContext;
  origWebkit = window.webkitAudioContext;
  origFetch = globalThis.fetch;
  origAudio = window.Audio;
  window.AudioContext = MockAudioContext;
  delete window.webkitAudioContext;
  fetchSpy = vi.fn(() => Promise.reject(new Error('no fetch')));
  globalThis.fetch = fetchSpy;
  audioSpy = vi.fn();
  window.Audio = audioSpy;
});

afterEach(() => {
  if (origAC === undefined) delete window.AudioContext;
  else window.AudioContext = origAC;
  if (origWebkit === undefined) delete window.webkitAudioContext;
  else window.webkitAudioContext = origWebkit;
  globalThis.fetch = origFetch;
  if (origAudio === undefined) delete window.Audio;
  else window.Audio = origAudio;
  vi.restoreAllMocks();
});

describe('audio: exports', () => {
  it('exports unlockAudio and all play functions as functions', async () => {
    const mod = await load();
    const names = ['unlockAudio', ...PLAYERS];
    expect(names.every((n) => typeof mod[n] === 'function')).toBe(true);
  });
});

describe('audio: laziness', () => {
  it('does not construct an AudioContext at import time', async () => {
    await load();
    expect(ctorCount === 0).toBe(true);
  });

  it('unlockAudio creates a context', async () => {
    const mod = await load();
    mod.unlockAudio();
    expect(ctorCount === 1).toBe(true);
  });

  it('unlockAudio calls resume when state is suspended', async () => {
    const mod = await load();
    const Orig = MockAudioContext;
    window.AudioContext = class extends Orig {
      constructor() {
        super();
        this.state = 'suspended';
      }
    };
    mod.unlockAudio();
    expect(instances[0].resume.mock.calls.length >= 1).toBe(true);
  });

  it('unlockAudio does not call resume when state is running', async () => {
    const mod = await load();
    mod.unlockAudio();
    expect(instances[0].resume.mock.calls.length === 0).toBe(true);
  });

  it('uses webkitAudioContext when AudioContext is absent', async () => {
    delete window.AudioContext;
    window.webkitAudioContext = MockAudioContext;
    const mod = await load();
    mod.unlockAudio();
    expect(ctorCount === 1).toBe(true);
  });
});

describe('audio: play functions start sources', () => {
  for (const name of PLAYERS) {
    it(`${name} starts at least one source`, async () => {
      const mod = await load();
      mod[name]();
      expect(startCount >= 1).toBe(true);
    });
  }
});

describe('audio: context reuse', () => {
  it('repeated play calls construct the context once', async () => {
    const mod = await load();
    for (let i = 0; i < 3; i++) for (const n of PLAYERS) mod[n]();
    expect(ctorCount === 1).toBe(true);
  });

  it('unlockAudio followed by play reuses the same context', async () => {
    const mod = await load();
    mod.unlockAudio();
    mod.playPop();
    expect(ctorCount === 1).toBe(true);
  });
});

describe('audio: no AudioContext available', () => {
  beforeEach(() => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  it('unlockAudio does not throw', async () => {
    const mod = await load();
    expect(() => mod.unlockAudio()).not.toThrow();
  });

  for (const name of PLAYERS) {
    it(`${name} does not throw`, async () => {
      const mod = await load();
      expect(() => mod[name]()).not.toThrow();
    });
  }
});

describe('audio: constructor throws', () => {
  beforeEach(() => {
    window.AudioContext = function () {
      throw new Error('boom');
    };
  });

  it('unlockAudio does not throw', async () => {
    const mod = await load();
    expect(() => mod.unlockAudio()).not.toThrow();
  });

  for (const name of PLAYERS) {
    it(`${name} does not throw`, async () => {
      const mod = await load();
      expect(() => mod[name]()).not.toThrow();
    });
  }
});

describe('audio: no external media', () => {
  it('never calls fetch', async () => {
    const mod = await load();
    mod.unlockAudio();
    for (const n of PLAYERS) mod[n]();
    expect(fetchSpy.mock.calls.length === 0).toBe(true);
  });

  it('never constructs window.Audio', async () => {
    const mod = await load();
    mod.unlockAudio();
    for (const n of PLAYERS) mod[n]();
    expect(audioSpy.mock.calls.length === 0).toBe(true);
  });
});
