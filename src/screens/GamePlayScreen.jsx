import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button, Card } from '../components/ui/index.js';
import {
  playPop,
  playJoker,
  playBadumTss,
  playScream,
  playApplause,
  playBeep,
} from '../lib/audio.js';
import { requestWakeLock } from '../lib/device.js';
import { pickResponder, pickJoker, fakeText } from '../game/engine.js';

const TIMER_START = 15;

export default function GamePlayScreen({ story, players, reader, options = {}, jokers, onFinish }) {
  const segments = story.segments;
  const holes = segments.filter((s) => s.trou).length;
  const finText = segments.find((s) => s.texte_fin !== undefined)?.texte_fin ?? '';

  const [k, setK] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [responders, setResponders] = useState(() => {
    if (!options.designationAuto || holes === 0) return [null];
    return [pickResponder(players, reader, null)];
  });
  const [editing, setEditing] = useState(false);
  const [word, setWord] = useState('');
  const [jokerWord, setJokerWord] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_START);
  const activeRef = useRef(null);
  const firstRender = useRef(true);

  const finished = k >= holes;
  const seg = segments[k];

  // wake lock
  useEffect(() => {
    let released = false;
    let release = null;
    Promise.resolve(requestWakeLock()).then((rel) => {
      if (released) {
        if (typeof rel === 'function') rel();
      } else release = rel;
    });
    return () => {
      released = true;
      if (typeof release === 'function') release();
    };
  }, []);

  // scroll to new active element
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = activeRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [k]);

  const injectJoker = useCallback(() => {
    const s = segments[k];
    if (!s || !s.trou) return;
    setEditing(false);
    setJokerWord(pickJoker(jokers, s.trou.categorie_joker));
  }, [segments, k, jokers]);

  const onJokerClick = () => {
    if (finished) return;
    playJoker();
    injectJoker();
  };

  // timer
  useEffect(() => {
    if (!options.timerPression || finished || jokerWord !== null) return undefined;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [options.timerPression, finished, jokerWord, k]);

  useEffect(() => {
    if (!options.timerPression || finished || jokerWord !== null) return;
    if (timeLeft <= 3) playBeep();
    if (timeLeft === 0) {
      playJoker();
      injectJoker();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const validate = (answer) => {
    playPop();
    const next = k + 1;
    setAnswers((a) => [...a, answer]);
    setResponders((r) => {
      const copy = [...r];
      if (options.designationAuto && next < holes) {
        copy[next] = pickResponder(players, reader, r[k] ?? null);
      } else copy[next] = null;
      return copy;
    });
    setK(next);
    setEditing(false);
    setWord('');
    setJokerWord(null);
    setTimeLeft(TIMER_START);
  };

  const onCardClick = () => {
    if (jokerWord !== null) validate({ word: jokerWord, joker: true });
    else if (!editing) setEditing(true);
  };

  const submitWord = () => validate({ word: word.trim(), joker: false });

  const stop = (e) => e.stopPropagation();

  const fakes = useMemo(() => {
    const m = {};
    segments.forEach((s, i) => {
      const t = s.texte_avant ?? s.texte_fin;
      if (t !== undefined) m[i] = fakeText(t);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story]);

  const locked = (i) => (
    <span
      key={`l${i}`}
      data-testid="locked-segment"
      aria-hidden="true"
      className="blur-xl select-none opacity-40 pointer-events-none"
    >
      {fakes[i]}
    </span>
  );

  const renderSegment = (s, i) => {
    if (s.texte_fin !== undefined) {
      if (finished) return <span key={`f${i}`}>{s.texte_fin} </span>;
      return <React.Fragment key={`f${i}`}>{locked(i)}</React.Fragment>;
    }
    if (i < k) {
      const a = answers[i] || { word: '', joker: false };
      return (
        <React.Fragment key={i}>
          <span>{s.texte_avant} </span>
          <span
            data-testid="answer-pill"
            data-joker={a.joker ? 'true' : undefined}
            className={`inline-block rounded-full border-2 border-ink px-3 font-display font-semibold ${
              a.joker ? 'bg-grape text-white' : 'bg-mint text-ink'
            }`}
          >
            {a.word ? a.word : `✓ ${s.trou.consigne}`}
          </span>{' '}
        </React.Fragment>
      );
    }
    if (i === k) {
      const isJ = jokerWord !== null;
      return (
        <React.Fragment key={i}>
          <span>{s.texte_avant} </span>
          <div
            ref={activeRef}
            data-testid="hole-card"
            role="button"
            tabIndex={0}
            data-joker={isJ ? 'true' : undefined}
            aria-label={s.trou.consigne}
            onClick={onCardClick}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onCardClick();
              }
            }}
            className={`${
              isJ ? 'bg-grape text-white' : 'bg-coral text-ink'
            } border-2 border-ink shadow-brutal rounded-2xl p-4 my-3 font-display animate-pulse cursor-pointer`}
          >
            <div className="text-2xl font-bold uppercase">🎯 {s.trou.consigne}</div>
            {options.designationAuto && responders[k] && (
              <div className="mt-1 text-lg">👉 C'est à {responders[k]} !</div>
            )}
            {options.timerPression && (
              <div
                data-testid="timer"
                className="mt-2 inline-block rounded-full border-2 border-ink bg-white px-3 text-ink font-bold"
              >
                {timeLeft}
              </div>
            )}
            {isJ && (
              <div className="mt-2">
                <div className="text-3xl font-bold">🎲 {jokerWord}</div>
                <div className="text-sm">Tape pour valider</div>
              </div>
            )}
            {editing && !isJ && (
              <div className="mt-3 flex flex-wrap items-center gap-2" onClick={stop}>
                <input
                  aria-label="Mot dit"
                  autoFocus
                  value={word}
                  placeholder="Le mot crié (optionnel)"
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitWord();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-2 text-ink font-body"
                />
                <button
                  type="button"
                  aria-label="Valider"
                  onClick={(e) => {
                    stop(e);
                    submitWord();
                  }}
                  className="rounded-xl border-2 border-ink bg-mint px-3 py-2 shadow-brutal text-ink font-bold"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    validate({ word: '', joker: false });
                  }}
                  className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-ink font-bold"
                >
                  Passer
                </button>
              </div>
            )}
          </div>
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={i}>
        {locked(i)}{' '}
        <span
          aria-hidden="true"
          className="inline-block align-middle h-6 w-16 rounded-full border-2 border-ink bg-gray-300"
        />{' '}
      </React.Fragment>
    );
  };

  const sound = (label, emoji, fn) => (
    <button
      type="button"
      aria-label={label}
      onClick={fn}
      className="h-10 w-10 bg-white border-2 border-ink shadow-brutal rounded-xl text-xl"
    >
      {emoji}
    </button>
  );

  return (
    <div className="min-h-screen bg-cream font-body text-ink flex flex-col max-w-md mx-auto">
      <header className="sticky top-0 z-10 bg-cream border-b-2 border-ink flex items-center justify-between px-4 py-2">
        <span className="rounded-full bg-cyan text-white px-3 py-1 font-display font-bold">
          📖 {reader}
        </span>
        <div className="flex gap-2">
          {sound('Ba-dum Tss', '🥁', playBadumTss)}
          {sound('Suspense', '😱', playScream)}
          {sound('Applaudissements', '👏', playApplause)}
        </div>
      </header>
      <main className="flex-1 p-4">
        <Card className="font-body text-xl leading-relaxed">
          {segments.map(renderSegment)}
          {finished && (
            <div ref={activeRef} className="mt-4">
              <Button variant="primary" className="w-full" onClick={() => onFinish(answers)}>
                🎉 FIN DE L'HISTOIRE
              </Button>
            </div>
          )}
        </Card>
      </main>
      <div className="sticky bottom-0 p-4 bg-cream">
        {!finished && (
          <Button variant="grape" className="w-full" onClick={onJokerClick}>
            🎲 MOT JOKER (si ça sèche)
          </Button>
        )}
      </div>
    </div>
  );
}
