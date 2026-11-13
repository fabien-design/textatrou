import React, { useState } from 'react';
import { Button, Card, Toggle } from '../components/ui/index.js';
import { speak, setSpeechRate } from '../lib/speech.js';

const COLORS = ['bg-sun', 'bg-coral', 'bg-mint', 'bg-cyan', 'bg-grape'];
const label = 'font-display text-sm font-bold tracking-wide text-ink';


const MODES = [['voix', '🎙️ Voix auto', 'bg-mint'], ['joueur', '🧑 Un joueur', 'bg-sun']];
function ModeChoice({ value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label="Mode de lecture" className="grid grid-cols-2 gap-3">
      {MODES.map(([id, text, bg]) => (
        <label key={id} className={`relative flex cursor-pointer items-center justify-center rounded-2xl border-2 border-ink px-2 py-4 text-center font-display font-bold text-ink shadow-brutal has-[:focus-visible]:ring-2 ${value === id ? bg : 'bg-white opacity-70'}`}>
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} className="sr-only" />
          <span>{text}</span>
        </label>
      ))}
    </div>
  );
}

export function VoiceSpeed({ options, onOptionsChange }) {
  const cur = Number.isFinite(options.voiceSpeed) ? options.voiceSpeed : 1.2;
  const set = (n) => {
    const v = Math.min(1.8, Math.max(0.8, Math.round(n * 10) / 10));
    onOptionsChange({ ...options, voiceSpeed: v });
  };
  const test = () => {
    setSpeechRate(cur);
    speak('Voilà ma nouvelle vitesse de lecture !', { voiceId: options.voiceId });
  };
  const btn = 'h-9 w-9 rounded-full border-2 border-ink bg-white font-display font-bold text-ink shadow-brutal';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-display font-semibold text-ink">
        <span>Vitesse de la voix</span>
        <span>{`×${cur.toFixed(1)}`}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Ralentir la voix" className={btn} onClick={() => set(cur - 0.1)}>−</button>
        <input type="range" aria-label="Vitesse de la voix" min="0.8" max="1.8" step="0.1" value={cur}
          onChange={(e) => set(Number(e.target.value))}
          className="h-3 flex-1 rounded-full border-2 border-ink" style={{ accentColor: '#FF6B6B' }} />
        <button type="button" aria-label="Accélérer la voix" className={btn} onClick={() => set(cur + 0.1)}>+</button>
        <button type="button" aria-label="Tester la vitesse" className={btn} onClick={test}>▶</button>
      </div>
    </div>
  );
}

export default function LobbyScreen({ voices = [], unlockedVoices = ['narrateur'], voiceProgress = 1, players, onPlayersChange, options, onOptionsChange, packName, onOpenPacks, onBack, onStart }) {
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
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-clip">
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
        <h2 className={label}>MODE DE LECTURE</h2>
        <ModeChoice name="lobby-mode" value={options.readerMode || 'voix'} onChange={(m) => onOptionsChange({ ...options, readerMode: m })} />
        {(options.readerMode || 'voix') === 'voix' && voices.length > 0 && (
          <Card className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Voix" className="flex flex-wrap gap-2">
              {voices.map((v) => {
                const ok = unlockedVoices.includes(v.id);
                return (
                  <label key={v.id} className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 font-display font-semibold text-ink ${options.voiceId === v.id ? 'bg-sun shadow-brutal' : 'bg-white'} ${ok ? 'cursor-pointer' : 'opacity-50'}`}>
                    <input type="radio" name="voice" className="sr-only" disabled={!ok} checked={options.voiceId === v.id} onChange={() => onOptionsChange({ ...options, voiceId: v.id })} />
                    <span aria-hidden="true">{v.emoji}</span><span>{v.name}</span>{!ok && <span aria-hidden="true">🔒</span>}
                  </label>
                );
              })}
            </div>
            <VoiceSpeed options={options} onOptionsChange={onOptionsChange} />
            {voiceProgress < 1 && (
              <div className="flex flex-col gap-1">
                <div role="progressbar" aria-label="Téléchargement de la voix" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(voiceProgress * 100)} className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white">
                  <div className="h-full bg-mint" style={{ width: `${Math.round(voiceProgress * 100)}%` }} />
                </div>
                <span className="font-body text-sm text-ink">{`Téléchargement de la voix… ${Math.round(voiceProgress * 100)}%`}</span>
              </div>
            )}
          </Card>
        )}
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
