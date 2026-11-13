import React, { useState } from 'react';
import { Button, Modal, Pill, Toggle } from '../components/ui/index.js';
import { VoiceSpeed } from './LobbyScreen.jsx';
import RulesModal from './RulesModal.jsx';

const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink bg-white shadow-brutal font-display text-xl font-bold text-ink';


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

export default function HomeScreen({ freeCount, onPlay, onPacks, options, onOptionsChange }) {
  const [rules, setRules] = useState(false);
  const [settings, setSettings] = useState(false);
  const flip = (key) => onOptionsChange({ ...options, [key]: !options[key] });
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-clip">
      <div className="flex justify-between">
        <button type="button" aria-label="Règles" className={iconBtn} onClick={() => setRules(true)}>?</button>
        <button type="button" aria-label="Paramètres" className={iconBtn} onClick={() => setSettings(true)}>⚙</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="-rotate-2 rounded-2xl border-2 border-ink bg-sun px-5 py-4 shadow-brutal">
          <h1 className="font-display text-5xl font-bold tracking-tight text-ink">TEXTATROU</h1>
          <div className="mt-1 mx-auto h-3 w-16 rounded-full border-2 border-dashed border-ink bg-coral" aria-hidden="true" />
        </div>
        <p className="font-body text-ink">Le jeu d'histoires absurdes</p>
      </div>
      <div className="flex flex-col gap-4">
        <Button variant="primary" className="w-full text-xl py-4" onClick={onPlay}>▶ NOUVELLE PARTIE</Button>
        <Button variant="white" className="w-full flex items-center justify-center gap-2" onClick={onPacks}>
          <span>★ PACKS & THÈMES</span>
          <Pill color="mint">{`${freeCount} gratuits`}</Pill>
        </Button>
      </div>
      <RulesModal open={rules} onClose={() => setRules(false)} />
      <Modal open={settings} onClose={() => setSettings(false)} title="Paramètres">
        <div className="flex flex-col gap-4">
          <ModeChoice name="home-mode" value={options.readerMode || 'voix'} onChange={(m) => onOptionsChange({ ...options, readerMode: m })} />
          <VoiceSpeed options={options} onOptionsChange={onOptionsChange} />
          <Toggle checked={!!options.designationAuto} onChange={() => flip('designationAuto')} label="Désignation auto" />
          <Toggle checked={!!options.timerPression} onChange={() => flip('timerPression')} label="Timer pression (15s)" />
        </div>
      </Modal>
    </div>
  );
}
