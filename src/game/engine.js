const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function prepareStory(story, players, reader, rng = Math.random) {
  const copy = JSON.parse(JSON.stringify(story));
  let pool = players.filter((p) => p !== reader);
  if (pool.length === 0) pool = players.slice();
  const sub = (t) =>
    typeof t === 'string' ? t.replace(/\{JOUEUR_RANDOM\}/g, () => pick(pool, rng)) : t;
  for (const seg of copy.segments || []) {
    if ('texte_avant' in seg) seg.texte_avant = sub(seg.texte_avant);
    if ('texte_fin' in seg) seg.texte_fin = sub(seg.texte_fin);
  }
  return copy;
}

export function pickResponder(players, reader, previous, rng = Math.random) {
  let c = players.filter((p) => p !== reader);
  if (c.length >= 2 && previous != null) {
    const f = c.filter((p) => p !== previous);
    if (f.length >= 1) c = f;
  }
  return pick(c, rng);
}

export function nextReader(players, current) {
  const i = current == null ? -1 : players.indexOf(current);
  if (i < 0) return players[0];
  return players[(i + 1) % players.length];
}

export function pickJoker(jokers, category, rng = Math.random) {
  const own = jokers && jokers[category];
  if (Array.isArray(own) && own.length) return pick(own, rng);
  const all = Object.values(jokers || {}).flat();
  return all.length ? pick(all, rng) : '';
}

export function fakeText(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }
    let h = (i * 31 + ch.charCodeAt(0) * 17 + 7) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    let letter = String.fromCharCode(97 + (((h ^ (h >>> 16)) >>> 0) % 26));
    if (letter === ch.toLowerCase()) {
      letter = String.fromCharCode(97 + ((letter.charCodeAt(0) - 97 + 1) % 26));
    }
    out += letter;
  }
  return out;
}

export function holeCount(story) {
  return (story.segments || []).filter((s) => s.trou).length;
}

export function buildStoryText(story, answers) {
  const parts = [];
  let h = 0;
  for (const seg of story.segments || []) {
    if (seg.texte_avant) parts.push(seg.texte_avant);
    if (seg.trou) {
      const a = answers && answers[h];
      const w = a && typeof a.word === 'string' ? a.word.trim() : '';
      parts.push(w || '[' + seg.trou.consigne + ']');
      h++;
    }
    if (seg.texte_fin) parts.push(seg.texte_fin);
  }
  let out = '';
  for (const raw of parts) {
    const p = String(raw).trim();
    if (!p) continue;
    if (out && !/^[,.…)\]»”’"']/.test(p)) out += ' ';
    out += p;
  }
  return out;
}

export function pickStory(stories, filter, playedIds = [], rng = Math.random) {
  const matching = stories.filter((s) => {
    if (filter.pack != null && s.pack !== filter.pack) return false;
    if (filter.thematique != null && s.thematique !== filter.thematique) return false;
    if (filter.packs && !filter.packs.includes(s.pack)) return false;
    return true;
  });
  if (!matching.length) return null;
  const unplayed = matching.filter((s) => !playedIds.includes(s.id));
  return pick(unplayed.length ? unplayed : matching, rng);
}

export function pickThemes(stories, themes, unlockedPacks, playedIds, rng = Math.random, n = 3) {
  const t1 = [], t2 = [], t3 = [];
  for (const th of themes) {
    const inUnlocked = stories.filter(
      (s) => s.thematique === th.id && unlockedPacks.includes(s.pack)
    );
    if (!inUnlocked.length) t3.push({ ...th, locked: true });
    else if (inUnlocked.some((s) => !playedIds.includes(s.id))) t1.push({ ...th, locked: false });
    else t2.push({ ...th, locked: false });
  }
  return [...shuffle(t1, rng), ...shuffle(t2, rng), ...shuffle(t3, rng)].slice(0, n);
}

export function countStories(stories, pack) {
  return stories.filter((s) => s.pack === pack).length;
}
