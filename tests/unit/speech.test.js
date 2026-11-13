import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const piper = vi.hoisted(() => ({
  predict: vi.fn(),
  download: vi.fn(),
  stored: vi.fn(),
}));

vi.mock('@mintplex-labs/piper-tts-web', () => ({
  predict: piper.predict,
  download: piper.download,
  stored: piper.stored,
}));

const ctl = { mode: 'result' };

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = undefined;
    this.pitch = 1;
    this.rate = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

class FakeRecognition {
  constructor() {
    this.lang = undefined;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    FakeRecognition.last = this;
  }
  start() {
    setTimeout(() => {
      if (ctl.mode === 'result') {
        this.onresult && this.onresult({ results: [[{ transcript: '  Saucisson ', confidence: 0.9 }]] });
        this.onend && this.onend();
      } else if (ctl.mode === 'error') {
        this.onerror && this.onerror({ error: 'no-speech' });
        this.onend && this.onend();
      }
    }, 0);
  }
  stop() {
    setTimeout(() => this.onend && this.onend(), 0);
  }
  abort() {
    setTimeout(() => this.onend && this.onend(), 0);
  }
}

function node() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    frequency: { value: 0, setValueAtTime: vi.fn() },
    Q: { value: 0 },
    detune: { value: 0 },
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn(),
  };
}

class FakeAudioContext {
  constructor() {
    this.destination = node();
    this.currentTime = 0;
    this.state = 'running';
  }
  resume() {
    return Promise.resolve();
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 0.01 });
  }
  createBufferSource() {
    return {
      buffer: null,
      playbackRate: { value: 1 },
      detune: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(function () {
        setTimeout(() => this.onended && this.onended(), 0);
      }),
      stop: vi.fn(),
      onended: null,
    };
  }
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createOscillator() { return node(); }
  createDelay() { return node(); }
  createWaveShaper() { return node(); }
  createDynamicsCompressor() { return node(); }
}

class FakeAudio {
  constructor() {
    this.listeners = {};
    this.onended = null;
    this.playbackRate = 1;
  }
  addEventListener(n, f) { (this.listeners[n] ||= []).push(f); }
  removeEventListener() {}
  pause() {}
  play() {
    setTimeout(() => {
      this.onended && this.onended();
      (this.listeners.ended || []).forEach((f) => f());
    }, 0);
    return Promise.resolve();
  }
}

let speechSynthesisMock;

async function load() {
  vi.resetModules();
  return import('../../src/lib/speech.js');
}

beforeEach(() => {
  localStorage.clear();
  ctl.mode = 'result';
  piper.predict.mockReset().mockImplementation(async () => new Blob(['RIFF'], { type: 'audio/wav' }));
  piper.download.mockReset().mockImplementation(async (id, cb) => {
    cb && cb({ url: 'x', loaded: 50, total: 100 });
    cb && cb({ url: 'x', loaded: 100, total: 100 });
  });
  piper.stored.mockReset().mockImplementation(async () => []);
  speechSynthesisMock = {
    speak: vi.fn((u) => setTimeout(() => u.onend && u.onend(), 0)),
    cancel: vi.fn(),
    getVoices: () => [{ lang: 'fr-FR', name: 'Amélie' }],
  };
  window.speechSynthesis = speechSynthesisMock;
  window.SpeechSynthesisUtterance = FakeUtterance;
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
  window.Audio = FakeAudio;
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  window.SpeechRecognition = FakeRecognition;
  delete window.webkitSpeechRecognition;
  FakeRecognition.last = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VOICES', () => {
  it('has exactly one free voice, narrateur', async () => {
    const { VOICES } = await load();
    const free = VOICES.filter((v) => v.price === null);
    expect(free.length === 1 && free[0].id === 'narrateur').toBe(true);
  });

  it('has the 4 paid voices at 0,99 €', async () => {
    const { VOICES } = await load();
    const paid = VOICES.filter((v) => v.price !== null);
    const ids = paid.map((v) => v.id).sort();
    expect(
      paid.length === 4 &&
        paid.every((v) => v.price === '0,99 €') &&
        ids.join(',') === ['commentateur', 'ecureuil', 'mamie', 'robot'].sort().join(',')
    ).toBe(true);
  });

  it('every voice has well-formed fields', async () => {
    const { VOICES } = await load();
    const ok = VOICES.every(
      (v) =>
        typeof v.id === 'string' &&
        typeof v.name === 'string' &&
        typeof v.emoji === 'string' &&
        'price' in v &&
        typeof v.model === 'string' &&
        v.model.startsWith('fr_FR-') &&
        typeof v.rate === 'number' &&
        typeof v.pitch === 'number' &&
        (v.effect === null || typeof v.effect === 'string')
    );
    expect(ok).toBe(true);
  });

  it('VOICE_BUNDLE lists the 4 paid ids at 2,49 €', async () => {
    const { VOICE_BUNDLE } = await load();
    expect(
      VOICE_BUNDLE.id === 'bundle' &&
        VOICE_BUNDLE.price === '2,49 €' &&
        [...VOICE_BUNDLE.includes].sort().join(',') === 'commentateur,ecureuil,mamie,robot'
    ).toBe(true);
  });
});

