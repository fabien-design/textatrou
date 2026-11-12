const KEYS = {
  players: 'textatrou:players',
  options: 'textatrou:options',
  packs: 'textatrou:packs',
  age: 'textatrou:age',
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
  return { designationAuto: true, timerPression: false, ...obj };
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
