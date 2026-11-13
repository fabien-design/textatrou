import React from 'react';
import { Modal } from '../components/ui/index.js';

const STEPS = [
  ['📖', 'bg-cyan', "Le lecteur lit l'histoire à voix haute."],
  ['🛑', 'bg-coral', 'Il s\'arrête net sur la carte rouge (la suite est floutée !).'],
  ['🗣️', 'bg-mint', 'Un pote crie un mot, on tape la carte et on découvre la suite.'],
];

export default function RulesModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Comment on joue ?">
      <ol className="flex flex-col gap-3">
        {STEPS.map(([emoji, bg, text], i) => (
          <li key={i} className="flex items-center gap-3 font-body text-ink">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-xl ${bg}`} aria-hidden="true">{emoji}</span>
            <span><b className="font-display">{i + 1}.</b> {text}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
