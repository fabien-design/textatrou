import { describe, it, expect } from 'vitest';
import { JOKERS, THEMES, STORIES } from '../../src/data/stories.js';
import {
  prepareStory, pickJoker, buildStoryText, pickStory, pickThemes, countStories, fakeText,
} from '../../src/game/engine.js';

const PLAYERS = ['Alex', 'Sam', 'Léa', 'Mo'];
const textsOf = (story) =>
  story.segments.flatMap((s) => [s.texte_avant, s.texte_fin].filter((t) => typeof t === 'string'));
const holesOf = (story) => story.segments.filter((s) => s.trou);
const gratuit = STORIES.filter((s) => s.pack === 'gratuit');

describe('foundations integration', () => {
  it('1. prepareStory removes placeholders and never injects the reader', () => {
    for (const story of STORIES) {
      const origAlex = textsOf(story).map((t) => t.includes('Alex'));
      for (let i = 0; i < 20; i++) {
        const prepared = prepareStory(story, PLAYERS, 'Alex', Math.random);
        const texts = textsOf(prepared);
        texts.forEach((t, idx) => {
          expect(t, story.id).not.toContain('{JOUEUR_RANDOM}');
          if (!origAlex[idx]) expect(t, story.id).not.toContain('Alex');
        });
      }
    }
  });

  it('2. pickJoker returns a word from the category for every used category', () => {
    const cats = new Set(STORIES.flatMap((s) => holesOf(s).map((h) => h.trou.categorie_joker)));
    for (const cat of cats) {
      expect(JOKERS[cat], cat).toBeTruthy();
      const w = pickJoker(JOKERS, cat);
      expect(typeof w).toBe('string');
      expect(w.length).toBeGreaterThan(0);
      expect(JOKERS[cat]).toContain(w);
    }
  });

  it('3. buildStoryText with no answers shows consignes and all texts', () => {
    for (const story of STORIES) {
      const prepared = prepareStory(story, PLAYERS, 'Alex');
      const out = buildStoryText(prepared, []);
      for (const h of holesOf(prepared)) expect(out, story.id).toContain('[' + h.trou.consigne + ']');
      for (const t of textsOf(prepared)) expect(out, story.id).toContain(t.trim());
    }
  });

  it('4. buildStoryText with jokers contains every joker word', () => {
    for (const story of STORIES) {
      const prepared = prepareStory(story, PLAYERS, 'Alex');
      const words = holesOf(prepared).map((h) => pickJoker(JOKERS, h.trou.categorie_joker));
      const out = buildStoryText(prepared, words.map((word) => ({ word })));
      for (const w of words) expect(out, story.id).toContain(w);
    }
  });

  it('5. countStories gratuit is 6', () => {
    expect(countStories(STORIES, 'gratuit')).toBe(6);
  });

  it('6. pickStory returns a story for each theme id', () => {
    for (const th of THEMES) {
      const s = pickStory(STORIES, { thematique: th.id, packs: ['gratuit', 'trash', 'pop_culture'] }, []);
      expect(s, th.id).toBeTruthy();
      expect(s.thematique).toBe(th.id);
    }
  });

  it('7. pickThemes returns 3 distinct unlocked themes with gratuit stories', () => {
    const r = pickThemes(STORIES, THEMES, ['gratuit'], []);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((t) => t.id)).size).toBe(3);
    for (const t of r) {
      expect(t.locked).toBe(false);
      expect(gratuit.some((s) => s.thematique === t.id), t.id).toBe(true);
    }
  });

  it('8. pickThemes with all gratuit played still returns 3 themes', () => {
    const r = pickThemes(STORIES, THEMES, ['gratuit'], gratuit.map((s) => s.id));
    expect(r).toHaveLength(3);
    for (const t of r) {
      if (!t.locked) expect(gratuit.some((s) => s.thematique === t.id), t.id).toBe(true);
    }
  });

  it('9. fakeText leaks no word of >= 4 letters', () => {
    for (const story of STORIES) {
      for (const text of textsOf(story)) {
        const fake = fakeText(text).toLowerCase();
        const words = text.toLowerCase().match(/[\p{L}]{4,}/gu) || [];
        const fakeWords = new Set(fake.match(/[\p{L}]+/gu) || []);
        for (const w of words) expect(fakeWords.has(w), `${story.id}: ${w}`).toBe(false);
      }
    }
  });

  it('10. lib and ui modules import and expose expected names', async () => {
    const audio = await import('../../src/lib/audio.js');
    const storage = await import('../../src/lib/storage.js');
    const device = await import('../../src/lib/device.js');
    const ui = await import('../../src/components/ui/index.js');
    for (const n of ['unlockAudio', 'playPop', 'playJoker', 'playBadumTss', 'playScream', 'playApplause', 'playBeep'])
      expect(typeof audio[n], n).toBe('function');
    for (const n of ['loadPlayers', 'savePlayers', 'loadOptions', 'saveOptions', 'loadUnlockedPacks', 'unlockPack', 'loadAgeConfirmed', 'saveAgeConfirmed'])
      expect(typeof storage[n], n).toBe('function');
    for (const n of ['requestWakeLock', 'shareText']) expect(typeof device[n], n).toBe('function');
    for (const n of ['Button', 'Card', 'Toggle', 'Modal', 'Pill']) expect(typeof ui[n], n).toBe('function');
  });
});
