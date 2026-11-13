import { JOKERS, PACKS, THEMES, STORIES } from '../../src/data/stories.js';

const isStr = (s) => typeof s === 'string' && s.length > 0;
const jokerKeys = [
  'objet_masc', 'objet_fem', 'verbe_inf', 'personne', 'animal',
  'nombre', 'lieu', 'adjectif_masc', 'nourriture',
];
const trous = (s) => s.segments.filter((g) => g.trou);
const allText = (s) =>
  s.segments.map((g) => (g.texte_avant ?? '') + (g.texte_fin ?? '')).join('');

describe('JOKERS', () => {
  it('contains the required keys', () => {
    expect(jokerKeys.every((k) => k in JOKERS)).toBe(true);
  });
  it.each(jokerKeys)('%s has >= 15 entries', (k) => {
    expect(Array.isArray(JOKERS[k]) && JOKERS[k].length >= 15).toBe(true);
  });
  it.each(jokerKeys)('%s entries are unique', (k) => {
    expect(new Set(JOKERS[k]).size === JOKERS[k].length).toBe(true);
  });
  it.each(jokerKeys)('%s entries are non-empty trimmed strings', (k) => {
    expect(JOKERS[k].every((w) => isStr(w) && w === w.trim())).toBe(true);
  });
});

describe('PACKS', () => {
  it('has 3 packs', () => {
    expect(PACKS.length === 3).toBe(true);
  });
  it('gratuit pack matches', () => {
    const p = PACKS.find((x) => x.id === 'gratuit');
    expect(!!p && p.name === 'Classique' && p.emoji === '🎭' && p.price === null).toBe(true);
  });
  it('trash pack matches', () => {
    const p = PACKS.find((x) => x.id === 'trash');
    expect(!!p && p.name === 'Soirée & Trash' && p.emoji === '🔥' && p.price === '4,99 €').toBe(true);
  });
  it('trash pack is adult', () => {
    expect(PACKS.find((x) => x.id === 'trash')?.adult === true).toBe(true);
  });
  it('pop_culture pack matches', () => {
    const p = PACKS.find((x) => x.id === 'pop_culture');
    expect(!!p && p.name === 'Pop Culture & Cinéma' && p.emoji === '🎬' && p.price === '2,99 €').toBe(true);
  });
});

describe('THEMES', () => {
  it('has exactly 6 themes', () => {
    expect(THEMES.length === 6).toBe(true);
  });
  it('ids are unique', () => {
    expect(new Set(THEMES.map((t) => t.id)).size === THEMES.length).toBe(true);
  });
  it('fields are non-empty strings', () => {
    expect(THEMES.every((t) => isStr(t.id) && isStr(t.label) && isStr(t.emoji))).toBe(true);
  });
});

describe('STORIES collection', () => {
  it('has exactly 12 stories', () => {
    expect(STORIES.length === 12).toBe(true);
  });
  it.each([['gratuit', 6], ['trash', 3], ['pop_culture', 3]])('pack %s has %i stories', (id, n) => {
    expect(STORIES.filter((s) => s.pack === id).length === n).toBe(true);
  });
  it('ids are unique strings', () => {
    expect(STORIES.every((s) => isStr(s.id)) && new Set(STORIES.map((s) => s.id)).size === STORIES.length).toBe(true);
  });
  it('every theme id is used by >= 2 stories', () => {
    expect(THEMES.every((t) => STORIES.filter((s) => s.thematique === t.id).length >= 2)).toBe(true);
  });
  it('gratuit stories cover >= 3 thematiques', () => {
    const set = new Set(STORIES.filter((s) => s.pack === 'gratuit').map((s) => s.thematique));
    expect(set.size >= 3).toBe(true);
  });
});

describe.each(STORIES.map((s) => [s.id, s]))('story %s', (_id, s) => {
  it('pack is a known pack id', () => {
    expect(PACKS.some((p) => p.id === s.pack)).toBe(true);
  });
  it('theme and titre are non-empty strings', () => {
    expect(isStr(s.theme) && isStr(s.titre)).toBe(true);
  });
  it('thematique is a known theme id', () => {
    expect(THEMES.some((t) => t.id === s.thematique)).toBe(true);
  });
  it('has 4 to 7 trous', () => {
    expect(trous(s).length >= 4 && trous(s).length <= 7).toBe(true);
  });
  it('non-last segments have texte_avant and trou', () => {
    expect(s.segments.slice(0, -1).every((g) => isStr(g.texte_avant) && g.trou && typeof g.trou === 'object')).toBe(true);
  });
  it('trou consignes are non-empty uppercase', () => {
    expect(trous(s).every((g) => isStr(g.trou.consigne) && g.trou.consigne === g.trou.consigne.toUpperCase())).toBe(true);
  });
  it('trou categorie_joker is a JOKERS key', () => {
    expect(trous(s).every((g) => g.trou.categorie_joker in JOKERS)).toBe(true);
  });
  it('last segment has only texte_fin, no trou', () => {
    const last = s.segments[s.segments.length - 1];
    expect(isStr(last.texte_fin) && !('trou' in last) && !('texte_avant' in last)).toBe(true);
  });
  it('contains {JOUEUR_RANDOM}', () => {
    expect(allText(s).includes('{JOUEUR_RANDOM}')).toBe(true);
  });
  it('has no other placeholders', () => {
    const m = allText(s).match(/\{[A-Z_]+\}/g) || [];
    expect(m.every((x) => x === '{JOUEUR_RANDOM}')).toBe(true);
  });
});
