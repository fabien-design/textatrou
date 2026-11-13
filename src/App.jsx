import React, { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import PacksScreen from './screens/PacksScreen.jsx';
import ReaderTurnScreen from './screens/ReaderTurnScreen.jsx';
import GamePlayScreen from './screens/GamePlayScreen.jsx';
import EndGameScreen from './screens/EndGameScreen.jsx';
import { VOICES, VOICE_BUNDLE, preloadVoice, speak, isVoiceReady } from './lib/speech.js';
import { STORIES, JOKERS, PACKS, THEMES } from './data/stories.js';
import { prepareStory, nextReader, pickStory, pickThemes, countStories } from './game/engine.js';
import {
  loadPlayers, savePlayers, loadOptions, saveOptions,
  loadUnlockedPacks, unlockPack, loadUnlockedVoices, unlockVoice, loadAgeConfirmed, saveAgeConfirmed,
} from './lib/storage.js';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [players, setPlayers] = useState(() => loadPlayers());
  const [options, setOptions] = useState(() => loadOptions());
  const [unlocked, setUnlocked] = useState(() => loadUnlockedPacks());
  const [ageConfirmed, setAgeConfirmed] = useState(() => loadAgeConfirmed());
  const [selectedPack, setSelectedPack] = useState('gratuit');
  const [packsReturn, setPacksReturn] = useState('home');
  const [reader, setReader] = useState(null);
  const [playedIds, setPlayedIds] = useState([]);
  const [story, setStory] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [themes, setThemes] = useState([]);
  const [unlockedVoices, setUnlockedVoices] = useState(() => loadUnlockedVoices());
  const [voiceProgress, setVoiceProgress] = useState(() => (isVoiceReady(options.voiceId) ? 1 : 0));

  useEffect(() => {
    if (screen !== 'lobby' || options.readerMode !== 'voix') return;
    let alive = true;
    setVoiceProgress(isVoiceReady(options.voiceId) ? 1 : 0);
    Promise.resolve(preloadVoice(options.voiceId, (p) => alive && setVoiceProgress(p))).catch(() => {});
    return () => { alive = false; };
  }, [screen, options.readerMode, options.voiceId]);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [screen]);

  const effectivePack = selectedPack === 'gratuit' || unlocked.includes(selectedPack) ? selectedPack : 'gratuit';
  const freeCount = countStories(STORIES, 'gratuit');
  const counts = Object.fromEntries(PACKS.map((p) => [p.id, countStories(STORIES, p.id)]));
  const packName = PACKS.find((p) => p.id === effectivePack)?.name ?? '';

  const handlePlayers = (p) => {
    setPlayers(p);
    savePlayers(p);
  };
  const handleOptions = (o) => {
    setOptions(o);
    saveOptions(o);
  };

  const openPacks = (ret) => {
    setPacksReturn(ret);
    setScreen('packs');
  };

  const startStory = (filter) => {
    const voice = options.readerMode === 'voix';
    const r = voice ? null : reader ? nextReader(players, reader) : players[Math.floor(Math.random() * players.length)];
    const s = pickStory(STORIES, filter, playedIds) || pickStory(STORIES, { pack: 'gratuit' }, playedIds);
    if (!s) return;
    setPlayedIds([...playedIds, s.id]);
    setStory(prepareStory(s, players, r));
    setReader(r);
    setAnswers([]);
    setScreen('readerTurn');
  };

  const finish = (a) => {
    setAnswers(a);
    setThemes(pickThemes(STORIES, THEMES, unlocked, playedIds));
    setScreen('end');
  };

  const unlock = (id) => {
    const list = unlockPack(id);
    setUnlocked(list);
    if (packsReturn === 'end') setThemes(pickThemes(STORIES, THEMES, list, playedIds));
  };

  let content = null;
  if (screen === 'home') {
    content = (
      <HomeScreen
        freeCount={freeCount}
        onPlay={() => setScreen('lobby')}
        onPacks={() => openPacks('home')}
        options={options}
        onOptionsChange={handleOptions}
      />
    );
  } else if (screen === 'lobby') {
    content = (
      <LobbyScreen
        players={players}
        onPlayersChange={handlePlayers}
        options={options}
        onOptionsChange={handleOptions}
        packName={packName}
        onOpenPacks={() => openPacks('lobby')}
        onBack={() => setScreen('home')}
        voices={VOICES}
        unlockedVoices={unlockedVoices}
        voiceProgress={voiceProgress}
        onStart={() => startStory({ pack: effectivePack })}
      />
    );
  } else if (screen === 'packs') {
    content = (
      <PacksScreen
        packs={PACKS}
        unlocked={unlocked}
        counts={counts}
        selected={effectivePack}
        onSelect={(id) => {
          setSelectedPack(id);
          setScreen(packsReturn);
        }}
        onUnlock={unlock}
        ageConfirmed={ageConfirmed}
        onConfirmAge={() => {
          saveAgeConfirmed(true);
          setAgeConfirmed(true);
        }}
        onClose={() => setScreen(packsReturn)}
        voices={VOICES}
        unlockedVoices={unlockedVoices}
        onUnlockVoice={(id) => setUnlockedVoices(unlockVoice(id))}
        onPreviewVoice={(id) => speak("Salut ! C'est moi qui vais lire vos histoires absurdes.", { voiceId: id })}
      />
    );
  } else if (screen === 'readerTurn') {
    content = <ReaderTurnScreen reader={reader} mode={options.readerMode} onReady={() => setScreen('play')} />;
  } else if (screen === 'play') {
    content = (
      <GamePlayScreen
        key={screen + (story?.id || '')}
        story={story}
        players={players}
        reader={reader}
        options={options}
        jokers={JOKERS}
        onFinish={finish}
      />
    );
  } else if (screen === 'end') {
    content = (
      <EndGameScreen
        story={story}
        answers={answers}
        onAnswersChange={setAnswers}
        voiceId={options.voiceId}
        themes={themes}
        onNextTheme={(id) => startStory({ thematique: id, packs: unlocked })}
        onLockedTheme={() => openPacks('end')}
        onHome={() => setScreen('home')}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-cream text-ink font-body relative overflow-x-clip">
      <style>{`@keyframes screenIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.screen-in{animation:screenIn .25s ease-out}`}</style>
      <div key={screen} className="screen-in">{content}</div>
    </div>
  );
}
