import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect } from 'vitest';
import { PACKS } from '../../src/data/stories.js';
import HomeScreen from '../../src/screens/HomeScreen.jsx';
import LobbyScreen from '../../src/screens/LobbyScreen.jsx';
import PacksScreen from '../../src/screens/PacksScreen.jsx';

vi.mock('../../src/lib/audio.js', () => ({
  unlockAudio: vi.fn(),
  playPop: vi.fn(),
  playJoker: vi.fn(),
  playBadumTss: vi.fn(),
  playScream: vi.fn(),
  playApplause: vi.fn(),
  playBeep: vi.fn(),
}));

const opts = { designationAuto: true, timerPression: false };

function renderHome(over = {}) {
  const props = {
    freeCount: 6,
    onPlay: vi.fn(),
    onPacks: vi.fn(),
    options: opts,
    onOptionsChange: vi.fn(),
    ...over,
  };
  render(<HomeScreen {...props} />);
  return props;
}

describe('HomeScreen', () => {
  test('shows the title', () => {
    renderHome();
    expect(screen.queryByText('TEXTATROU') !== null).toBe(true);
  });

  test('nouvelle partie calls onPlay', async () => {
    const p = renderHome();
    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }));
    expect(p.onPlay).toHaveBeenCalledTimes(1);
  });

  test('packs button calls onPacks', async () => {
    const p = renderHome();
    await userEvent.click(screen.getByRole('button', { name: /packs/i }));
    expect(p.onPacks).toHaveBeenCalledTimes(1);
  });

  test('packs button shows free count', () => {
    renderHome({ freeCount: 6 });
    expect(screen.getByRole('button', { name: /packs/i }).textContent.includes('6 gratuits')).toBe(true);
  });

  test('rules dialog opens with three steps mentioning lecteur', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Règles' }));
    const dlg = screen.getByRole('dialog');
    expect(/lecteur/i.test(dlg.textContent)).toBe(true);
    expect(/1/.test(dlg.textContent) && /2/.test(dlg.textContent) && /3/.test(dlg.textContent)).toBe(true);
  });

  test('rules dialog closes with Fermer', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Règles' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /fermer/i }));
    expect(screen.queryByRole('dialog') === null).toBe(true);
  });

  test('settings switches reflect options', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    expect(screen.getByRole('switch', { name: /désignation auto/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: /timer/i }).getAttribute('aria-checked')).toBe('false');
  });

  test('toggling désignation auto calls onOptionsChange with full object', async () => {
    const p = renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    await userEvent.click(screen.getByRole('switch', { name: /désignation auto/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ designationAuto: false, timerPression: false });
  });

  test('toggling timer calls onOptionsChange with full object', async () => {
    const p = renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    await userEvent.click(screen.getByRole('switch', { name: /timer/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ designationAuto: true, timerPression: true });
  });
});

function renderLobby(over = {}) {
  const props = {
    players: ['Alex', 'Bob'],
    onPlayersChange: vi.fn(),
    options: opts,
    onOptionsChange: vi.fn(),
    packName: 'Classique',
    onOpenPacks: vi.fn(),
    onBack: vi.fn(),
    onStart: vi.fn(),
    ...over,
  };
  render(<LobbyScreen {...props} />);
  return props;
}

const input = () => screen.getByPlaceholderText(/prénom/i);

describe('LobbyScreen', () => {
  test('input has maxLength 20', () => {
    renderLobby();
    expect(input().getAttribute('maxlength')).toBe('20');
  });

  test('add via button', async () => {
    const p = renderLobby();
    await userEvent.type(input(), 'Zoé');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Alex', 'Bob', 'Zoé']);
  });

  test('add via Enter', async () => {
    const p = renderLobby();
    await userEvent.type(input(), 'Zoé{Enter}');
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Alex', 'Bob', 'Zoé']);
  });

  test('name is trimmed', async () => {
    const p = renderLobby();
    await userEvent.type(input(), '  Zoé  ');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Alex', 'Bob', 'Zoé']);
  });

  test('empty name not added', async () => {
    const p = renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });

  test('whitespace name not added', async () => {
    const p = renderLobby();
    await userEvent.type(input(), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });

  test('case-insensitive duplicate not added', async () => {
    const p = renderLobby();
    await userEvent.type(input(), 'alex');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });

  test('not added when 15 players', async () => {
    const players = Array.from({ length: 15 }, (_, i) => `P${i}`);
    const p = renderLobby({ players });
    await userEvent.type(input(), 'Zoé');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(p.onPlayersChange).not.toHaveBeenCalled();
  });

  test('remove player', async () => {
    const p = renderLobby({ players: ['Alex', 'Bob', 'Cleo'] });
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Bob' }));
    expect(p.onPlayersChange).toHaveBeenCalledWith(['Alex', 'Cleo']);
  });

  test('toggle désignation auto', async () => {
    const p = renderLobby();
    await userEvent.click(screen.getByRole('switch', { name: /désignation auto/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ designationAuto: false, timerPression: false });
  });

  test('toggle timer', async () => {
    const p = renderLobby();
    await userEvent.click(screen.getByRole('switch', { name: /timer/i }));
    expect(p.onOptionsChange).toHaveBeenCalledWith({ designationAuto: true, timerPression: true });
  });

  test('packName displayed', () => {
    renderLobby({ packName: 'Mon Pack' });
    expect(screen.queryAllByText(/Mon Pack/).length > 0).toBe(true);
  });

  test('pack button calls onOpenPacks', async () => {
    const p = renderLobby({ packName: 'Mon Pack' });
    await userEvent.click(screen.getByRole('button', { name: /Mon Pack/ }));
    expect(p.onOpenPacks).toHaveBeenCalledTimes(1);
  });

  test('start disabled with 2 players', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: /lancer la partie/i }).disabled).toBe(true);
  });

  test('start enabled with 3 players and calls onStart', async () => {
    const p = renderLobby({ players: ['A', 'B', 'C'] });
    const btn = screen.getByRole('button', { name: /lancer la partie/i });
    expect(btn.disabled).toBe(false);
    await userEvent.click(btn);
    expect(p.onStart).toHaveBeenCalledTimes(1);
  });

  test('retour calls onBack', async () => {
    const p = renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });
});

