import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button, Card } from '../components/ui/index.js';
import { playPop, playJoker, playBeep } from '../lib/audio.js';
import { requestWakeLock } from '../lib/device.js';
import { speak, cancelSpeech, listen, stopListening, isSttSupported } from '../lib/speech.js';
import { pickResponder, pickJoker, fakeText } from '../game/engine.js';

const TIMER_START = 15;
const PUNCT = /^\s*[,.…)\]»]/;
const JOKER_PHRASES = [
  'Bon… ce sera : W !',
  'Trop lent ! Allez hop : W !',
  'Le destin a choisi : W !',
  'Silence radio ? Alors ce sera W !',
];

const css = `
@keyframes hole-glow {
  0%, 100% { box-shadow: 4px 4px 0 0 #1a1a1a, 0 0 0 0 rgba(255,107,107,0.7); transform: scale(1); }
  50% { box-shadow: 4px 4px 0 0 #1a1a1a, 0 0 0 10px rgba(255,107,107,0); transform: scale(1.02); }
}
@keyframes mic-bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
.hole-glow { animation: hole-glow 1.6s ease-in-out infinite; }
.mic-bounce { display: inline-block; animation: mic-bounce 0.9s ease-in-out infinite; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const splitSentences = (t) => (t || '').match(/[^.!?…]+[.!?…]*\s*/g) || [];

export default function GamePlayScreen({ story, players, reader, options = {}, jokers, onFinish }) {
  const segments = story.segments;
  const holes = segments.filter((s) => s.trou).length;
  const finText = segments.find((s) => s.texte_fin !== undefined)?.texte_fin ?? '';
  const voice = options.readerMode === 'voix';
  const rd = voice ? null : reader;

  const [k, setK] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [responders, setResponders] = useState(() => {
    if (!options.designationAuto || holes === 0) return [null];
    return [pickResponder(players, rd, null)];
  });
  const [phase, setPhase] = useState('idle'); // idle | listening | heard | noword | joker
  const [heard, setHeard] = useState(null);
  const [jokerWord, setJokerWord] = useState(null);
  const [hl, setHl] = useState(-1);
  const [help, setHelp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_START);
  const activeRef = useRef(null);
  const firstRender = useRef(true);
  const tokenRef = useRef(0);
  const timerRef = useRef(null);
  const jokerPendingRef = useRef(false);
  const [jokerPending, setJokerPending] = useState(false);
  const live = useRef({});

  const finished = k >= holes;
  live.current = { k, responders, options, voice, segments, jokers };

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

  // unmount cleanup
  useEffect(
    () => () => {
      jokerPendingRef.current = false;
      tokenRef.current += 1;
      clearTimer();
      cancelSpeech();
      stopListening();
    },
    []
  );

  // scroll
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

  const safeSpeak = async (text, tok) => {
    if (tok !== tokenRef.current) return;
    try {
      await speak(text, { voiceId: options.voiceId });
    } catch (e) {
      /* ignore */
    }
  };

  const validate = (answer) => {
    jokerPendingRef.current = false;
    setJokerPending(false);
    tokenRef.current += 1;
    clearTimer();
    playPop();
    const next = k + 1;
    setAnswers((a) => [...a, answer]);
    setResponders((r) => {
      const copy = [...r];
      copy[next] =
        options.designationAuto && next < holes ? pickResponder(players, rd, r[k] ?? null) : null;
      return copy;
    });
    setK(next);
    setPhase('idle');
    setHeard(null);
    setJokerWord(null);
    setHl(-1);
    setHelp(false);
    setTimeLeft(TIMER_START);
  };

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const listenStep = async (tok) => {
    setPhase('listening');
    setHelp(false);
    if (options.timerPression && !timerRef.current) {
      let left = TIMER_START;
      setTimeLeft(left);
      timerRef.current = setInterval(() => {
        left -= 1;
        setTimeLeft(left);
        if (left <= 3) playBeep();
        if (left <= 0) {
          clearTimer();
          stopListening();
          doJoker();
        }
      }, 1000);
    }
    let w = null;
    for (;;) {
      try {
        w = await listen({ timeoutMs: options.timerPression ? 15000 : 8000 });
      } catch (e) {
        w = null;
      }
      if (tok !== tokenRef.current) return;
      if (w || !options.timerPression) break;
      await sleep(250);
      if (tok !== tokenRef.current) return;
    }
    if (w) {
      clearTimer();
      setHeard(w);
      setPhase('heard');
      validate({ word: w, joker: false });
    } else {
      setPhase('noword');
    }
  };

  const doJoker = async () => {
    if (finished || jokerPendingRef.current) return;
    jokerPendingRef.current = true;
    setJokerPending(true);
    const tok = ++tokenRef.current;
    clearTimer();
    stopListening();
    cancelSpeech();
    playJoker();
    const w = pickJoker(jokers, segments[k].trou.categorie_joker);
    setJokerWord(w);
    setPhase('joker');
    setHl(-1);
    if (voice) {
      const phrase = JOKER_PHRASES[Math.floor(Math.random() * JOKER_PHRASES.length)].replace('W', w);
      await safeSpeak(phrase, tok);
    } else {
      await sleep(700);
    }
    if (tok !== tokenRef.current) return;
    validate({ word: w, joker: true });
  };

  const doSkip = () => {
    stopListening();
    cancelSpeech();
    validate({ word: '', joker: false });
  };

  const doRetry = () => {
    stopListening();
    listenStep(++tokenRef.current);
  };

  // voice flow per hole
  useEffect(() => {
    if (!voice) return undefined;
    const tok = ++tokenRef.current;
    (async () => {
      if (finished) {
        await safeSpeak(finText, tok);
        return;
      }
      const s = segments[k];
      const sentences = splitSentences(s.texte_avant);
      for (let i = 0; i < sentences.length; i++) {
        if (!/[\p{L}\p{N}]/u.test(sentences[i])) continue;
        if (tok !== tokenRef.current) return;
        setHl(i);
        await safeSpeak(sentences[i].trim(), tok);
      }
      if (tok !== tokenRef.current) return;
      setHl(-1);
      const name = live.current.responders[k];
      const ann =
        options.designationAuto && name
          ? `${s.trou.consigne} ! C'est à ${name} !`
          : `${s.trou.consigne} !`;
      await safeSpeak(ann, tok);
      if (tok !== tokenRef.current) return;
      await listenStep(tok);
    })();
    return () => {
      tokenRef.current += 1;
      clearTimer();
      cancelSpeech();
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, voice]);

  const onCardClick = () => {
    if (finished) return;
    if (jokerWord !== null) {
      validate({ word: jokerWord, joker: true });
      return;
    }
    if (voice || phase === 'listening' || phase === 'heard') return;
    if (isSttSupported()) listenStep(++tokenRef.current);
    else setHelp(true);
  };

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

  const after = (i, t) => (i > 0 && segments[i - 1].trou && PUNCT.test(t) ? t.replace(/^\s+/, '') : t);

  const renderSegment = (s, i) => {
    if (s.texte_fin !== undefined) {
      if (finished) return <span key={`f${i}`}>{after(i, s.texte_fin)} </span>;
      return <React.Fragment key={`f${i}`}>{locked(i)}</React.Fragment>;
    }
    const text = after(i, s.texte_avant);
    if (i < k) {
      const a = answers[i] || { word: '', joker: false };
      const nxt = segments[i + 1];
      const nt = nxt ? nxt.texte_avant ?? nxt.texte_fin ?? '' : '';
      return (
        <React.Fragment key={i}>
          <span>{text} </span>
          <span
            data-testid="answer-pill"
            data-joker={a.joker ? 'true' : undefined}
            className={`inline-block rounded-full border-2 border-ink px-3 font-display font-semibold ${
              a.joker ? 'bg-grape text-white' : 'bg-mint text-ink'
            }`}
          >
            {a.word ? a.word : `✓ ${s.trou.consigne}`}
          </span>
          {PUNCT.test(nt) ? '' : ' '}
        </React.Fragment>
      );
    }
    if (i === k) {
      const isJ = jokerWord !== null;
      const name = responders[k];
      const sentences = voice && hl >= 0 ? splitSentences(text) : null;
      return (
        <React.Fragment key={i}>
          {sentences ? (
            <span>
              {sentences.map((x, j) => (
                <span key={j} className={j === hl ? 'bg-sun/40 rounded' : ''}>
                  {x}
                </span>
              ))}{' '}
            </span>
          ) : (
            <span>{text} </span>
          )}
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
            } hole-glow border-2 border-ink shadow-brutal rounded-2xl p-4 my-3 font-display cursor-pointer`}
          >
            <div className="text-3xl font-bold uppercase">🎯 {s.trou.consigne}</div>
            {options.designationAuto && name && (
              <div className="mt-1 text-xl">👉 C'est à {name} !</div>
            )}
            {phase === 'listening' && !isJ && (
              <div className="mt-2 text-lg font-bold">
                <span className="mic-bounce">🎤</span> J'écoute…
              </div>
            )}
            {heard && !isJ && <div className="mt-2 text-4xl font-bold">{heard}</div>}
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
                <div className="text-4xl font-bold">🎲 {jokerWord}</div>
                {!voice && <div className="text-sm">Tape pour valider</div>}
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

  const showRetry = phase === 'noword' && (voice || isSttSupported());

  return (
    <div className="min-h-screen bg-cream font-body text-ink flex flex-col max-w-md mx-auto">
      <style>{css}</style>
      <header className="sticky top-0 z-10 bg-cream border-b-2 border-ink flex items-center justify-between px-4 py-2">
        <span className="rounded-full bg-cyan text-white px-3 py-1 font-display font-bold">
          {voice ? '🎙️ Narrateur' : `📖 ${reader}`}
        </span>
      </header>
      <main className="flex-1 p-4">
        {help && (
          <div role="alert" className="mb-3 rounded-xl border-2 border-ink bg-sun p-3 font-bold">
            Micro indisponible : utilisez Joker ou Passer (autorisez le micro dans votre navigateur)
          </div>
        )}
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
      {!finished && (
        <div className="sticky bottom-0 p-4 bg-cream flex flex-wrap gap-2">
          {showRetry && (
            <Button variant="primary" className="flex-1" onClick={doRetry}>
              🎤 Réessayer
            </Button>
          )}
          <Button
            variant="grape"
            className={`flex-1 ${jokerPending ? 'opacity-50' : ''}`}
            disabled={jokerPending}
            onClick={doJoker}
          >
            🎲 Mot joker
          </Button>
          <Button variant="white" className="flex-1" onClick={doSkip}>
            Passer
          </Button>
        </div>
      )}
    </div>
  );
}
