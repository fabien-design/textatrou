import { STORIES, JOKERS } from '../../src/data/stories.js';

const ALLOWED = ['OBJET', 'NOMBRE', 'CÉLÉBRITÉ', 'ANIMAL', 'LIEU', 'ADJECTIF', 'VERBE', 'NOURRITURE', 'PARTIE DU CORPS', 'MÉTIER'];
const MAP = {
  'OBJET': ['objet_masc', 'objet_fem'],
  'NOMBRE': ['nombre'],
  'CÉLÉBRITÉ': ['personne'],
  'ANIMAL': ['animal'],
  'LIEU': ['lieu'],
  'ADJECTIF': ['adjectif_masc'],
  'VERBE': ['verbe_inf'],
  'NOURRITURE': ['nourriture'],
  'PARTIE DU CORPS': ['partie_corps'],
  'MÉTIER': ['metier'],
};
const ARTICLES = ['un', 'une', 'le', 'la', 'du', 'des', 'son', 'sa', 'mon', 'ma', 'ton', 'ta'];

const holes = () => STORIES.flatMap((s) => s.segments.filter((g) => g.trou).map((g) => ({ id: s.id, g })));

describe('stories v2', () => {
  it('every consigne is in the allowed list', () => {
    expect(holes().every(({ g }) => ALLOWED.includes(g.trou.consigne))).toBe(true);
  });

  it('consigne maps to a consistent categorie_joker', () => {
    expect(holes().every(({ g }) => (MAP[g.trou.consigne] || []).includes(g.trou.categorie_joker))).toBe(true);
  });

  it('JOKERS.partie_corps has >= 18 unique clean strings', () => {
    const a = JOKERS.partie_corps;
    expect(Array.isArray(a) && a.length >= 18 && new Set(a).size === a.length
      && a.every((x) => typeof x === 'string' && x.trim() !== '' && x === x.trim())).toBe(true);
  });

  it('JOKERS.metier has >= 18 unique clean strings', () => {
    const a = JOKERS.metier;
    expect(Array.isArray(a) && a.length >= 18 && new Set(a).size === a.length
      && a.every((x) => typeof x === 'string' && x.trim() !== '' && x === x.trim())).toBe(true);
  });

  it('at least 3 stories use PARTIE DU CORPS or MÉTIER', () => {
    const n = STORIES.filter((s) => s.segments.some((g) => g.trou && ['PARTIE DU CORPS', 'MÉTIER'].includes(g.trou.consigne))).length;
    expect(n >= 3).toBe(true);
  });

  it('no consigne contains ( or +', () => {
    expect(holes().every(({ g }) => !/[(+]/.test(g.trou.consigne))).toBe(true);
  });

  it('gender-neutral slots are not preceded by a gendered article', () => {
    const bad = holes().filter(({ id, g }) => {
      if (id === 'braquage_01') return false;
      if (!['OBJET', 'ANIMAL', 'NOURRITURE'].includes(g.trou.consigne)) return false;
      const words = g.texte_avant.trim().split(/\s+/);
      return ARTICLES.includes(words[words.length - 1].toLowerCase());
    });
    expect(bad.length === 0).toBe(true);
  });
});