describe('preloadVoice', () => {
  it('calls piper download with the voice model', async () => {
    const { preloadVoice, VOICES } = await load();
    await preloadVoice('robot');
    const model = VOICES.find((v) => v.id === 'robot').model;
    expect(piper.download.mock.calls[0][0] === model).toBe(true);
  });

  it('reports progress in [0,1] reaching 1', async () => {
    const { preloadVoice } = await load();
    const seen = [];
    await preloadVoice('robot', (p) => seen.push(p));
    expect(seen.length > 0 && seen.every((p) => typeof p === 'number' && p >= 0 && p <= 1) && Math.max(...seen) === 1).toBe(true);
  });

  it('resolves true and marks the voice ready', async () => {
    const { preloadVoice, isVoiceReady } = await load();
    const before = isVoiceReady('robot');
    const res = await preloadVoice('robot');
    expect(before === false && res === true && isVoiceReady('robot') === true).toBe(true);
  });

  it('resolves false without throwing when download rejects', async () => {
    piper.download.mockImplementation(async () => {
      throw new Error('net');
    });
    const { preloadVoice, isVoiceReady } = await load();
    const res = await preloadVoice('robot');
    expect(res === false && isVoiceReady('robot') === false).toBe(true);
  });
});

describe('speak', () => {
  it('uses piper predict with text and model when ready', async () => {
    const { preloadVoice, speak, VOICES } = await load();
    await preloadVoice('robot');
    await speak('Bonjour', { voiceId: 'robot' });
    const model = VOICES.find((v) => v.id === 'robot').model;
    const arg = piper.predict.mock.calls[0]?.[0];
    expect(arg && arg.text === 'Bonjour' && arg.voiceId === model).toBe(true);
  });

  it('falls back to speechSynthesis when not ready, without predict', async () => {
    const { speak } = await load();
    await speak('Salut', { voiceId: 'robot' });
    const u = speechSynthesisMock.speak.mock.calls[0]?.[0];
    expect(piper.predict.mock.calls.length === 0 && !!u && u.text === 'Salut' && u.lang === 'fr-FR').toBe(true);
  });

  it('falls back to speechSynthesis when predict rejects', async () => {
    piper.predict.mockImplementation(async () => {
      throw new Error('boom');
    });
    const { preloadVoice, speak } = await load();
    await preloadVoice('robot');
    await speak('Oups', { voiceId: 'robot' });
    const u = speechSynthesisMock.speak.mock.calls[0]?.[0];
    expect(!!u && u.text === 'Oups').toBe(true);
  });

  it('resolves without throwing when neither piper nor speechSynthesis exist', async () => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
    const { speak } = await load();
    let ok = true;
    try {
      await speak('Rien', { voiceId: 'narrateur' });
    } catch {
      ok = false;
    }
    expect(ok).toBe(true);
  });

  it('resolves immediately on empty text without any engine call', async () => {
    const { speak } = await load();
    await speak('', { voiceId: 'narrateur' });
    expect(speechSynthesisMock.speak.mock.calls.length === 0 && piper.predict.mock.calls.length === 0).toBe(true);
  });
});

describe('cancelSpeech', () => {
  it('calls speechSynthesis.cancel', async () => {
    const { cancelSpeech } = await load();
    cancelSpeech();
    expect(speechSynthesisMock.cancel.mock.calls.length > 0).toBe(true);
  });

  it('makes a pending speak resolve', async () => {
    speechSynthesisMock.speak = vi.fn(); // never ends by itself
    const { speak, cancelSpeech } = await load();
    let done = false;
    const p = speak('Long texte', { voiceId: 'narrateur' }).then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 5));
    cancelSpeech();
    await Promise.race([p, new Promise((r) => setTimeout(r, 200))]);
    expect(done).toBe(true);
  });
});

