import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RESIDENCY_SECTIONS, RESIDENCY_TOTAL,
  ResidencyQuestion, ResidencySection
} from '../data/residencyData';
import {
  ArrowLeft, RotateCcw, HelpCircle, Volume2, VolumeX,
  Shuffle, SortAsc, AlertTriangle, CheckCircle2, XCircle,
  Eye, EyeOff, Scissors, BarChart, Check, Clock,
  RefreshCw, SlidersHorizontal, X, List, BookOpen, Flag
} from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface Props { onGoBack: () => void; }

// Flatten all questions
type FlatQ = ResidencyQuestion & { sectionId: string; sectionTitle: string };
const ALL_FLAT: FlatQ[] = RESIDENCY_SECTIONS.flatMap(sec =>
  sec.questions.map(q => ({ ...q, sectionId: sec.id, sectionTitle: sec.title }))
);

function getActiveSectionIdx(globalIdx: number) {
  let active = 0;
  for (let i = 0; i < RESIDENCY_SECTIONS.length; i++) {
    if (globalIdx >= RESIDENCY_SECTIONS[i].startIndex) active = i;
    else break;
  }
  return active;
}

const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ'];

export const ResidencyTestPage: React.FC<Props> = ({ onGoBack }) => {
  // ── Question pool (supports shuffle/filter) ──
  const [questions, setQuestions] = useState<FlatQ[]>(ALL_FLAT);
  const originalQuestions = ALL_FLAT;

  // ── Navigation ──
  const [currentIdx, setCurrentIdx] = useState(0);
  const [jumpInput, setJumpInput] = useState('');

  // ── Answer state ──
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [shuffledOptionsMapping, setShuffledOptionsMapping] = useState<number[] | null>(null);

  // ── Session counters ──
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [responses, setResponses] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});
  const [historicalWrongIds, setHistoricalWrongIds] = useState<string[]>([]);
  const [sessionWrongIds, setSessionWrongIds] = useState<string[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [mistakesSessionAnswers, setMistakesSessionAnswers] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});
  const [croppedIds, setCroppedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // ── Filters ──
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlySessionWrong, setOnlySessionWrong] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  // ── Settings ──
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [immediateShow, setImmediateShow] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showToc, setShowToc] = useState(true);

  const tocRef = useRef<HTMLDivElement>(null);
  const activeTocRef = useRef<HTMLButtonElement>(null);

  // ── Active pool ──
  const activeQuestionsPool = questions
    .filter(q => !croppedIds.has(String(q.globalIndex)))
    .filter(q => !hiddenIds.has(String(q.globalIndex)))
    .filter(q => {
      if (onlyWrong) return historicalWrongIds.includes(String(q.globalIndex)) || !!mistakesSessionAnswers[String(q.globalIndex)];
      if (onlySessionWrong) return sessionWrongIds.includes(String(q.globalIndex));
      if (onlyFlagged) return flaggedIds.includes(String(q.globalIndex));
      return true;
    });

  const safeIdx = currentIdx >= 0 && currentIdx < activeQuestionsPool.length ? currentIdx : 0;
  const currentQ = activeQuestionsPool[safeIdx];
  const qKey = currentQ ? String(currentQ.globalIndex) : '';

  const activeSectionIdx = currentQ ? getActiveSectionIdx(currentQ.globalIndex) : 0;

  // Sync bounds
  useEffect(() => {
    if (activeQuestionsPool.length > 0 && currentIdx >= activeQuestionsPool.length) setCurrentIdx(0);
  }, [activeQuestionsPool.length, currentIdx]);

  // Restore answer on navigation
  useEffect(() => {
    if (!currentQ) return;
    const key = String(currentQ.globalIndex);
    const resp = onlyWrong ? mistakesSessionAnswers[key] : responses[key];
    if (resp) { setSelectedOpt(resp.chosenOptionIndex); setChecked(true); }
    else { setSelectedOpt(null); setChecked(false); }
    setShuffledOptionsMapping(null);
  }, [currentIdx, currentQ?.globalIndex]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll TOC
  useEffect(() => {
    activeTocRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSectionIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === 'arrowright' || key === 'r' || key === 'კ') { e.preventDefault(); handleNext(); }
      else if (key === 'arrowleft' || key === 'e' || key === 'უ') { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, activeQuestionsPool]);

  // ── Handlers ──
  const handleSelectOption = (optIdx: number) => {
    if (checked) return;
    if (soundEnabled) playClickSound();
    setSelectedOpt(optIdx);
    evaluateAnswer(optIdx);
  };

  const evaluateAnswer = (optIdx: number) => {
    if (!currentQ) return;
    const realIdx = shuffledOptionsMapping ? shuffledOptionsMapping[optIdx] : optIdx;
    const isCorrect = realIdx === currentQ.correctIndex;
    const key = String(currentQ.globalIndex);
    if (onlyWrong ? !!mistakesSessionAnswers[key] : !!responses[key]) return;

    if (soundEnabled) { if (isCorrect) playCorrectSound(); else playIncorrectSound(); }

    const entry = { chosenOptionIndex: optIdx, isCorrect };
    const nextResponses = onlyWrong ? responses : { ...responses, [key]: entry };
    if (onlyWrong) setMistakesSessionAnswers(p => ({ ...p, [key]: entry }));

    let nc = correctCount, nw = wrongCount;
    let nHW = [...historicalWrongIds], nSW = [...sessionWrongIds];
    const wasPrevWrong = historicalWrongIds.includes(key);

    if (isCorrect) {
      nc++;
      if (wasPrevWrong) { nHW = nHW.filter(id => id !== key); nSW = nSW.filter(id => id !== key); nw = Math.max(0, nw - 1); }
    } else {
      if (!wasPrevWrong) nw++;
      if (!nHW.includes(key)) nHW.push(key);
      if (!nSW.includes(key)) nSW.push(key);
    }

    setResponses(nextResponses);
    setCorrectCount(nc); setWrongCount(nw);
    setSessionWrongIds(nSW); setHistoricalWrongIds(nHW);
    setChecked(true);

    if (autoAdvance) setTimeout(() => handleNext(), 800);
  };

  const handleNext = useCallback(() => {
    if (soundEnabled) playClickSound();
    if (currentIdx < activeQuestionsPool.length - 1) setCurrentIdx(i => i + 1);
  }, [currentIdx, activeQuestionsPool.length, soundEnabled]);

  const handlePrev = useCallback(() => {
    if (soundEnabled) playClickSound();
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  }, [currentIdx, soundEnabled]);

  const handleJumpToNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jumpInput);
    if (!isNaN(n) && n >= 1 && n <= activeQuestionsPool.length) {
      setCurrentIdx(n - 1); setJumpInput('');
      if (soundEnabled) playCorrectSound();
    } else {
      alert(`1-დან ${activeQuestionsPool.length}-მდე`);
      setJumpInput('');
    }
  };

  const toggleFlag = () => {
    if (!currentQ) return;
    const key = String(currentQ.globalIndex);
    setFlaggedIds(prev => prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]);
    playClickSound();
  };

  const shuffleQuestions = () => { playClickSound(); setQuestions([...questions].sort(() => Math.random() - 0.5)); setCurrentIdx(0); };
  const resetOrder = () => { playClickSound(); setQuestions([...originalQuestions]); setCurrentIdx(0); };
  const sortAlpha = () => { playClickSound(); setQuestions([...questions].sort((a, b) => a.text.localeCompare(b.text, 'ka-GE'))); setCurrentIdx(0); };

  const shuffleCurrentAnswers = () => {
    playClickSound();
    if (!currentQ) return;
    const size = currentQ.options.length;
    const indices = Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5);
    setShuffledOptionsMapping(indices);
  };

  const exciseCurrent = () => {
    playClickSound();
    if (!currentQ) return;
    setCroppedIds(prev => new Set([...prev, String(currentQ.globalIndex)]));
    if (currentIdx < questions.length - 1) handleNext(); else if (currentIdx > 0) handlePrev();
  };

  const retryQuestion = () => {
    if (!currentQ) return;
    const key = String(currentQ.globalIndex);
    const resp = responses[key];
    if (!resp) return;
    const wasCorrect = resp.isCorrect;
    const nr = { ...responses }; delete nr[key];
    setResponses(nr);
    setCorrectCount(c => wasCorrect ? Math.max(0, c - 1) : c);
    setWrongCount(w => !wasCorrect ? Math.max(0, w - 1) : w);
    setSelectedOpt(null); setChecked(false);
    playClickSound();
  };

  const resetAll = () => {
    playClickSound();
    setCurrentIdx(0); setSelectedOpt(null); setChecked(false);
    setResponses({}); setCorrectCount(0); setWrongCount(0);
    setHistoricalWrongIds([]); setSessionWrongIds([]);
    setFlaggedIds([]); setMistakesSessionAnswers({});
    setCroppedIds(new Set()); setHiddenIds(new Set());
    setOnlyWrong(false); setOnlySessionWrong(false); setOnlyFlagged(false);
    setQuestions([...originalQuestions]);
  };

  const jumpToSection = (sec: ResidencySection) => {
    playClickSound();
    const idx = activeQuestionsPool.findIndex(q => q.globalIndex >= sec.startIndex);
    if (idx >= 0) setCurrentIdx(idx);
    if (window.innerWidth < 768) setShowToc(false);
  };

  const formatTime = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const answeredCount = Object.keys(responses).length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const isFlagged = currentQ ? flaggedIds.includes(String(currentQ.globalIndex)) : false;

  // Options to display (possibly shuffled)
  const displayOptions = currentQ
    ? (shuffledOptionsMapping ? shuffledOptionsMapping.map(i => currentQ.options[i]) : currentQ.options)
    : [];
  const correctDisplayIdx = currentQ
    ? (shuffledOptionsMapping ? shuffledOptionsMapping.indexOf(currentQ.correctIndex) : currentQ.correctIndex)
    : 0;

  if (activeQuestionsPool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-zinc-600 dark:text-zinc-300 text-sm font-sans">ფილტრის პირობებს კითხვები ვერ შეესაბამება.</p>
        <button onClick={() => { setOnlyWrong(false); setOnlySessionWrong(false); setOnlyFlagged(false); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">ყველა კითხვა</button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 relative min-h-[calc(100vh-120px)]">
      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">

        {/* Top bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
          <button onClick={onGoBack} className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-300 transition shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">G. Nanetashvili • {currentQ?.sectionTitle}</p>
            <p className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 font-mono">კითხვა {safeIdx + 1}/{activeQuestionsPool.length} • #{currentQ?.origNum}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { setSoundEnabled(s => !s); playClickSound(); }}
              className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-300 transition"
              title="ხმა">
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { setShowTools(s => !s); playClickSound(); }}
              className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-300 transition"
              title="პარამეტრები">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowToc(s => !s)}
              className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-300 transition"
              title="სარჩევი">
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'სწორი', value: correctCount, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'შეცდ.', value: wrongCount, color: 'text-rose-600 dark:text-rose-400' },
            { label: 'სიზუსტე', value: `${accuracy}%`, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'დრო', value: formatTime(seconds), color: 'text-zinc-600 dark:text-zinc-300' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2">
              <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-sans">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${((safeIdx + 1) / activeQuestionsPool.length) * 100}%` }} />
          </div>
        </div>

        {/* Tools panel */}
        {showTools && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">პარამეტრები და ფილტრები</span>
              <button onClick={() => setShowTools(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {/* Filters */}
              {[
                { label: '❌ მხოლოდ შეცდომები', active: onlyWrong, toggle: () => { setOnlyWrong(o => !o); setOnlySessionWrong(false); setOnlyFlagged(false); setCurrentIdx(0); playClickSound(); } },
                { label: '⚡ სესიის შეცდ.', active: onlySessionWrong, toggle: () => { setOnlySessionWrong(o => !o); setOnlyWrong(false); setOnlyFlagged(false); setCurrentIdx(0); playClickSound(); } },
                { label: '🔖 მონიშნული', active: onlyFlagged, toggle: () => { setOnlyFlagged(o => !o); setOnlyWrong(false); setOnlySessionWrong(false); setCurrentIdx(0); playClickSound(); } },
                { label: '⚡ ავტო გადასვლა', active: autoAdvance, toggle: () => { setAutoAdvance(o => !o); playClickSound(); } },
                { label: '👁 მაჩვენე დაუყოვნ.', active: immediateShow, toggle: () => { setImmediateShow(o => !o); playClickSound(); } },
                { label: '📝 გამოცდის რეჟიმი', active: examMode, toggle: () => { setExamMode(o => !o); playClickSound(); } },
              ].map(item => (
                <button key={item.label} onClick={item.toggle}
                  className={`px-2.5 py-2 rounded-xl border text-left font-semibold transition ${item.active ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                  {item.label}
                </button>
              ))}
              {/* Actions */}
              <button onClick={shuffleQuestions} className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold flex items-center gap-1.5">
                <Shuffle className="w-3 h-3" /> კითხვ. არევა
              </button>
              <button onClick={resetOrder} className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold flex items-center gap-1.5">
                <SortAsc className="w-3 h-3" /> საწყისი თ.
              </button>
              <button onClick={shuffleCurrentAnswers} className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold flex items-center gap-1.5">
                <Shuffle className="w-3 h-3" /> პასუხ. არევა
              </button>
              <button onClick={exciseCurrent} className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold flex items-center gap-1.5">
                <Scissors className="w-3 h-3" /> ამოჭრა
              </button>
              <button onClick={sortAlpha} className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold flex items-center gap-1.5">
                <SortAsc className="w-3 h-3" /> ანბანით
              </button>
              <button onClick={resetAll} className="px-2.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> გადატვ.
              </button>
            </div>
            {/* Jump to number */}
            <form onSubmit={handleJumpToNumber} className="flex gap-2 mt-3">
              <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)}
                placeholder={`1–${activeQuestionsPool.length}`}
                className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none" />
              <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">გადასვლა</button>
            </form>
          </div>
        )}

        {/* Question card */}
        {currentQ && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono font-bold mb-1.5 uppercase tracking-wider">
                  ორიგინალი #{currentQ.origNum}
                </p>
                <p className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-100 leading-relaxed">
                  {safeIdx + 1}. {currentQ.text}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={toggleFlag}
                  className={`p-2 rounded-xl border transition ${isFlagged ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-amber-300 hover:text-amber-500'}`}
                  title="მონიშვნა">
                  <Flag className="w-3.5 h-3.5" />
                </button>
                {checked && (
                  <button onClick={retryQuestion}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 hover:border-indigo-300 transition"
                    title="თავიდან">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2.5">
              {displayOptions.map((opt, i) => {
                const isCorrect = i === correctDisplayIdx;
                const isSelected = i === selectedOpt;
                const showAnswer = checked || (immediateShow && !examMode);
                let style = 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30';
                if (showAnswer) {
                  if (isCorrect) style = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200';
                  else if (isSelected && !isCorrect) style = 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300';
                  else style = 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500';
                } else if (isSelected) {
                  style = 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300';
                }
                return (
                  <button key={i} onClick={() => handleSelectOption(i)}
                    disabled={checked && !immediateShow}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer disabled:cursor-default ${style}`}>
                    <span className="shrink-0 w-6 h-6 rounded-md border border-current/40 flex items-center justify-center text-[11px] font-bold">
                      {showAnswer && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                        showAnswer && isSelected && !isCorrect ? <XCircle className="w-4 h-4" /> :
                          LETTERS[i] || String.fromCharCode(65 + i)}
                    </span>
                    <span className="leading-relaxed pt-0.5">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {checked && !examMode && (
              <div className={`text-xs font-semibold px-4 py-2.5 rounded-xl ${selectedOpt === correctDisplayIdx ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'}`}>
                {selectedOpt === correctDisplayIdx ? '✓ სწორია!' : `✗ სწორი პასუხი: ${LETTERS[correctDisplayIdx]}) ${displayOptions[correctDisplayIdx]}`}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={handlePrev} disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition">
            ◀ წინა
          </button>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            {safeIdx + 1}/{activeQuestionsPool.length}
          </span>
          <button onClick={handleNext} disabled={currentIdx === activeQuestionsPool.length - 1}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition">
            შემდეგი ▶
          </button>
        </div>
      </div>

      {/* ── TOC sidebar (desktop) ── */}
      {showToc && (
        <aside ref={tocRef}
          className="w-52 shrink-0 hidden md:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden self-start sticky top-4">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> სარჩევი
            </span>
            <button onClick={() => setShowToc(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[70vh] py-1">
            {RESIDENCY_SECTIONS.map((sec, i) => {
              const isActive = i === activeSectionIdx;
              const secAnswered = sec.questions.filter(q => responses[String(q.globalIndex)]).length;
              const secCorrect = sec.questions.filter(q => responses[String(q.globalIndex)]?.isCorrect).length;
              return (
                <button key={sec.id}
                  ref={isActive ? activeTocRef : undefined}
                  onClick={() => jumpToSection(sec)}
                  className={`w-full text-left px-3 py-2 text-[11px] leading-tight border-l-2 transition ${isActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
                  <span className="block leading-snug">{sec.title}</span>
                  <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">
                    {secAnswered > 0 ? `${secCorrect}/${secAnswered} · ` : ''}{sec.questions.length}კ.
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Mobile TOC */}
      {showToc && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowToc(false)} />
          <aside className="relative ml-auto w-64 h-full bg-white dark:bg-zinc-900 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">სარჩევი</span>
              <button onClick={() => setShowToc(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {RESIDENCY_SECTIONS.map((sec, i) => (
                <button key={sec.id}
                  ref={i === activeSectionIdx ? activeTocRef : undefined}
                  onClick={() => jumpToSection(sec)}
                  className={`w-full text-left px-4 py-2.5 text-xs leading-snug border-l-2 transition ${i === activeSectionIdx ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'border-transparent text-zinc-600 dark:text-zinc-400'}`}>
                  {sec.title}
                  <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{sec.questions.length} კ.</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
