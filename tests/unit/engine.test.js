import {
  prepareStory,
  pickResponder,
  nextReader,
  pickJoker,
  fakeText,
  holeCount,
  buildStoryText,
  pickStory,
  pickThemes,
  countStories,
} from '../../src/game/engine.js';

function seeded(seed = 12345) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const mkStory = (id, pack, thematique, extra = {}) => ({
  id,
  pack,
  theme: thematique,
  thematique,
  titre: 'Titre ' + id,
  segments: [
    { texte_avant: 'Salut {JOUEUR_RANDOM} et {JOUEUR_RANDOM}.', trou: { consigne: 'un animal', categorie_joker: 'animaux' } },
    { texte_avant: 'Puis {JOUEUR_RANDOM} mange', trou: { consigne: 'un plat', categorie_joker: 'plats' } },
    { texte_fin: 'Fin avec {JOUEUR_RANDOM}.' },
  ],
  ...extra,
});

const players = ['Ana', 'Ben', 'Cleo', 'Dan'];

describe('prepareStory', () => {
  it('does not mutate the original story', () => {
    const s = mkStory('a', 'p1', 't1');
    const snap = JSON.stringify(s);
    prepareStory(s, players, 'Ana', () => 0);
    expect(JSON.stringify(s) === snap).toBe(true);
  });

  it('returns a deep copy with distinct nested segments', () => {
    const s = mkStory('a', 'p1', 't1');
    const r = prepareStory(s, players, 'Ana', () => 0);
    expect(r !== s && r.segments !== s.segments && r.segments[0] !== s.segments[0]).toBe(true);
  });

  it('replaces every placeholder', () => {
    const r = prepareStory(mkStory('a', 'p1', 't1'), players, 'Ana', seeded());
    expect(JSON.stringify(r).includes('{JOUEUR_RANDOM}')).toBe(false);
  });

  it('never uses the reader name', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const r = prepareStory(mkStory('a', 'p1', 't1'), players, 'Ben', Math.random);
      const txt = r.segments.map((x) => (x.texte_avant || '') + (x.texte_fin || '')).join(' ');
      if (/Ben/.test(txt)) found = true;
    }
    expect(found).toBe(false);
  });

  it('replaces occurrences independently (several distinct names)', () => {
    const names = new Set();
    for (let i = 0; i < 100; i++) {
      const r = prepareStory(mkStory('a', 'p1', 't1'), players, 'Ana', Math.random);
      const m = r.segments[0].texte_avant.match(/Salut (\w+) et (\w+)\./);
      names.add(m[1]);
      names.add(m[2]);
    }
    expect(names.size > 1).toBe(true);
  });

  it('keeps other fields unchanged', () => {
    const s = mkStory('a', 'p1', 't1');
    const r = prepareStory(s, players, 'Ana', () => 0);
    expect(
      r.id === s.id && r.pack === s.pack && r.titre === s.titre && r.thematique === s.thematique &&
        JSON.stringify(r.segments[0].trou) === JSON.stringify(s.segments[0].trou)
    ).toBe(true);
  });
});

describe('pickResponder', () => {
  it('returns a player other than the reader', () => {
    let ok = true;
    for (let i = 0; i < 100; i++) {
      const r = pickResponder(players, 'Cleo', null, Math.random);
      if (!players.includes(r) || r === 'Cleo') ok = false;
    }
    expect(ok).toBe(true);
  });

  it('never equals previous when 2+ candidates', () => {
    let ok = true;
    for (let i = 0; i < 200; i++) {
      if (pickResponder(players, 'Ana', 'Ben', Math.random) === 'Ben') ok = false;
    }
    expect(ok).toBe(true);
  });

  it('never equals previous with extreme rngs', () => {
    expect(pickResponder(players, 'Ana', 'Ben', () => 0) !== 'Ben').toBe(true);
    expect(pickResponder(players, 'Ana', 'Dan', () => 0.999) !== 'Dan').toBe(true);
  });

  it('returns the only candidate even if it equals previous', () => {
    expect(pickResponder(['Ana', 'Ben'], 'Ana', 'Ben', () => 0) === 'Ben').toBe(true);
  });
});

describe('nextReader', () => {
  it('returns the next player in order', () => {
    expect(nextReader(players, 'Ben') === 'Cleo').toBe(true);
  });
  it('wraps from last to first', () => {
    expect(nextReader(players, 'Dan') === 'Ana').toBe(true);
  });
  it('returns first when current is null', () => {
    expect(nextReader(players, null) === 'Ana').toBe(true);
  });
  it('returns first when current is undefined', () => {
    expect(nextReader(players, undefined) === 'Ana').toBe(true);
  });
  it('returns first when current is unknown', () => {
    expect(nextReader(players, 'Zed') === 'Ana').toBe(true);
  });
});

