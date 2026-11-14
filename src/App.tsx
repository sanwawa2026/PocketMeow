import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  FolderHeart,
  Hand,
  Mic,
  RotateCcw,
  Share2,
  Square,
  X,
} from 'lucide-react';
import { z } from 'zod';
import { CatGallerySheet } from './components/CatGallerySheet';
import { type CatStageHandle, CatStage3D } from './components/CatStage3D';
import { DecreePosterModal } from './components/DecreePosterModal';
import { MeowTranslatorSheet } from './components/MeowTranslatorSheet';
import { SkinStudioSheet } from './components/SkinStudioSheet';
import { MeowAudioEngine } from './engine/meowAudioEngine';
import { loadCachedQuotes, pickQuoteForEmotion } from './engine/quoteCache';
import {
  type CatProfile,
  CatProfileSchema,
  type MeowTranslationResult,
  type PetMood,
  PRESET_CATS,
  type SassyQuote,
} from './schemas/cat';

type DockTab = 'interact' | 'skin' | 'translator' | 'gallery';

const CATS_STORAGE_KEY = 'pocketmeow_cats_v1';
const ACTIVE_ID_STORAGE_KEY = 'pocketmeow_active_cat_v1';

function loadSavedCats(): CatProfile[] {
  try {
    const raw = localStorage.getItem(CATS_STORAGE_KEY);
    if (!raw) return PRESET_CATS;
    const parsed = z.array(CatProfileSchema).min(1).safeParse(JSON.parse(raw));
    if (parsed.success) {
      // Ensure presets are always present
      const existingIds = new Set(parsed.data.map((c) => c.id));
      const merged = [...parsed.data];
      for (const preset of PRESET_CATS) {
        if (!existingIds.has(preset.id)) merged.push(preset);
      }
      return merged;
    }
  } catch {
    // fallback cleanly
  }
  return PRESET_CATS;
}

const MOOD_ACTIONS: { mood: PetMood; label: string }[] = [
  { mood: 'idle', label: '乖巧待机' },
  { mood: 'kneading', label: '踩奶按摩' },
  { mood: 'hunting', label: '追激光笔' },
  { mood: 'yawning', label: '打大哈欠' },
  { mood: 'tsundere', label: '傲娇撇头' },
  { mood: 'happy', label: '呼噜贴贴' },
  { mood: 'sleeping', label: '眯眼打盹' },
];

