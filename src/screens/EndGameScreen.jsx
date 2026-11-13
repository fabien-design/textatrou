import React, { useState } from 'react';
import { Button, Card, Modal } from '../components/ui/index.js';
import { shareText } from '../lib/device.js';
import { buildStoryText } from '../game/engine.js';
import { speak, cancelSpeech, listen } from '../lib/speech.js';

const MESSAGES = {
  copied: 'Copié dans le presse-papiers !',
  shared: 'Partagé !',
  failed: 'Oups, impossible de partager',
};

const PUNCT = /^\s+(?=[,.…)\]»])/;

export default function EndGameScreen({ story, answers, themes = [], onNextTheme, onLockedTheme, onHome, onAnswersChange, voiceId }) {
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null); // { index, writing }
  const [text, setText] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const share = async () => {
    const res = await shareText({
      title: `TEXTATROU — ${story.titre}`,
      text: buildStoryText(story, answers),
    });
    setMsg(MESSAGES[res] || '');
  };

  const readAloud = async () => {
    setSpeaking(true);
    try {
      await speak(buildStoryText(story, answers), { voiceId });
    } catch (e) {
      // ignore
    } finally {
      setSpeaking(false);
    }
  };
  const stop = () => { cancelSpeech(); setSpeaking(false); };

  const update = (index, word) => {
    const next = answers.map((a) => a);
    next[index] = { word, joker: false };
    onAnswersChange && onAnswersChange(next);
  };
  const redire = async () => {
    const index = edit.index;
    setEdit(null);
    try {
      const w = await listen({ timeoutMs: 8000 });
      if (w && String(w).trim()) update(index, String(w).trim());
    } catch (e) {
      // ignore
    }
  };
  const validate = () => {
    const w = text.trim();
    const index = edit.index;
    setEdit(null);
    if (w) update(index, w);
  };
  const open = (index, word) => { setText(word || ''); setEdit({ index, writing: false }); };

  // flat items, merging consecutive text so punctuation after a word can be glued
  const items = [];
  const pushText = (t) => {
    if (!t) return;
    const last = items[items.length - 1];
    if (last && last.type === 'text') last.s += t;
    else items.push({ type: 'text', s: t });
  };
  let hole = 0;
  story.segments.forEach((seg, i) => {
    pushText(seg.texte_avant);
    if (seg.trou) {
      const index = hole++;
      items.push({ type: 'pill', i, index, seg, a: answers[index] || { word: '', joker: false } });
    }
    pushText(seg.texte_fin);
  });
  const parts = items.map((it, k) => {
    if (it.type === 'text') {
      const afterPill = k > 0 && items[k - 1].type === 'pill';
      return <span key={`t${k}`}>{afterPill ? it.s.replace(PUNCT, '') : it.s}</span>;
    }
    const { a, seg, index } = it;
    const cls = a.word
      ? a.joker
        ? 'bg-grape text-white'
        : 'bg-mint text-ink'
      : 'bg-white text-ink text-sm uppercase';
    return (
      <button
        type="button"
        key={`h${k}`}
        data-testid="recap-word"
        data-joker={a.joker ? 'true' : 'false'}
        onClick={() => open(index, a.word)}
        className={`inline-block mx-0.5 px-2 py-0.5 rounded-xl border-2 border-ink font-bold ${cls}`}
      >
        {a.word ? a.word : `✓ ${seg.trou.consigne}`}
      </button>
    );
  });

  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 gap-5 overflow-x-clip">
      <div className="text-center">
        <h1 className="font-display text-3xl text-ink">🎉 HISTOIRE TERMINÉE !</h1>
        <p className="font-display text-xl text-ink mt-1">{story.titre}</p>
      </div>
      <Card>
        <p className="font-body text-lg leading-relaxed text-ink break-words">{parts}</p>
      </Card>
      {speaking ? (
        <Button variant="coral" onClick={stop}>⏹ Stop</Button>
      ) : (
        <Button variant="cyan" onClick={readAloud}>▶ Écouter l'histoire</Button>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title="Corriger le mot">
        {edit && (edit.writing ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); validate(); }}>
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl border-2 border-ink bg-white px-3 py-2 font-body text-ink" />
            <Button variant="mint" type="submit">✓ Valider</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="cyan" onClick={redire}>🎤 Redire</Button>
            <Button variant="white" onClick={() => setEdit({ ...edit, writing: true })}>⌨️ Écrire</Button>
          </div>
        ))}
      </Modal>
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