describe('pickJoker', () => {
  const jokers = { animaux: ['chat', 'chien'], plats: ['pizza', 'soupe'], vide: [] };
  const all = ['chat', 'chien', 'pizza', 'soupe'];

  it('picks from the requested category', () => {
    let ok = true;
    for (let i = 0; i < 50; i++) if (!jokers.animaux.includes(pickJoker(jokers, 'animaux', Math.random))) ok = false;
    expect(ok).toBe(true);
  });
  it('falls back to another category when missing', () => {
    expect(all.includes(pickJoker(jokers, 'inconnue', () => 0))).toBe(true);
  });
  it('falls back to another category when empty', () => {
    expect(all.includes(pickJoker(jokers, 'vide', () => 0.5))).toBe(true);
  });
  it('fallback returns a string', () => {
    expect(typeof pickJoker(jokers, 'inconnue', () => 0.999) === 'string').toBe(true);
  });
});

describe('fakeText', () => {
  const text = 'Le  grand chasseur\nmange une pomme, vraiment!';

  it('keeps the same length', () => {
    expect(fakeText(text).length === text.length).toBe(true);
  });
  it('keeps whitespace at the same positions', () => {
    const out = fakeText(text);
    let ok = true;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]) !== /\s/.test(out[i])) ok = false;
      if (/\s/.test(text[i]) && text[i] !== out[i]) ok = false;
    }
    expect(ok).toBe(true);
  });
  it('replaces non-whitespace with lowercase a-z', () => {
    const out = fakeText(text);
    let ok = true;
    for (const ch of out) if (!/\s/.test(ch) && !/[a-z]/.test(ch)) ok = false;
    expect(ok).toBe(true);
  });
  it('is deterministic', () => {
    expect(fakeText(text) === fakeText(text)).toBe(true);
  });
  it('does not leak words of 3+ letters', () => {
    const out = fakeText(text).split(/[^a-z]+/).filter(Boolean);
    const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿ]{3,}/g) || [];
    expect(words.some((w) => out.includes(w))).toBe(false);
  });
});

describe('holeCount', () => {
  it('counts segments having a trou', () => {
    expect(holeCount(mkStory('a', 'p1', 't1')) === 2).toBe(true);
  });
  it('returns 0 with no hole', () => {
    expect(holeCount({ segments: [{ texte_fin: 'x' }] }) === 0).toBe(true);
  });
});

describe('buildStoryText', () => {
  const story = {
    segments: [
      { texte_avant: 'AVANT_UN', trou: { consigne: 'un animal', categorie_joker: 'animaux' } },
      { texte_avant: 'AVANT_DEUX', trou: { consigne: 'un plat', categorie_joker: 'plats' } },
      { texte_fin: 'FIN_TEXTE' },
    ],
  };

  it('contains all fixed texts in order', () => {
    const t = buildStoryText(story, [{ word: 'chat' }, { word: 'pizza' }]);
    const i1 = t.indexOf('AVANT_UN'), i2 = t.indexOf('AVANT_DEUX'), i3 = t.indexOf('FIN_TEXTE');
    expect(i1 >= 0 && i1 < i2 && i2 < i3).toBe(true);
  });
  it('inserts answers between the texts', () => {
    const t = buildStoryText(story, [{ word: 'chat' }, { word: 'pizza' }]);
    expect(t.indexOf('AVANT_UN') < t.indexOf('chat') && t.indexOf('chat') < t.indexOf('AVANT_DEUX') &&
      t.indexOf('AVANT_DEUX') < t.indexOf('pizza') && t.indexOf('pizza') < t.indexOf('FIN_TEXTE')).toBe(true);
  });
  it('uses [consigne] when word is missing', () => {
    const t = buildStoryText(story, [{ joker: 'x' }, { word: 'pizza' }]);
    expect(t.includes('[un animal]')).toBe(true);
  });
  it('uses [consigne] when word is empty', () => {
    const t = buildStoryText(story, [{ word: 'chat' }, { word: '' }]);
    expect(t.includes('[un plat]')).toBe(true);
  });
  it('does not show the placeholder when the word is given', () => {
    const t = buildStoryText(story, [{ word: 'chat' }, { word: 'pizza' }]);
    expect(t.includes('[un animal]') || t.includes('[un plat]')).toBe(false);
  });
});