describe('STT', () => {
  it('isSttSupported true with SpeechRecognition', async () => {
    const { isSttSupported } = await load();
    expect(isSttSupported()).toBe(true);
  });

  it('isSttSupported true with webkitSpeechRecognition only', async () => {
    delete window.SpeechRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    const { isSttSupported } = await load();
    expect(isSttSupported()).toBe(true);
  });

  it('isSttSupported false when absent', async () => {
    delete window.SpeechRecognition;
    const { isSttSupported } = await load();
    expect(isSttSupported()).toBe(false);
  });

  it('listen resolves the trimmed transcript', async () => {
    const { listen } = await load();
    const r = await listen({ timeoutMs: 500 });
    expect(r === 'Saucisson').toBe(true);
  });

  it('listen sets recognition lang fr-FR', async () => {
    const { listen } = await load();
    await listen({ timeoutMs: 500 });
    expect(FakeRecognition.last.lang === 'fr-FR').toBe(true);
  });

  it('listen resolves null on error', async () => {
    ctl.mode = 'error';
    const { listen } = await load();
    const r = await listen({ timeoutMs: 500 });
    expect(r === null).toBe(true);
  });

  it('listen resolves null after timeout when nothing happens', async () => {
    ctl.mode = 'silent';
    const { listen } = await load();
    const r = await listen({ timeoutMs: 50 });
    expect(r === null).toBe(true);
  });

  it('listen resolves null immediately when unsupported', async () => {
    delete window.SpeechRecognition;
    const { listen } = await load();
    const r = await listen({ timeoutMs: 500 });
    expect(r === null).toBe(true);
  });

  it('stopListening makes a pending listen resolve null', async () => {
    ctl.mode = 'silent';
    const { listen, stopListening } = await load();
    const p = listen({ timeoutMs: 5000 });
    await new Promise((r) => setTimeout(r, 5));
    stopListening();
    const r = await Promise.race([p, new Promise((res) => setTimeout(() => res('hang'), 500))]);
    expect(r === null).toBe(true);
  });
});

describe('requestMicPermission', () => {
  const setMedia = (gum) => {
    Object.defineProperty(navigator, 'mediaDevices', { value: gum ? { getUserMedia: gum } : undefined, configurable: true, writable: true });
  };

  it('true and stops tracks when getUserMedia resolves', async () => {
    const track = { stop: vi.fn() };
    setMedia(vi.fn(async () => ({ getTracks: () => [track] })));
    const { requestMicPermission } = await load();
    const r = await requestMicPermission();
    expect(r === true && track.stop.mock.calls.length > 0).toBe(true);
  });

  it('false when getUserMedia rejects', async () => {
    setMedia(vi.fn(async () => {
      throw new Error('denied');
    }));
    const { requestMicPermission } = await load();
    expect((await requestMicPermission()) === false).toBe(true);
  });

  it('false when mediaDevices is missing', async () => {
    setMedia(null);
    const { requestMicPermission } = await load();
    expect((await requestMicPermission()) === false).toBe(true);
  });
});

describe('storage voice additions', () => {
  it('loadOptions defaults include readerMode and voiceId', async () => {
    const { loadOptions } = await import('../../src/lib/storage.js');
    const o = loadOptions();
    expect(o.readerMode === 'voix' && o.voiceId === 'narrateur' && o.designationAuto === true && o.timerPression === false).toBe(true);
  });

  it('loadUnlockedVoices defaults to narrateur', async () => {
    const { loadUnlockedVoices } = await import('../../src/lib/storage.js');
    expect(JSON.stringify(loadUnlockedVoices()) === JSON.stringify(['narrateur'])).toBe(true);
  });

  it('unlockVoice persists without duplicates and keeps narrateur', async () => {
    const { unlockVoice, loadUnlockedVoices } = await import('../../src/lib/storage.js');
    unlockVoice('robot');
    unlockVoice('robot');
    const v = loadUnlockedVoices();
    expect(v.filter((x) => x === 'robot').length === 1 && v.includes('narrateur')).toBe(true);
  });

  it('unlockVoice("bundle") unlocks the four paid voices', async () => {
    const { unlockVoice, loadUnlockedVoices } = await import('../../src/lib/storage.js');
    unlockVoice('bundle');
    const v = loadUnlockedVoices();
    expect(['robot', 'ecureuil', 'mamie', 'commentateur'].every((x) => v.includes(x))).toBe(true);
  });
});
