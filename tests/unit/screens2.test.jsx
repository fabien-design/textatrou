import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({
  speak: vi.fn(async () => {}),
  listen: vi.fn(async () => 'chaussette'),
  unlockSpeech: vi.fn(),
  requestMicPermission: vi.fn(async () => true),
  unlockAudio: vi.fn(),
  shareText: vi.fn(async () => 'copied'),
}));

vi.mock('../../src/lib/speech.js', () => {
  const v = (id, name, emoji, price) => ({ id, name, emoji, price, model: id, rate: 1, pitch: 1, effect: null });
  return {
    VOICES: [
      v('narrateur', 'Narrateur', '🎙️', null),
      v('robot', 'Robot', '🤖', '0,99 €'),
      v('ecureuil', 'Écureuil', '🐿️', '0,99 €'),
      v('mamie', 'Mamie', '👵', '0,99 €'),
      v('commentateur', 'Commentateur', '⚽', '0,99 €'),
    ],
    VOICE_BUNDLE: { id: 'bundle', name: 'Toutes les voix', emoji: '🎁', price: '2,49 €', includes: ['robot', 'ecureuil', 'mamie', 'commentateur'] },
    speak: m.speak,
    cancelSpeech: vi.fn(),
    listen: m.listen,
    stopListening: vi.fn(),
    isSttSupported: vi.fn(() => true),
    requestMicPermission: m.requestMicPermission,
    unlockSpeech: m.unlockSpeech,
    preloadVoice: vi.fn(async (id, cb) => { cb && cb(0.5); cb && cb(1); return true; }),
    isVoiceReady: vi.fn(() => false),
  };
});
vi.mock('../../src/lib/audio.js', () => ({
  unlockAudio: m.unlockAudio,
  playSound: vi.fn(),
  playTick: vi.fn(),
  playSuccess: vi.fn(),
}));
vi.mock('../../src/lib/device.js', () => ({
  requestWakeLock: vi.fn(async () => () => {}),
  shareText: m.shareText,
}));

import HomeScreen from '../../src/screens/HomeScreen.jsx';
import LobbyScreen from '../../src/screens/LobbyScreen.jsx';
import PacksScreen from '../../src/screens/PacksScreen.jsx';
import ReaderTurnScreen from '../../src/screens/ReaderTurnScreen.jsx';
import EndGameScreen from '../../src/screens/EndGameScreen.jsx';
import { PACKS } from '../../src/data/stories.js';
import { buildStoryText } from '../../src/game/engine.js';
import { VOICES, VOICE_BUNDLE } from '../../src/lib/speech.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('HomeScreen v2', () => {
  const setup = (options = { designationAuto: true, timerPression: false, readerMode: 'voix' }) => {
    const p = { freeCount: 6, onPlay: vi.fn(), onPacks: vi.fn(), options, onOptionsChange: vi.fn() };
    render(<HomeScreen {...p} />);
    return p;
  };
  it('shows title', () => { setup(); expect(!!screen.queryByText('TEXTATROU')).toBe(true); });
  it('play button calls onPlay', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }));
    expect(p.onPlay).toHaveBeenCalledTimes(1);
  });
  it('packs button shows free count and calls onPacks', async () => {
    const p = setup(); const b = screen.getByRole('button', { name: /packs/i });
    expect(b.textContent.includes('6 gratuits')).toBe(true);
    await userEvent.click(b); expect(p.onPacks).toHaveBeenCalledTimes(1);
  });
  it('rules dialog has 3 steps', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: 'Règles' }));
    const d = screen.getByRole('dialog');
    expect(within(d).getAllByRole('listitem').length).toBe(3);
  });
  it('settings has switches désignation and timer', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    const d = screen.getByRole('dialog');
    expect(!!within(d).queryByRole('switch', { name: /désignation auto/i }) && !!within(d).queryByRole('switch', { name: /timer/i })).toBe(true);
  });
  it('settings has voix auto radio checked for readerMode voix', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(screen.getByRole('radio', { name: /voix auto/i }).checked).toBe(true);
  });
  it('settings un joueur radio checked for readerMode joueur', async () => {
    setup({ readerMode: 'joueur' }); await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(screen.getByRole('radio', { name: /un joueur/i }).checked).toBe(true);
  });
  it('selecting un joueur emits readerMode joueur', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    await userEvent.click(screen.getByRole('radio', { name: /un joueur/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, readerMode: 'joueur' });
  });
});