describe('pickStory', () => {
  const stories = [
    mkStory('s1', 'p1', 'ta'),
    mkStory('s2', 'p1', 'tb'),
    mkStory('s3', 'p2', 'ta'),
    mkStory('s4', 'p3', 'ta'),
  ];

  it('filters by pack', () => {
    let ok = true;
    for (let i = 0; i < 50; i++) if (pickStory(stories, { pack: 'p1' }, [], Math.random).pack !== 'p1') ok = false;
    expect(ok).toBe(true);
  });
  it('avoids played stories when possible', () => {
    let ok = true;
    for (let i = 0; i < 50; i++) if (pickStory(stories, { pack: 'p1' }, ['s1'], Math.random).id !== 's2') ok = false;
    expect(ok).toBe(true);
  });
  it('returns a matching story when all are played', () => {
    const r = pickStory(stories, { pack: 'p1' }, ['s1', 's2'], () => 0);
    expect(r !== null && r.pack === 'p1').toBe(true);
  });
  it('returns null when none match', () => {
    expect(pickStory(stories, { pack: 'nope' }, [], () => 0) === null).toBe(true);
  });
  it('filters by thematique and packs', () => {
    let ok = true;
    for (let i = 0; i < 50; i++) {
      const r = pickStory(stories, { thematique: 'ta', packs: ['p1', 'p2'] }, [], Math.random);
      if (r.thematique !== 'ta' || !['p1', 'p2'].includes(r.pack)) ok = false;
    }
    expect(ok).toBe(true);
  });
  it('thematique+packs excludes other packs', () => {
    let ok = true;
    for (let i = 0; i < 50; i++) {
      if (pickStory(stories, { thematique: 'ta', packs: ['p2'] }, [], Math.random).id !== 's3') ok = false;
    }
    expect(ok).toBe(true);
  });
  it('thematique+packs returns null when no match', () => {
    expect(pickStory(stories, { thematique: 'tb', packs: ['p2'] }, [], () => 0) === null).toBe(true);
  });
});

describe('pickThemes', () => {
  const themes = [
    { id: 'ta', label: 'A', emoji: 'a' },
    { id: 'tb', label: 'B', emoji: 'b' },
    { id: 'tc', label: 'C', emoji: 'c' },
    { id: 'td', label: 'D', emoji: 'd' },
  ];
  const stories = [
    mkStory('s1', 'free', 'ta'),
    mkStory('s2', 'free', 'tb'),
    mkStory('s3', 'paid', 'tc'),
    mkStory('s4', 'paid', 'td'),
  ];

  it('returns n distinct themes', () => {
    const r = pickThemes(stories, themes, ['free'], [], seeded(), 3);
    expect(r.length === 3 && new Set(r.map((t) => t.id)).size === 3).toBe(true);
  });
  it('defaults n to 3', () => {
    expect(pickThemes(stories, themes, ['free'], [], seeded()).length === 3).toBe(true);
  });
  it('unlocked themes come first, locked last', () => {
    const r = pickThemes(stories, themes, ['free'], [], seeded(), 3);
    expect(r[0].locked === false && r[1].locked === false && r[2].locked === true).toBe(true);
  });
  it('the two unlocked themes are ta and tb', () => {
    const r = pickThemes(stories, themes, ['free'], [], seeded(), 3);
    expect(new Set([r[0].id, r[1].id]).has('ta') && new Set([r[0].id, r[1].id]).has('tb')).toBe(true);
  });
  it('third theme is one of the locked ones', () => {
    const r = pickThemes(stories, themes, ['free'], [], seeded(), 3);
    expect(['tc', 'td'].includes(r[2].id)).toBe(true);
  });
  it('unplayed themes are before fully played unlocked themes', () => {
    const r = pickThemes(stories, themes, ['free'], ['s1'], seeded(), 3);
    expect(r[0].id === 'tb' && r[1].id === 'ta' && r[2].locked === true).toBe(true);
  });
  it('fully played unlocked themes come before locked ones', () => {
    const r = pickThemes(stories, themes, ['free'], ['s1', 's2'], seeded(), 3);
    expect(r[0].locked === false && r[1].locked === false && r[2].locked === true).toBe(true);
  });
  it('returns all themes when fewer than n exist', () => {
    const r = pickThemes(stories, themes.slice(0, 2), ['free'], [], seeded(), 3);
    expect(r.length === 2).toBe(true);
  });
  it('theme objects expose id, label, emoji', () => {
    const r = pickThemes(stories, themes, ['free'], [], seeded(), 3);
    expect(r.every((t) => t.id && t.label && t.emoji && typeof t.locked === 'boolean')).toBe(true);
  });
  it('everything unlocked gives no locked theme', () => {
    const r = pickThemes(stories, themes, ['free', 'paid'], [], seeded(), 3);
    expect(r.every((t) => t.locked === false)).toBe(true);
  });
});

describe('countStories', () => {
  const stories = [mkStory('1', 'p1', 'a'), mkStory('2', 'p1', 'b'), mkStory('3', 'p2', 'a')];
  it('counts stories of a pack', () => {
    expect(countStories(stories, 'p1') === 2).toBe(true);
  });
  it('returns 0 for unknown pack', () => {
    expect(countStories(stories, 'zzz') === 0).toBe(true);
  });
});
