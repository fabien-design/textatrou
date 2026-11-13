import React, { useState } from 'react';
import { Button, Card, Toggle } from '../components/ui/index.js';

const COLORS = ['bg-sun', 'bg-coral', 'bg-mint', 'bg-cyan', 'bg-grape'];
const label = 'font-display text-sm font-bold tracking-wide text-ink';

export default function LobbyScreen({ players, onPlayersChange, options, onOptionsChange, packName, onOpenPacks, onBack, onStart }) {
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n || players.length >= 15) return;
    if (players.some((p) => p.toLowerCase() === n.toLowerCase())) return;
    onPlayersChange([...players, n]);
    setName('');
  };
  const missing = 3 - players.length;
  const flip = (key) => onOptionsChange({ ...options, [key]: !options[key] });
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <Button variant="white" className="px-3 py-2 text-sm" onClick={onBack}>‹ Retour</Button>
        <h1 className="font-display text-2xl font-bold text-ink">CONFIGURATION</h1>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className={label}>JOUEURS (Min 3, Max 15)</h2>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {players.map((p, i) => (
              <span key={p} className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 font-display font-semibold text-ink ${COLORS[i % COLORS.length]}`}>
                {p}
                <button type="button" aria-label={`Retirer ${p}`} onClick={() => onPlayersChange(players.filter((x) => x !== p))} className="font-bold">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              maxLength={20}
              placeholder="Ajouter un prénom..."
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-2 font-body text-ink"
            />
            <button type="button" aria-label="Ajouter" onClick={add} className="h-11 w-11 shrink-0 rounded-xl border-2 border-ink bg-mint font-display text-xl font-bold text-ink shadow-brutal">+</button>
          </div>
        </Card>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={label}>OPTIONS DE JEU</h2>
        <Card className="flex flex-col gap-4">
          <Toggle checked={!!options.designationAuto} onChange={() => flip('designationAuto')} label="🎯 Désignation auto" />
          <Toggle checked={!!options.timerPression} onChange={() => flip('timerPression')} label="⏱ Timer pression (15s)" />
        </Card>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={label}>PACK SÉLECTIONNÉ</h2>
        <button type="button" onClick={onOpenPacks} className="flex w-full items-center justify-between rounded-2xl border-2 border-ink bg-white px-4 py-3 font-display font-bold text-ink shadow-brutal">
          <span>{packName}</span><span aria-hidden="true">›</span>
        </button>
      </section>
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-cream pb-2 pt-2">
        {missing > 0 && <p className="text-center font-body text-sm text-ink">{`Encore ${missing} joueur${missing > 1 ? 's' : ''} minimum`}</p>}
        <Button variant="primary" className="w-full text-xl py-4" disabled={players.length < 3} onClick={onStart}>LANCER LA PARTIE ▶</Button>
      </div>
    </div>
  );
}