describe('LobbyScreen v2', () => {
  const setup = (over = {}) => {
    const p = {
      players: ['Ana', 'Bob', 'Cy'], onPlayersChange: vi.fn(),
      options: { designationAuto: false, timerPression: false, readerMode: 'voix', voiceId: 'narrateur' },
      onOptionsChange: vi.fn(), packName: 'Classique', onOpenPacks: vi.fn(), onBack: vi.fn(), onStart: vi.fn(),
      voices: VOICES, unlockedVoices: ['narrateur', 'robot'], voiceProgress: 1, ...over,
    };
    render(<LobbyScreen {...p} />);
    return p;
  };
  const input = () => screen.getByPlaceholderText(/prénom/i);
  it('input has maxLength 20', () => { setup(); expect(input().maxLength).toBe(20); });
  it('Ajouter adds trimmed name', async () => {
    const p = setup(); await userEvent.type(input(), '  Dan  ');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Ana', 'Bob', 'Cy', 'Dan']);
  });
  it('Enter adds name', async () => {
    const p = setup(); await userEvent.type(input(), 'Dan{Enter}');
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Ana', 'Bob', 'Cy', 'Dan']);
  });
  it('ignores empty name', async () => {
    const p = setup(); await userEvent.type(input(), '   {Enter}');
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });
  it('ignores duplicates case-insensitively', async () => {
    const p = setup(); await userEvent.type(input(), 'ANA{Enter}');
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });
  it('max 15 players', async () => {
    const players = Array.from({ length: 15 }, (_, i) => 'P' + i);
    const p = setup({ players }); await userEvent.type(input(), 'Extra{Enter}');
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });
  it('Retirer removes player', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: 'Retirer Bob' }));
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Ana', 'Cy']);
  });
  it('désignation switch toggles', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('switch', { name: /désignation/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, designationAuto: true });
  });
  it('timer switch toggles', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('switch', { name: /timer/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, timerPression: true });
  });
  it('pack button opens packs', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: /classique/i }));
    expect(p.onOpenPacks).toHaveBeenCalledTimes(1);
  });
  it('start disabled under 3 players', () => {
    setup({ players: ['Ana', 'Bob'] });
    expect(screen.getByRole('button', { name: /lancer la partie/i }).disabled).toBe(true);
  });
  it('start enabled and calls onStart with 3', async () => {
    const p = setup(); const b = screen.getByRole('button', { name: /lancer la partie/i });
    await userEvent.click(b); expect(p.onStart).toHaveBeenCalledTimes(1);
  });
  it('retour calls onBack', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });
  it('mode radios reflect readerMode voix', () => {
    setup();
    expect(screen.getByRole('radio', { name: /voix auto/i }).checked && !screen.getByRole('radio', { name: /un joueur/i }).checked).toBe(true);
  });
  it('mode radios reflect readerMode joueur', () => {
    setup({ options: { readerMode: 'joueur', voiceId: 'narrateur' } });
    expect(screen.getByRole('radio', { name: /un joueur/i }).checked).toBe(true);
  });
  it('choosing un joueur emits readerMode', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('radio', { name: /un joueur/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, readerMode: 'joueur' });
  });
  it('choosing voix auto emits readerMode voix', async () => {
    const p = setup({ options: { readerMode: 'joueur', voiceId: 'narrateur' } });
    await userEvent.click(screen.getByRole('radio', { name: /voix auto/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, readerMode: 'voix' });
  });
  it('voice picker lists unlocked voice Narrateur as radio', () => {
    setup(); expect(!!screen.queryByRole('radio', { name: /narrateur/i })).toBe(true);
  });
  it('voice picker checks current voiceId', () => {
    setup({ options: { readerMode: 'voix', voiceId: 'robot' } });
    expect(screen.getByRole('radio', { name: /robot/i }).checked).toBe(true);
  });
  it('selecting a voice emits voiceId', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('radio', { name: /robot/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ ...p.options, voiceId: 'robot' });
  });
  it('locked voice is not an enabled radio', () => {
    setup();
    const r = screen.queryByRole('radio', { name: /mamie/i });
    expect(r === null || r.disabled).toBe(true);
  });
  it('progressbar shown with rounded value when loading', () => {
    setup({ voiceProgress: 0.42 });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
  });
  it('no progressbar when voiceProgress is 1', () => {
    setup({ voiceProgress: 1 }); expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('voice picker hidden in joueur mode', () => {
    setup({ options: { readerMode: 'joueur', voiceId: 'narrateur' } });
    expect(screen.queryByRole('radio', { name: /narrateur/i })).toBeNull();
  });
});

