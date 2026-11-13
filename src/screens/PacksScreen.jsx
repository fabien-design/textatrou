import React, { useState } from 'react';
import { Button, Card, Modal, Pill } from '../components/ui/index.js';
import { VOICE_BUNDLE } from '../lib/speech.js';

const LOCK = "before:content-['🔒_'] before:mr-1";

export default function PacksScreen({ packs, unlocked, counts, selected, onSelect, onUnlock, ageConfirmed, onConfirmAge, onClose, voices = [], unlockedVoices = [], onUnlockVoice, onPreviewVoice }) {
  const [gate, setGate] = useState(null);
  const choose = (pack) => {
    if (pack.adult && !ageConfirmed) setGate(pack.id);
    else onSelect(pack.id);
  };
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <Button variant="white" className="px-3 py-2 text-sm" onClick={onClose}>‹ Retour</Button>
        <h1 className="font-display text-2xl font-bold text-ink">PACKS & THÈMES</h1>
      </div>
      <p className="sr-only">🔒 contenu payant</p>
      {packs.map((pack) => {
        const isUnlocked = unlocked.includes(pack.id);
        return (
          <Card key={pack.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{pack.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-bold text-ink">{pack.name}</div>
                <div className="font-body text-sm text-ink">{`${counts[pack.id] ?? 0} histoires`}</div>
              </div>
              <div className="font-display font-bold text-ink">
                {isUnlocked ? (pack.price ? pack.price : 'Gratuit') : <span className={LOCK}>{pack.price}</span>}
              </div>
            </div>
            {!isUnlocked ? (
              <Button variant="grape" onClick={() => onUnlock(pack.id)}>Simuler l'achat MVP</Button>
            ) : selected === pack.id ? (
              <Pill color="mint" className="self-start">Sélectionné ✓</Pill>
            ) : (
              <Button variant="primary" onClick={() => choose(pack)}>Choisir</Button>
            )}
          </Card>
        );
      })}
      <h2 className="font-display text-xl font-bold text-ink">VOIX</h2>
      {voices.map((v) => {
        const ok = unlockedVoices.includes(v.id);
        return (
          <Card key={v.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{v.emoji}</span>
              <div className="min-w-0 flex-1 font-display text-lg font-bold text-ink">{v.name}</div>
              <button type="button" aria-label={`Écouter ${v.name}`} onClick={() => onPreviewVoice && onPreviewVoice(v.id)} className="h-11 w-11 shrink-0 rounded-xl border-2 border-ink bg-cyan font-display text-white shadow-brutal">▶</button>
            </div>
            {ok ? (
              <Pill color="mint" className="self-start">Débloquée ✓</Pill>
            ) : (
              <>
                <div className={`font-display font-bold text-ink ${LOCK}`}><span>{v.price}</span></div>
                <Button variant="grape" onClick={() => onUnlockVoice && onUnlockVoice(v.id)}>Simuler l'achat MVP</Button>
              </>
            )}
          </Card>
        );
      })}
      {voices.length > 0 && (
        <Card className="flex flex-col gap-3 bg-sun">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">{VOICE_BUNDLE.emoji}</span>
            <div className="min-w-0 flex-1 font-display text-lg font-bold text-ink">{VOICE_BUNDLE.name}</div>
            <div className="font-display font-bold text-ink">{VOICE_BUNDLE.price}</div>
          </div>
          <Button variant="grape" onClick={() => onUnlockVoice && onUnlockVoice('bundle')}>Simuler l'achat MVP</Button>
        </Card>
      )}
      <Modal open={gate !== null} onClose={() => setGate(null)} title="Contenu +18">
        <p className="mb-4 font-body text-ink">Ce pack contient de l'humour trash réservé aux adultes. Tu confirmes avoir l'âge requis ?</p>
        <div className="flex flex-col gap-3">
          <Button variant="coral" onClick={() => { const id = gate; setGate(null); onConfirmAge(); onSelect(id); }}>J'ai 18 ans ou plus</Button>
          <Button variant="white" onClick={() => setGate(null)}>Annuler</Button>
        </div>
      </Modal>
    </div>
  );
}
