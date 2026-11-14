import { useEffect, useRef, useState } from 'react';
import { Mic, RefreshCw, Square, Volume2 } from 'lucide-react';
import { MeowAudioEngine } from '../engine/meowAudioEngine';
import {
  loadCachedQuotes,
  pickQuoteForEmotion,
  refreshQuotesViaGemini,
} from '../engine/quoteCache';
import {
  type CatProfile,
  type MeowEmotion,
  type MeowTranslationResult,
  type PetMood,
  type SassyQuote,
} from '../schemas/cat';

interface MeowTranslatorSheetProps {
  activeCat: CatProfile;
  audioEngine: MeowAudioEngine;
  lastTranslation: MeowTranslationResult | null;
  onListeningChange: (listening: boolean) => void;
  onTranslationResult: (result: MeowTranslationResult, targetMood: PetMood) => void;
  onClose: () => void;
}

const EMOTION_TO_MOOD: Record<MeowEmotion, PetMood> = {
  demanding: 'tsundere',
  annoyed: 'tsundere',
  affectionate: 'happy',
  hungry: 'kneading',
  sleepy: 'yawning',
  philosophical: 'idle',
};

const EMOTION_LABEL: Record<MeowEmotion, string> = {
  demanding: '颐指气使',
  annoyed: '略带嫌弃',
  affectionate: '勉强撒娇',
  hungry: '催饭警报',
  sleepy: '困意袭来',
  philosophical: '猫生哲学',
};

const CONTOUR_LABEL: Record<MeowTranslationResult['metrics']['contour'], string> = {
  rising: '上扬催促音',
  falling: '低沉叹气音',
  trill: '高频颤音呼噜',
  steady: '平稳宣判音',
};

export function MeowTranslatorSheet({
  activeCat,
  audioEngine,
  lastTranslation,
  onListeningChange,
  onTranslationResult,
  onClose,
}: MeowTranslatorSheetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [spectrum, setSpectrum] = useState<number[]>(() => new Array<number>(24).fill(0.1));
  const [quotesCount, setQuotesCount] = useState(() => loadCachedQuotes().length);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioEngine.cleanupStream();
      onListeningChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizeAnalysis = (
    emotion: MeowEmotion,
    metrics: MeowTranslationResult['metrics'],
    playFeedbackAudio = true
  ) => {
    const quote: SassyQuote = pickQuoteForEmotion(emotion, lastTranslation?.quote.id);
    const result: MeowTranslationResult = {
      emotion,
      quote,
      metrics,
      timestamp: Date.now(),
    };
    if (playFeedbackAudio) {
      if (emotion === 'affectionate' || emotion === 'sleepy') {
        audioEngine.playPurr();
      } else {
        audioEngine.playMeowChirp(emotion === 'annoyed' ? 0.85 : 1.08);
      }
    }
    onTranslationResult(result, EMOTION_TO_MOOD[emotion]);
  };

  const startRecording = async () => {
    if (isRecording) return;
    setStatusMsg(null);
    try {
      await audioEngine.startListening();
      setIsRecording(true);
      onListeningChange(true);

      const loop = () => {
        setSpectrum(audioEngine.sampleSpectrum(24));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setStatusMsg('未获取到麦克风权限，已为你切换本地声学模拟采样。');
      onListeningChange(true);
      setTimeout(() => {
        onListeningChange(false);
        const sim = audioEngine.simulateQuickMeow();
        finalizeAnalysis(sim.emotion, sim.metrics, true);
      }, 650);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    cancelAnimationFrame(rafRef.current);
    setIsRecording(false);
    onListeningChange(false);
    setSpectrum(new Array<number>(24).fill(0.1));

    const { emotion, metrics } = audioEngine.stopAndAnalyze();
    finalizeAnalysis(emotion, metrics, true);
  };

  const handleQuickSim = () => {
    setStatusMsg(null);
    onListeningChange(true);
    audioEngine.playMeowChirp(1.1);
    setTimeout(() => {
      onListeningChange(false);
      const sim = audioEngine.simulateQuickMeow();
      finalizeAnalysis(sim.emotion, sim.metrics, false);
    }, 520);
  };

  const handleRefreshQuotes = async () => {
    setIsRefreshingQuotes(true);
    setStatusMsg('正在请求 Gemini 为当前主子定制 30 条毒舌语录…');
    const res = await refreshQuotesViaGemini({
      catName: activeCat.name,
      breed: activeCat.appearance.breedLabel,
      temperament: activeCat.appearance.temperament,
    });
    setQuotesCount(res.quotes.length);
    setStatusMsg(res.message);
    setIsRefreshingQuotes(false);
  };

  return (
    <div className="pocket-scroll max-h-[60vh] overflow-y-auto px-5 pb-5 pt-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            零延迟猫语翻译机
          </h2>
          <p className="text-xs text-slate-500">
            Web Audio API 本地频段提取 · 倾听时 3D 主子会自动竖耳歪头
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          收起
        </button>
      </div>

      {/* Live 24-Band Spectrum Visualizer + Record Trigger */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex h-14 items-end justify-center gap-1.5 px-2">
          {spectrum.map((val, idx) => (
            <div
              key={idx}
              className="w-2 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(12, Math.round(val * 100))}%`,
                backgroundColor: isRecording ? '#EA580C' : '#CBD5E1',
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex min-h-[48px] items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-orange-500 active:scale-[0.98]"
            >
              <Mic className="h-4 w-4" />
              <span>点击开始听猫叫</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-slate-800 active:scale-[0.98]"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>停止并立刻翻译</span>
            </button>
          )}

          <button
            type="button"
            disabled={isRecording}
            onClick={handleQuickSim}
            className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" />
            <span>模拟一声猫叫</span>
          </button>
        </div>
      </div>

      {/* Acoustic Readout + Translation Card */}
      {lastTranslation && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">
              {lastTranslation.quote.decreeTitle} · {EMOTION_LABEL[lastTranslation.emotion]}
            </span>
            <span className="font-mono-tabular">
              {lastTranslation.metrics.peakHz} Hz · {CONTOUR_LABEL[lastTranslation.metrics.contour]} · {lastTranslation.metrics.durationMs} ms
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
            “{lastTranslation.quote.text}”
          </p>
        </div>
      )}

      {/* LocalStorage Quote Cache Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500 font-mono-tabular">
          本地缓存毒舌语录：{quotesCount} 条（0 延迟命中）
        </span>
        <button
          type="button"
          disabled={isRefreshingQuotes}
          onClick={handleRefreshQuotes}
          className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
          <span>AI 批量更新 30 条专属语录</span>
        </button>
      </div>

      {statusMsg && <p className="mt-2 text-xs text-slate-600">{statusMsg}</p>}
    </div>
  );
}