describe('PacksScreen v2', () => {
  const setup = (over = {}) => {
    const p = {
      packs: PACKS, unlocked: ['gratuit'], counts: { gratuit: 6, trash: 4, pop_culture: 3 }, selected: 'gratuit',
      onSelect: vi.fn(), onUnlock: vi.fn(), ageConfirmed: false, onConfirmAge: vi.fn(), onClose: vi.fn(),
      voices: VOICES, unlockedVoices: ['narrateur'], onUnlockVoice: vi.fn(), onPreviewVoice: vi.fn(), ...over,
    };
    render(<PacksScreen {...p} />);
    return p;
  };
  it('shows pack names', () => { setup(); expect(PACKS.every((k) => !!screen.queryByText(k.name))).toBe(true); });
  it('shows counts', () => { setup(); expect(!!screen.queryByText('6 histoires')).toBe(true); });
  it('locked pack shows lock and price', () => {
    setup(); expect(!!screen.queryByText(/🔒/) && !!screen.queryAllByText(/4,99 €/).length).toBe(true);
  });
  it('simulate purchase of pack calls onUnlock', async () => {
    const p = setup();
    const btns = screen.getAllByRole('button', { name: /simuler l'achat/i });
    await userEvent.click(btns[0]);
    expect(p.onUnlock).toHaveBeenCalledWith('trash');
  });
  it('selected shows Sélectionné', () => { setup(); expect(!!screen.queryByText(/sélectionné/i)).toBe(true); });
  it('Choisir calls onSelect', async () => {
    const p = setup({ unlocked: ['gratuit', 'pop_culture'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    expect(p.onSelect).toHaveBeenCalledWith('pop_culture');
  });
  it('adult pack age gate confirm', async () => {
    const p = setup({ unlocked: ['gratuit', 'trash'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    await userEvent.click(screen.getByRole('button', { name: /j'ai 18 ans/i }));
    expect(p.onConfirmAge.mock.calls.length === 1 && p.onSelect.mock.calls[0][0] === 'trash').toBe(true);
  });
  it('adult pack age gate cancel does nothing', async () => {
    const p = setup({ unlocked: ['gratuit', 'trash'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(p.onSelect).not.toHaveBeenCalled();
  });
  it('retour calls onClose', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
  it('has voices heading', () => { setup(); expect(!!screen.queryByRole('heading', { name: /voix/i })).toBe(true); });
  it('lists every voice name', () => {
    setup(); expect(VOICES.every((v) => !!screen.queryByText(v.name))).toBe(true);
  });
  it('lists bundle with price', () => {
    setup(); expect(!!screen.queryByText(VOICE_BUNDLE.name) && !!screen.queryByText('2,49 €')).toBe(true);
  });
  it('preview button calls onPreviewVoice', async () => {
    const p = setup(); await userEvent.click(screen.getByRole('button', { name: 'Écouter Robot' }));
    expect(p.onPreviewVoice).toHaveBeenCalledWith('robot');
  });
  it('locked voice shows 0,99 €', () => { setup(); expect(screen.queryAllByText('0,99 €').length).toBe(4); });
  it('voice purchase calls onUnlockVoice', async () => {
    const p = setup({ unlocked: ['gratuit', 'trash', 'pop_culture'] });
    const btns = screen.getAllByRole('button', { name: /simuler l'achat/i });
    await userEvent.click(btns[0]);
    expect(p.onUnlockVoice).toHaveBeenCalledWith('robot');
  });
  it('bundle purchase calls onUnlockVoice bundle', async () => {
    const p = setup({ unlocked: ['gratuit', 'trash', 'pop_culture'] });
    const btns = screen.getAllByRole('button', { name: /simuler l'achat/i });
    await userEvent.click(btns[btns.length - 1]);
    expect(p.onUnlockVoice).toHaveBeenCalledWith('bundle');
  });
  it('unlocked voice shows Débloquée', () => {
    setup({ unlockedVoices: ['narrateur', 'robot'] }); expect(!!screen.queryAllByText(/débloquée/i).length).toBe(true);
  });
});

describe('ReaderTurnScreen v2', () => {
  it('joueur mode shows à toi de lire and reader', () => {
    render(<ReaderTurnScreen reader="Ana" mode="joueur" onReady={vi.fn()} />);
    expect(!!screen.queryByText(/à toi de lire/i) && !!screen.queryByText('Ana')).toBe(true);
  });
  it('joueur mode ready unlocks audio then calls onReady', async () => {
    const onReady = vi.fn();
    render(<ReaderTurnScreen reader="Ana" mode="joueur" onReady={onReady} />);
    await userEvent.click(screen.getByRole('button', { name: /je suis prêt/i }));
    expect(m.unlockAudio.mock.calls.length === 1 && onReady.mock.calls.length === 1).toBe(true);
  });
  it('voix mode shows poser le téléphone', () => {
    render(<ReaderTurnScreen reader="Ana" mode="voix" onReady={vi.fn()} />);
    expect(!!screen.queryByText(/posez le téléphone au centre/i)).toBe(true);
  });
  it('voix mode hides à toi de lire', () => {
    render(<ReaderTurnScreen reader="Ana" mode="voix" onReady={vi.fn()} />);
    expect(screen.queryByText(/à toi de lire/i)).toBeNull();
  });
  it("voix mode c'est parti unlocks everything then onReady", async () => {
    const onReady = vi.fn();
    render(<ReaderTurnScreen reader="Ana" mode="voix" onReady={onReady} />);
    await userEvent.click(screen.getByRole('button', { name: /c'est parti/i }));
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(m.unlockAudio.mock.calls.length === 1 && m.unlockSpeech.mock.calls.length === 1 && m.requestMicPermission.mock.calls.length === 1).toBe(true);
  });
  it('voix mode waits for mic permission before onReady', async () => {
    let release;
    m.requestMicPermission.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const onReady = vi.fn();
    render(<ReaderTurnScreen reader="Ana" mode="voix" onReady={onReady} />);
    await userEvent.click(screen.getByRole('button', { name: /c'est parti/i }));
    const early = onReady.mock.calls.length;
    release && release(true);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(early).toBe(0);
  });
});

describe('EndGameScreen v2', () => {
  const story = {
    id: 's1', titre: 'Le test',
    segments: [
      { texte_avant: 'Il mange une ', trou: { consigne: 'un fruit' }, texte_fin: ' ' },
      { texte_avant: '. Puis il voit ', trou: { consigne: 'un animal' }, texte_fin: '.' },
    ],
  };
  const answers = [{ word: 'banane', joker: false }, { word: 'lama', joker: true }];
  const themes = [{ id: 'amour', label: 'Amour', emoji: '💘' }, { id: 'fete', label: 'Fête', emoji: '🍾', locked: true }];
  const setup = (over = {}) => {
    const p = { story, answers, themes, onNextTheme: vi.fn(), onLockedTheme: vi.fn(), onHome: vi.fn(), onAnswersChange: vi.fn(), voiceId: 'robot', ...over };
    const r = render(<EndGameScreen {...p} />);
    return { p, container: r.container };
  };
  it('shows finished heading and title', () => {
    setup(); expect(!!screen.queryByText(/histoire terminée/i) && !!screen.queryByText('Le test')).toBe(true);
  });
  it('recap pills carry joker flags', () => {
    setup(); const w = screen.getAllByTestId('recap-word');
    expect(w.map((e) => e.getAttribute('data-joker'))).toEqual(['false', 'true']);
  });
  it('skipped pill shows consigne', () => {
    setup({ answers: [{ word: '', joker: false }, answers[1]] });
    expect(screen.getAllByTestId('recap-word')[0].textContent.includes('un fruit')).toBe(true);
  });
  it('no space before punctuation after a word', () => {
    const { container } = setup();
    expect(container.textContent.includes('banane.')).toBe(true);
  });
  it('theme card calls onNextTheme', async () => {
    const { p } = setup(); await userEvent.click(screen.getByRole('button', { name: /amour/i }));
    expect(p.onNextTheme).toHaveBeenCalledWith('amour');
  });
  it('locked theme calls onLockedTheme', async () => {
    const { p } = setup(); await userEvent.click(screen.getByRole('button', { name: /fête/i }));
    expect(p.onLockedTheme).toHaveBeenCalledWith('fete');
  });
  it('share calls shareText with title and text', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    const arg = m.shareText.mock.calls[0][0];
    expect(arg.title.includes('TEXTATROU') && arg.text === buildStoryText(story, answers)).toBe(true);
  });
  it('share shows copié message', async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: /partager/i }));
    expect(!!(await screen.findByText(/copié/i))).toBe(true);
  });
  it('accueil calls onHome', async () => {
    const { p } = setup(); await userEvent.click(screen.getByRole('button', { name: /accueil/i }));
    expect(p.onHome).toHaveBeenCalledTimes(1);
  });
  it("écouter l'histoire speaks story text with voiceId", async () => {
    setup(); await userEvent.click(screen.getByRole('button', { name: /écouter l'histoire/i }));
    expect(m.speak).toHaveBeenCalledTimes(1);
    expect(m.speak.mock.calls[0][0]).toBe(buildStoryText(story, answers));
    expect(m.speak.mock.calls[0][1]).toEqual(expect.objectContaining({ voiceId: 'robot' }));
  });
  it('clicking a word offers redire and écrire', async () => {
    setup(); await userEvent.click(screen.getAllByTestId('recap-word')[0]);
    expect(!!screen.queryByRole('button', { name: /redire/i }) && !!screen.queryByRole('button', { name: /écrire/i })).toBe(true);
  });
  it('redire listens and updates that index', async () => {
    const { p } = setup(); await userEvent.click(screen.getAllByTestId('recap-word')[1]);
    await userEvent.click(screen.getByRole('button', { name: /redire/i }));
    await waitFor(() => expect(p.onAnswersChange).toHaveBeenCalled());
    expect(m.listen).toHaveBeenCalled();
    expect(p.onAnswersChange).toHaveBeenCalledWith([answers[0], { word: 'chaussette', joker: false }]);
  });
  it('écrire shows textbox prefilled with current word', async () => {
    setup(); await userEvent.click(screen.getAllByTestId('recap-word')[0]);
    await userEvent.click(screen.getByRole('button', { name: /écrire/i }));
    expect(screen.getByRole('textbox').value).toBe('banane');
  });
  it('écrire + Enter updates that index', async () => {
    const { p } = setup(); await userEvent.click(screen.getAllByTestId('recap-word')[0]);
    await userEvent.click(screen.getByRole('button', { name: /écrire/i }));
    const t = screen.getByRole('textbox'); await userEvent.clear(t); await userEvent.type(t, 'pantoufle{Enter}');
    expect(p.onAnswersChange).toHaveBeenCalledWith([{ word: 'pantoufle', joker: false }, answers[1]]);
  });
  it('écrire + valider button updates that index', async () => {
    const { p } = setup(); await userEvent.click(screen.getAllByTestId('recap-word')[1]);
    await userEvent.click(screen.getByRole('button', { name: /écrire/i }));
    const t = screen.getByRole('textbox'); await userEvent.clear(t); await userEvent.type(t, 'pantoufle');
    await userEvent.click(screen.getByRole('button', { name: /valider/i }));
    expect(p.onAnswersChange).toHaveBeenCalledWith([answers[0], { word: 'pantoufle', joker: false }]);
  });
});
