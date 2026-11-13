import React from 'react';
import { Button } from '../components/ui/index.js';
import { unlockAudio } from '../lib/audio.js';

export default function ReaderTurnScreen({ reader, onReady }) {
  const handle = () => {
    unlockAudio();
    onReady && onReady();
  };
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-hidden">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <h1 className="font-display text-2xl text-ink">📖 À TOI DE LIRE</h1>
        <div
          className="bg-cyan text-white font-display text-5xl uppercase border-2 border-ink shadow-brutal rounded-2xl px-6 py-5 -rotate-2 max-w-full break-words animate-bounce"
          style={{ animationIterationCount: 2 }}
        >
          {reader}
        </div>
        <p className="font-body text-lg text-ink">Prends le téléphone en main.</p>
        <p className="font-body text-lg font-bold text-ink">Arrête-toi net sur les cartes !</p>
      </div>
      <Button variant="primary" className="w-full text-xl" onClick={handle}>
        JE SUIS PRÊT ! 👀
      </Button>
    </div>
  );
}
