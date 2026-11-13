import React, { useState } from 'react';
import { Button, Card } from '../components/ui/index.js';
import { shareText } from '../lib/device.js';
import { buildStoryText } from '../game/engine.js';

const MESSAGES = {
  copied: 'Copié dans le presse-papiers !',
  shared: 'Partagé !',
  failed: 'Oups, impossible de partager',
};

export default function EndGameScreen({ story, answers, themes = [], onNextTheme, onLockedTheme, onHome }) {
  const [msg, setMsg] = useState('');

  const share = async () => {
    const res = await shareText({
      title: `TEXTATROU — ${story.titre}`,
      text: buildStoryText(story, answers),
    });
    setMsg(MESSAGES[res] || '');
  };

  let hole = 0;
  const parts = story.segments.map((seg, i) => {
    const out = [];
    if (seg.texte_avant) out.push(<span key={`t${i}`}>{seg.texte_avant}</span>);
    if (seg.texte_fin) out.push(<span key={`f${i}`}>{seg.texte_fin}</span>);
    if (seg.trou) {
      const a = answers[hole++] || { word: '', joker: false };
      const cls = a.word
        ? a.joker
          ? 'bg-grape text-white'
          : 'bg-mint text-ink'
        : 'bg-white text-ink text-sm uppercase';
      out.push(
        <span
          key={`h${i}`}
          data-testid="recap-word"
          data-joker={a.joker ? 'true' : 'false'}
          className={`inline-block mx-1 px-2 py-0.5 rounded-xl border-2 border-ink font-bold ${cls}`}
        >
          {a.word ? a.word : `✓ ${seg.trou.consigne}`}
        </span>
      );
    }
    return out;
  });

  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-hidden">
      <div className="text-center">
        <h1 className="font-display text-3xl text-ink">🎉 HISTOIRE TERMINÉE !</h1>
        <p className="font-display text-xl text-ink mt-1">{story.titre}</p>
      </div>
      <Card>
        <p className="font-body text-lg leading-relaxed text-ink break-words">{parts}</p>
      </Card>
      <h2 className="font-display text-lg text-ink text-center">
        ON ENCHAÎNE ? CHOISISSEZ UNE CARTE POUR LA SUITE :
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => (t.locked ? onLockedTheme(t.id) : onNextTheme(t.id))}
            className={`relative aspect-[3/4] bg-white border-2 border-ink shadow-brutal rounded-2xl flex flex-col items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 ${
              t.locked ? 'opacity-60' : ''
            }`}
          >
            {t.locked && (
              <span className="absolute top-1 right-1 text-lg" aria-hidden="true">🔒</span>
            )}
            <span className="text-4xl">{t.emoji}</span>
            <span className="font-display text-sm text-ink">{t.label}</span>
          </button>
        ))}
      </div>
      {msg && (
        <p role="status" className="text-center font-display text-ink bg-sun border-2 border-ink rounded-2xl px-3 py-2">
          {msg}
        </p>
      )}
      <div className="flex gap-3 mt-auto">
        <Button variant="white" className="flex-1" onClick={share}>📲 Partager</Button>
        <Button variant="white" className="flex-1" onClick={onHome}>🏠 Accueil</Button>
      </div>
    </div>
  );
}
