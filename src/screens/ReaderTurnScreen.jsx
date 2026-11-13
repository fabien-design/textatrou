import React, { useState } from 'react';
import { Button } from '../components/ui/index.js';
import { unlockAudio } from '../lib/audio.js';
import { unlockSpeech, requestMicPermission } from '../lib/speech.js';

export default function ReaderTurnScreen({ reader, mode = 'joueur', onReady }) {
  const [busy, setBusy] = useState(false);
  const handleJoueur = () => {
    unlockAudio();
    onReady && onReady();
  };
  const handleVoix = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlockAudio();
      unlockSpeech();
      await requestMicPermission();
    } catch (e) {
      // ignore: continue without mic
    }
    onReady && onReady();
  };
  if (mode === 'voix') {
    return (
      <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-clip">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="text-8xl" aria-hidden="true">📱</div>
          <h1 className="font-display text-3xl font-bold text-ink">Posez le téléphone au centre</h1>
          <p className="font-body text-lg text-ink">La voix lit l'histoire, criez vos mots quand c'est votre tour !</p>
        </div>
        <Button variant="primary" className="w-full text-xl" disabled={busy} onClick={handleVoix}>▶ C'EST PARTI</Button>
      </div>
    );
  }
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-clip">
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
      <Button variant="primary" className="w-full text-xl" onClick={handleJoueur}>
        JE SUIS PRÊT ! 👀
      </Button>
    </div>
  );
}
