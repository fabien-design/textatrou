import {
  loadPlayers, savePlayers, loadOptions, saveOptions,
  loadUnlockedPacks, unlockPack, loadAgeConfirmed, saveAgeConfirmed,
} from '../../src/lib/storage.js';
import { requestWakeLock, shareText } from '../../src/lib/device.js';

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('storage players', () => {
  it('defaults to empty array', () => {
    expect(Array.isArray(loadPlayers()) && loadPlayers().length === 0).toBe(true);
  });
  it('round-trips players', () => {
    const p = ['Ana', 'Bob'];
    savePlayers(p);
    expect(JSON.stringify(loadPlayers()) === JSON.stringify(p)).toBe(true);
  });
  it('uses textatrou: prefix', () => {
    savePlayers(['Ana']);
    const keys = Object.keys(window.localStorage);
    expect(keys.length > 0 && keys.every((k) => k.startsWith('textatrou:'))).toBe(true);
  });
  it('corrupted JSON returns default', () => {
    savePlayers(['Ana']);
    const k = Object.keys(window.localStorage)[0];
    window.localStorage.setItem(k, '{not json');
    expect(loadPlayers().length === 0).toBe(true);
  });
  it('getItem throwing returns default', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadPlayers().length === 0).toBe(true);
  });
  it('setItem throwing does not throw on save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    let threw = false;
    try { savePlayers(['a']); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});

describe('storage options', () => {
  it('defaults', () => {
    const o = loadOptions();
    expect(o.designationAuto === true && o.timerPression === false).toBe(true);
  });
  it('merges partial save', () => {
    saveOptions({ timerPression: true });
    const o = loadOptions();
    expect(o.designationAuto === true && o.timerPression === true).toBe(true);
  });
  it('merges stored object missing keys with defaults', () => {
    saveOptions({ timerPression: true });
    const k = Object.keys(window.localStorage)[0];
    window.localStorage.setItem(k, JSON.stringify({ timerPression: true }));
    expect(loadOptions().designationAuto === true).toBe(true);
  });
  it('corrupted options return defaults', () => {
    saveOptions({ timerPression: true });
    const k = Object.keys(window.localStorage)[0];
    window.localStorage.setItem(k, 'zzz{');
    const o = loadOptions();
    expect(o.designationAuto === true && o.timerPression === false).toBe(true);
  });
  it('getItem throwing returns default options', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadOptions().designationAuto === true).toBe(true);
  });
  it('setItem throwing does not throw on saveOptions', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    let threw = false;
    try { saveOptions({ timerPression: true }); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});

describe('storage packs', () => {
  it('defaults to gratuit', () => {
    const p = loadUnlockedPacks();
    expect(p.length === 1 && p[0] === 'gratuit').toBe(true);
  });
  it('always includes gratuit', () => {
    window.localStorage.setItem('textatrou:packs', JSON.stringify(['trash']));
    unlockPack('trash');
    window.localStorage.clear();
    // find actual key by unlocking then overwriting
    unlockPack('trash');
    const k = Object.keys(window.localStorage)[0];
    window.localStorage.setItem(k, JSON.stringify(['trash']));
    expect(loadUnlockedPacks().includes('gratuit')).toBe(true);
  });
  it('unlockPack persists', () => {
    unlockPack('trash');
    expect(loadUnlockedPacks().includes('trash')).toBe(true);
  });
  it('unlockPack twice does not duplicate', () => {
    unlockPack('trash');
    unlockPack('trash');
    expect(loadUnlockedPacks().filter((x) => x === 'trash').length === 1).toBe(true);
  });
  it('unlockPack result includes gratuit and trash', () => {
    const r = unlockPack('trash');
    const arr = r === undefined ? loadUnlockedPacks() : r;
    expect(arr.includes('gratuit') && arr.includes('trash')).toBe(true);
  });
  it('getItem throwing returns gratuit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadUnlockedPacks().includes('gratuit')).toBe(true);
  });
});

describe('storage age', () => {
  it('defaults false', () => { expect(loadAgeConfirmed() === false).toBe(true); });
  it('persists true', () => {
    saveAgeConfirmed(true);
    expect(loadAgeConfirmed() === true).toBe(true);
  });
  it('getItem throwing returns false', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadAgeConfirmed() === false).toBe(true);
  });
  it('setItem throwing does not throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    let threw = false;
    try { saveAgeConfirmed(true); } catch { threw = true; }
    expect(threw).toBe(false);
  });
});

function setNav(name, value) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}
function delNav(name) { delete navigator[name]; }

describe('requestWakeLock', () => {
  afterEach(() => { delNav('wakeLock'); });
  it('no wakeLock gives no-throw function', async () => {
    setNav('wakeLock', undefined);
    const r = await requestWakeLock();
    let threw = false;
    try { r(); } catch { threw = true; }
    expect(typeof r === 'function' && !threw).toBe(true);
  });
  it('release is called on returned function', async () => {
    const sentinel = { release: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    setNav('wakeLock', { request });
    const r = await requestWakeLock();
    r();
    expect(sentinel.release).toHaveBeenCalled();
  });
  it('request called with screen', async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn() });
    setNav('wakeLock', { request });
    await requestWakeLock();
    expect(request).toHaveBeenCalledWith('screen');
  });
  it('rejection still resolves to no-throw function', async () => {
    setNav('wakeLock', { request: vi.fn().mockRejectedValue(new Error('denied')) });
    const r = await requestWakeLock();
    let threw = false;
    try { r(); } catch { threw = true; }
    expect(typeof r === 'function' && !threw).toBe(true);
  });
});

describe('shareText', () => {
  afterEach(() => { delNav('share'); delNav('clipboard'); });
  it('returns shared', async () => {
    const share = vi.fn().mockResolvedValue();
    setNav('share', share);
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'shared').toBe(true);
  });
  it('share called with object containing text', async () => {
    const share = vi.fn().mockResolvedValue();
    setNav('share', share);
    await shareText({ title: 'T', text: 'hello' });
    expect(share.mock.calls[0][0].text === 'hello').toBe(true);
  });
  it('AbortError gives cancelled', async () => {
    const e = new Error('a'); e.name = 'AbortError';
    setNav('share', vi.fn().mockRejectedValue(e));
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'cancelled').toBe(true);
  });
  it('no share, clipboard ok gives copied', async () => {
    setNav('share', undefined);
    const writeText = vi.fn().mockResolvedValue();
    setNav('clipboard', { writeText });
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'copied').toBe(true);
  });
  it('clipboard writeText called with text', async () => {
    setNav('share', undefined);
    const writeText = vi.fn().mockResolvedValue();
    setNav('clipboard', { writeText });
    await shareText({ title: 'T', text: 'hello' });
    expect(writeText).toHaveBeenCalledWith('hello');
  });
  it('no share and no clipboard gives failed', async () => {
    setNav('share', undefined);
    setNav('clipboard', undefined);
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'failed').toBe(true);
  });
  it('no share and writeText rejects gives failed', async () => {
    setNav('share', undefined);
    setNav('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('x')) });
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'failed').toBe(true);
  });
  it('other share error falls back to clipboard', async () => {
    setNav('share', vi.fn().mockRejectedValue(new Error('boom')));
    setNav('clipboard', { writeText: vi.fn().mockResolvedValue() });
    const r = await shareText({ title: 'T', text: 'hello' });
    expect(r === 'copied').toBe(true);
  });
});