export default function App() {
  const stageRef = useRef<CatStageHandle | null>(null);
  const audioEngine = useMemo(() => new MeowAudioEngine(), []);
  const quickMicRafRef = useRef<number>(0);

  const [cats, setCats] = useState<CatProfile[]>(() => loadSavedCats());
  const [activeCatId, setActiveCatId] = useState<string>(() => {
    const savedId = localStorage.getItem(ACTIVE_ID_STORAGE_KEY);
    return savedId ?? PRESET_CATS[0].id;
  });

  const activeCat = useMemo(
    () => cats.find((c) => c.id === activeCatId) ?? cats[0] ?? PRESET_CATS[0],
    [cats, activeCatId]
  );

  const [mood, setMood] = useState<PetMood>('idle');
  const [activeTab, setActiveTab] = useState<DockTab>('interact');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [quickRecording, setQuickRecording] = useState(false);
  const [lastTranslation, setLastTranslation] = useState<MeowTranslationResult | null>(null);
  const [speechBubble, setSpeechBubble] = useState<{
    title: string;
    text: string;
    subline?: string;
  } | null>(() => {
    const initialQ = loadCachedQuotes()[0];
    return {
      title: initialQ.decreeTitle,
      text: initialQ.text,
      subline: '轻触 3D 猫头撸猫，或按住下方麦克风翻译猫语',
    };
  });

  const [posterOpen, setPosterOpen] = useState(false);
  const [posterQuote, setPosterQuote] = useState<SassyQuote>(() => loadCachedQuotes()[0]);

  useEffect(() => {
    try {
      localStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(cats));
    } catch {
      // Ignore quota exceeded if huge photo
    }
  }, [cats]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_ID_STORAGE_KEY, activeCat.id);
  }, [activeCat.id]);

  // Keyboard shortcut 'H' for Zen / Cinema mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleMoodSelect = (nextMood: PetMood) => {
    setMood(nextMood);
    if (nextMood === 'happy' || nextMood === 'kneading') {
      audioEngine.playPurr();
    } else if (nextMood === 'tsundere') {
      audioEngine.playMeowChirp(0.86);
    }
  };

  const handlePetZone = useCallback(
    (zone: 'head' | 'belly' | 'paws' | 'bell') => {
      if (zone === 'bell') {
        audioEngine.playBellJingle();
        setMood('happy');
        const q = pickQuoteForEmotion('affectionate');
        setSpeechBubble({ title: '铃铛轻响', text: q.text });
        setPosterQuote(q);
      } else if (zone === 'head') {
        audioEngine.playPurr();
        setMood('happy');
        const q = pickQuoteForEmotion('affectionate');
        setSpeechBubble({ title: q.decreeTitle, text: q.text });
        setPosterQuote(q);
      } else if (zone === 'belly') {
        audioEngine.playMeowChirp(0.84);
        setMood('tsundere');
        const q = pickQuoteForEmotion('annoyed');
        setSpeechBubble({ title: '肚皮禁区', text: q.text });
        setPosterQuote(q);
      } else {
        audioEngine.playMeowChirp(1.12);
        setMood('kneading');
        const q = pickQuoteForEmotion('demanding');
        setSpeechBubble({ title: q.decreeTitle, text: q.text });
        setPosterQuote(q);
      }
    },
    [audioEngine]
  );

  const handleApplySkin = (profile: CatProfile) => {
    setCats((prev) => {
      const exists = prev.some((c) => c.id === profile.id);
      if (exists) {
        return prev.map((c) => (c.id === profile.id ? profile : c));
      }
      return [profile, ...prev];
    });
    setActiveCatId(profile.id);
    setMood('happy');
    audioEngine.playMeowChirp(1.15);
    setSpeechBubble({
      title: '换肤完成',
      text: profile.appearance.temperament,
      subline: `${profile.appearance.breedLabel} · ${profile.appearance.rarity} 级外观已同步`,
    });
  };

  const handleSelectCat = (cat: CatProfile) => {
    setActiveCatId(cat.id);
    setMood('idle');
    audioEngine.playBellJingle();
    setSpeechBubble({
      title: cat.name,
      text: cat.appearance.temperament,
      subline: `${cat.appearance.breedLabel} · ${cat.appearance.rarity} 级御猫登场`,
    });
  };

  const handleDeleteCat = (id: string) => {
    setCats((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (activeCatId === id && filtered.length > 0) {
        setActiveCatId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleTranslationResult = (
    result: MeowTranslationResult,
    targetMood: PetMood
  ) => {
    setLastTranslation(result);
    setPosterQuote(result.quote);
    setMood(targetMood);
    setSpeechBubble({
      title: result.quote.decreeTitle,
      text: result.quote.text,
      subline: `本地声学特征 ${result.metrics.peakHz}Hz · 0ms 延迟直译`,
    });
  };

  // Bottom bar 1-tap quick translator button
  const toggleQuickRecord = async () => {
    if (quickRecording) {
      cancelAnimationFrame(quickMicRafRef.current);
      setQuickRecording(false);
      const { emotion, metrics } = audioEngine.stopAndAnalyze();
      const quote = pickQuoteForEmotion(emotion, lastTranslation?.quote.id);
      const targetMood: PetMood =
        emotion === 'affectionate'
          ? 'happy'
          : emotion === 'hungry'
            ? 'kneading'
            : emotion === 'sleepy'
              ? 'yawning'
              : 'tsundere';
      audioEngine.playMeowChirp(emotion === 'annoyed' ? 0.85 : 1.08);
      handleTranslationResult({ emotion, quote, metrics, timestamp: Date.now() }, targetMood);
      return;
    }

    setMood('listening');
    try {
      await audioEngine.startListening();
      setQuickRecording(true);
      const sampleLoop = () => {
        audioEngine.sampleSpectrum(12);
        quickMicRafRef.current = requestAnimationFrame(sampleLoop);
      };
      quickMicRafRef.current = requestAnimationFrame(sampleLoop);
    } catch {
      const sim = audioEngine.simulateQuickMeow();
      const quote = pickQuoteForEmotion(sim.emotion, lastTranslation?.quote.id);
      audioEngine.playMeowChirp(1.06);
      setTimeout(() => {
        handleTranslationResult(
          { emotion: sim.emotion, quote, metrics: sim.metrics, timestamp: Date.now() },
          'tsundere'
        );
      }, 450);
    }
  };

  const openTab = (tab: DockTab) => {
    if (tab === 'interact') {
      setActiveTab('interact');
      setSheetOpen(false);
    } else if (activeTab === tab && sheetOpen) {
      setSheetOpen(false);
      setActiveTab('interact');
    } else {
      setActiveTab(tab);
      setSheetOpen(true);
    }
  };

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#E5E8EE] text-slate-900">
      {/* Unobstructed Full-Viewport 3D Cat Stage */}
      <CatStage3D
        ref={stageRef}
        appearance={activeCat.appearance}
        mood={mood}
        onPetZone={handlePetZone}
      />

      {/* Minimal 3-Zone Top Bar (No backdrop-blur over WebGL; solid clean bar) */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2 shadow-sm">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            PocketMeow
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline" aria-hidden="true">
            |
          </span>
          <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex whitespace-nowrap">
            <span className="font-semibold text-slate-900">{activeCat.name}</span>
            <span aria-hidden="true">·</span>
            <span>{activeCat.appearance.breedLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular font-medium text-orange-700">
              {activeCat.appearance.rarity}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => stageRef.current?.resetCamera()}
            title="重置 3D 视角"
            aria-label="重置 3D 视角"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm transition-colors hover:bg-white hover:text-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPosterOpen(true)}
            className="flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>导出圣旨卡</span>
          </button>
        </div>
      </header>

      {/* Non-occluding Sassy Cat Speech Bubble */}
      {speechBubble && !dockCollapsed && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4 sm:top-20">
          <div className="pointer-events-auto relative w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-orange-700">
                    {speechBubble.title}
                  </span>
                  {speechBubble.subline && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{speechBubble.subline}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium leading-snug text-slate-900">
                  “{speechBubble.text}”
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭气泡"
                onClick={() => setSpeechBubble(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock (Zero Mid-Screen Occlusion) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 flex flex-col items-center px-3 pb-4 transition-transform duration-200 ease-out sm:px-6 ${
          dockCollapsed ? 'translate-y-[calc(100%-46px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Cinema Mode Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-200 bg-white/95 px-3.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:text-slate-900"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>展开主子控制台</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>纯享视角 (H)</span>
            </>
          )}
        </button>

        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg">
          {/* Expandable Feature Sheet */}
          {sheetOpen && activeTab === 'skin' && (
            <div className="border-b border-slate-100">
              <SkinStudioSheet
                activeCat={activeCat}
                onApplySkin={handleApplySkin}
                onClose={() => openTab('interact')}
              />
            </div>
          )}

          {sheetOpen && activeTab === 'translator' && (
            <div className="border-b border-slate-100">
              <MeowTranslatorSheet
                activeCat={activeCat}
                audioEngine={audioEngine}
                lastTranslation={lastTranslation}
                onListeningChange={(listening) => setMood(listening ? 'listening' : 'idle')}
                onTranslationResult={handleTranslationResult}
                onClose={() => openTab('interact')}
              />
            </div>
          )}

          {sheetOpen && activeTab === 'gallery' && (
            <div className="border-b border-slate-100">
              <CatGallerySheet
                cats={cats}
                activeCatId={activeCat.id}
                onSelectCat={handleSelectCat}
                onDeleteCat={handleDeleteCat}
                onClose={() => openTab('interact')}
              />
            </div>
          )}

          {/* Quick Mood Actions Strip (visible in interact mode) */}
          {!sheetOpen && (
            <div className="pocket-scroll flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2">
              {MOOD_ACTIONS.map((item) => (
                <button
                  key={item.mood}
                  type="button"
                  onClick={() => handleMoodSelect(item.mood)}
                  className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mood === item.mood
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Primary Bottom Tab Bar + Quick Mic Button */}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="grid flex-1 grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => openTab('interact')}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:flex-row sm:gap-1.5 sm:text-xs ${
                  activeTab === 'interact' && !sheetOpen
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Hand className="h-4 w-4" />
                <span>撸猫互动</span>
              </button>

              <button
                type="button"
                onClick={() => openTab('skin')}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:flex-row sm:gap-1.5 sm:text-xs ${
                  activeTab === 'skin' && sheetOpen
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span>拍照换肤</span>
              </button>

              <button
                type="button"
                onClick={() => openTab('translator')}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:flex-row sm:gap-1.5 sm:text-xs ${
                  activeTab === 'translator' && sheetOpen
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Mic className="h-4 w-4" />
                <span>翻译面板</span>
              </button>

              <button
                type="button"
                onClick={() => openTab('gallery')}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:flex-row sm:gap-1.5 sm:text-xs ${
                  activeTab === 'gallery' && sheetOpen
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FolderHeart className="h-4 w-4" />
                <span>御猫档案</span>
              </button>
            </div>

            {/* Instant Zero-Latency Meow Mic Trigger */}
            <button
              type="button"
              onClick={toggleQuickRecord}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-transform active:scale-[0.97] whitespace-nowrap ${
                quickRecording
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-orange-600 hover:bg-orange-500'
              }`}
            >
              {quickRecording ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>停止翻译</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  <span>听猫语</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Collectible Imperial Decree PNG Poster Modal */}
      <DecreePosterModal
        open={posterOpen}
        cat={activeCat}
        initialQuote={posterQuote}
        captureSnapshot={() => stageRef.current?.captureSnapshot() ?? null}
        onClose={() => setPosterOpen(false)}
      />
    </div>
  );
}
