const KEYS = {
  players: 'textatrou:players',
  options: 'textatrou:options',
  packs: 'textatrou:packs',
  age: 'textatrou:age',
  voices: 'textatrou:voices',
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadPlayers() {
  const v = read(KEYS.players, []);
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : [];
}

export function savePlayers(arr) {
  write(KEYS.players, arr);
}

export function loadOptions() {
  const stored = read(KEYS.options, {});
  const obj = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return { designationAuto: true, timerPression: false, readerMode: 'voix', voiceId: 'narrateur', ...obj };
}

export function saveOptions(partial) {
  write(KEYS.options, { ...loadOptions(), ...partial });
}

export function loadUnlockedPacks() {
  const v = read(KEYS.packs, []);
  const arr = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  return ['gratuit', ...arr.filter((x) => x !== 'gratuit')].filter((x, i, a) => a.indexOf(x) === i);
}

export function unlockPack(id) {
  const next = loadUnlockedPacks();
  if (!next.includes(id)) next.push(id);
  write(KEYS.packs, next);
  return next;
}

export function loadAgeConfirmed() {
  return read(KEYS.age, false) === true;
}

export function saveAgeConfirmed(bool) {
  write(KEYS.age, bool);
}

const PAID_VOICES = ['robot', 'ecureuil', 'mamie', 'commentateur'];

export function loadUnlockedVoices() {
  const v = read(KEYS.voices, []);
  const arr = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  return ['narrateur', ...arr].filter((x, i, a) => a.indexOf(x) === i);
}

export function unlockVoice(id) {
  const next = loadUnlockedVoices();
  const add = id === 'bundle' ? PAID_VOICES : [id];
  for (const x of add) if (!next.includes(x)) next.push(x);
  write(KEYS.voices, next);
  return next;
}