function renderPacks(over = {}) {
  const props = {
    packs: PACKS,
    unlocked: ['gratuit'],
    counts: { gratuit: 6, trash: 10, pop_culture: 8 },
    selected: 'gratuit',
    onSelect: vi.fn(),
    onUnlock: vi.fn(),
    ageConfirmed: false,
    onConfirmAge: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<PacksScreen {...props} />);
  return props;
}

describe('PacksScreen', () => {
  test('shows pack names', () => {
    renderPacks();
    const ok = ['Classique', 'Soirée & Trash', 'Pop Culture & Cinéma'].every(
      (n) => screen.queryAllByText(new RegExp(n.replace(/[&]/g, '\\&'))).length > 0
    );
    expect(ok).toBe(true);
  });

  test('shows story counts', () => {
    renderPacks();
    expect(screen.queryByText(/6 histoires/) !== null).toBe(true);
    expect(screen.queryByText(/10 histoires/) !== null).toBe(true);
    expect(screen.queryByText(/8 histoires/) !== null).toBe(true);
  });

  test('locked packs show lock and price', () => {
    renderPacks();
    expect(screen.queryAllByText(/🔒/).length >= 2).toBe(true);
    expect(screen.queryByText(/4,99 €/) !== null).toBe(true);
    expect(screen.queryByText(/2,99 €/) !== null).toBe(true);
  });

  test('simuler l\'achat calls onUnlock', async () => {
    const p = renderPacks();
    const btns = screen.getAllByRole('button', { name: /simuler l'achat/i });
    await userEvent.click(btns[0]);
    expect(p.onUnlock).toHaveBeenCalledTimes(1);
    expect(['trash', 'pop_culture'].includes(p.onUnlock.mock.calls[0][0])).toBe(true);
  });

  test('locked packs have no choisir button', () => {
    renderPacks({ selected: 'trash', unlocked: ['gratuit', 'trash'] });
    // only gratuit is unlocked and not selected -> exactly one choisir
    expect(screen.queryAllByRole('button', { name: /choisir/i }).length).toBe(1);
  });

  test('unlocked non-selected pack choisir calls onSelect', async () => {
    const p = renderPacks({ unlocked: ['gratuit', 'pop_culture'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    expect(p.onSelect).toHaveBeenCalledWith('pop_culture');
  });

  test('selected pack shows sélectionné instead of choisir', () => {
    renderPacks();
    expect(screen.queryByText(/sélectionné/i) !== null).toBe(true);
    expect(screen.queryAllByRole('button', { name: /choisir/i }).length).toBe(0);
  });

  test('adult pack asks for age confirmation without selecting', async () => {
    const p = renderPacks({ unlocked: ['gratuit', 'trash'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    expect(screen.queryByText(/18 ans/) !== null).toBe(true);
    expect(p.onSelect).not.toHaveBeenCalled();
  });

  test('confirming age calls onConfirmAge and onSelect', async () => {
    const p = renderPacks({ unlocked: ['gratuit', 'trash'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    await userEvent.click(screen.getByRole('button', { name: /j'ai 18 ans/i }));
    expect(p.onConfirmAge).toHaveBeenCalledTimes(1);
    expect(p.onSelect).toHaveBeenCalledWith('trash');
  });

  test('cancelling age calls neither', async () => {
    const p = renderPacks({ unlocked: ['gratuit', 'trash'] });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(p.onConfirmAge).not.toHaveBeenCalled();
    expect(p.onSelect).not.toHaveBeenCalled();
  });

  test('age already confirmed selects trash directly', async () => {
    const p = renderPacks({ unlocked: ['gratuit', 'trash'], ageConfirmed: true });
    await userEvent.click(screen.getByRole('button', { name: /choisir/i }));
    expect(p.onSelect).toHaveBeenCalledWith('trash');
  });

  test('retour calls onClose', async () => {
    const p = renderPacks();
    await userEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
});
