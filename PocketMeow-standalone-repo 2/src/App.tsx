import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Heart,
  Layers,
  Mic,
  RefreshCw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CatViewport, CatViewportHandle } from './components/CatViewport';
import { PosterModal } from './components/PosterModal';
import { CAT_PRESETS } from './core/presets';
import {
  enhanceCatWithGeminiVision,
  OfflineVisionExtraction,
  runOfflineFloodFillAnalysis,
} from './core/visionAnalyzer';
import {
  buildTranslationResult,
  classifyAcousticsToIntent,
  DEFAULT_30_QUOTES,
  LiveMicSession,
  loadQuoteBank,
  playProceduralMeowTone,
  refreshQuotesWithGemini,
  saveQuoteBank,
  startRealMicrophoneSession,
} from './core/meowTranslator';
import { generateSharePosterDataUrl } from './core/posterExporter';
import {
  AcousticFeaturesSchema,
  CatCoatPattern,
  CatEarStyle,
  CatEmotionState,
  CatProfile,
  CatProfileSchema,
  MeowQuote,
  MeowTranslationResult,
} from './schemas/catSchema';
import { z } from 'zod';

type ActiveTab = 'translate' | 'skin' | 'archive';

const SAVED_CATS_KEY = 'pocket_meow_saved_cats_v1';

const COAT_LABELS: Array<{ id: CatCoatPattern; label: string }> = [
  { id: 'solid', label: '纯色' },
  { id: 'tabby', label: '虎斑' },
  { id: 'calico', label: '三花' },
  { id: 'tuxedo', label: '奶牛/燕尾' },
  { id: 'bicolor', label: '双色' },
  { id: 'siamese', label: '重点色' },
  { id: 'tortoiseshell', label: '玳瑁' },
  { id: 'spotted', label: '豹斑' },
];

const EAR_LABELS: Array<{ id: CatEarStyle; label: string }> = [
  { id: 'pointed', label: '立耳' },
  { id: 'rounded', label: '圆耳' },
  { id: 'folded', label: '折耳' },
  { id: 'tufted', label: '耳羽' },
];

export default function App() {
  const viewportRef = useRef<CatViewportHandle | null>(null);
  const micSessionRef = useRef<LiveMicSession | null>(null);
  const spectrumRafRef = useRef<number>(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>('translate');
  const [profile, setProfile] = useState<CatProfile>(CAT_PRESETS[0]);
  const [emotion, setEmotion] = useState<CatEmotionState>('idle');
  const [muted, setMuted] = useState(false);

  // Saved profiles gallery
  const [savedCats, setSavedCats] = useState<CatProfile[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_CATS_KEY);
      if (raw) {
        const parsed = z.array(CatProfileSchema).safeParse(JSON.parse(raw));
        if (parsed.success && parsed.data.length > 0) return parsed.data;
      }
    } catch {
      // ignore
    }
    return CAT_PRESETS.slice(0, 3);
  });

  // Stage 2: Vision & Flood-Fill states
  const [catNameInput, setCatNameInput] = useState('雪球仙尊');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [floodExtraction, setFloodExtraction] = useState<OfflineVisionExtraction | null>(null);
  const [visionStatus, setVisionStatus] = useState<string>('');
  const [isEnhancingVision, setIsEnhancingVision] = useState(false);

  // Stage 3: Meow Translator & LocalStorage Quotes
  const [quotes, setQuotes] = useState<MeowQuote[]>(() => loadQuoteBank());
  const [isRecording, setIsRecording] = useState(false);
  const [spectrumBars, setSpectrumBars] = useState<number[]>(Array(16).fill(0.14));
  const [micError, setMicError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<MeowTranslationResult | null>(null);
  const [isGeneratingQuotes, setIsGeneratingQuotes] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string>('');
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [isExportingPoster, setIsExportingPoster] = useState(false);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(spectrumRafRef.current);
    };
  }, []);

  const handlePetCat = () => {
    playProceduralMeowTone('purr', muted);
    setEmotion('happy');
    const purrAcoustics = AcousticFeaturesSchema.parse({
      pitchHz: 185,
      durationMs: 900,
      energyRms: 0.14,
      spectralCentroidHz: 680,
      modulationBursts: 1,
      detectedIntent: 'affectionate_purr',
      sourceMode: 'simulated-meow',
    });
    setTranslation(buildTranslationResult(purrAcoustics, quotes));
  };

  const handleStartListening = async () => {
    if (isRecording) return;
    setMicError(null);
    setEmotion('listening');
    setIsRecording(true);

    try {
      const session = await startRealMicrophoneSession();
      micSessionRef.current = session;
      const updateBars = () => {
        if (!micSessionRef.current) return;
        setSpectrumBars(micSessionRef.current.getSpectrumBars());
        spectrumRafRef.current = requestAnimationFrame(updateBars);
      };
      spectrumRafRef.current = requestAnimationFrame(updateBars);
    } catch {
      // Graceful fallback when mic is blocked or unavailable in preview iframe
      micSessionRef.current = null;
      setMicError('未检测到可用麦克风权限，松手将自动切换声学模拟采样。');
      const animateFallbackBars = () => {
        setSpectrumBars(
          Array.from({ length: 16 }, () => 0.18 + Math.random() * 0.72)
        );
        spectrumRafRef.current = requestAnimationFrame(animateFallbackBars);
      };
      spectrumRafRef.current = requestAnimationFrame(animateFallbackBars);
    }
  };

  const handleStopListening = () => {
    if (!isRecording) return;
    setIsRecording(false);
    cancelAnimationFrame(spectrumRafRef.current);
    setSpectrumBars(Array(16).fill(0.14));

    if (micSessionRef.current) {
      const features = micSessionRef.current.stopAndAnalyze();
      micSessionRef.current = null;
      const result = buildTranslationResult(features, quotes);
      setTranslation(result);
      setEmotion(result.quote.moodReward);
      playProceduralMeowTone(
        features.pitchHz > 500 ? 'chirp' : 'royal',
        muted
      );
    } else {
      // Simulated acoustic burst
      const simPitch = 460 + Math.round(Math.random() * 240);
      const simCentroid = 1100 + Math.round(Math.random() * 900);
      const simEnergy = 0.16 + Math.round(Math.random() * 14) / 100;
      const simFeatures = AcousticFeaturesSchema.parse({
        pitchHz: simPitch,
        durationMs: 1150,
        energyRms: simEnergy,
        spectralCentroidHz: simCentroid,
        modulationBursts: 2,
        detectedIntent: classifyAcousticsToIntent(simPitch, simEnergy, simCentroid, 2, 1150),
        sourceMode: 'simulated-meow',
      });
      const result = buildTranslationResult(simFeatures, quotes);
      setTranslation(result);
      setEmotion(result.quote.moodReward);
      playProceduralMeowTone('chirp', muted);
    }
  };

  const handleQuickAcousticTest = (preset: 'purr' | 'demand' | 'hiss') => {
    const config =
      preset === 'purr'
        ? { pitchHz: 195, energyRms: 0.13, spectralCentroidHz: 620, bursts: 1, tone: 'purr' as const }
        : preset === 'demand'
        ? { pitchHz: 495, energyRms: 0.19, spectralCentroidHz: 1420, bursts: 2, tone: 'royal' as const }
        : { pitchHz: 680, energyRms: 0.34, spectralCentroidHz: 2450, bursts: 3, tone: 'chirp' as const };

    const features = AcousticFeaturesSchema.parse({
      pitchHz: config.pitchHz,
      durationMs: 950,
      energyRms: config.energyRms,
      spectralCentroidHz: config.spectralCentroidHz,
      modulationBursts: config.bursts,
      detectedIntent: classifyAcousticsToIntent(
        config.pitchHz,
        config.energyRms,
        config.spectralCentroidHz,
        config.bursts,
        950
      ),
      sourceMode: 'simulated-meow',
    });

    const result = buildTranslationResult(features, quotes);
    setTranslation(result);
    setEmotion(result.quote.moodReward);
    playProceduralMeowTone(config.tone, muted);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;

      setUploadedPhotoUrl(dataUrl);
      setVisionStatus('正在执行边缘洪泛去背与受光面色值提取...');

      try {
        const offline = await runOfflineFloodFillAnalysis(dataUrl, catNameInput);
        setFloodExtraction(offline);
        setProfile(offline.profile);
        setEmotion('listening');
        playProceduralMeowTone('chirp', muted);
        setVisionStatus(
          `离线洪泛换肤已就绪（耗时 ${offline.diagnostics.processingTimeMs} ms），正在请求 Gemini 视觉深度解析...`
        );

        setIsEnhancingVision(true);
        const enhanced = await enhanceCatWithGeminiVision(dataUrl, offline.profile);
        setIsEnhancingVision(false);

        if (enhanced) {
          setProfile(enhanced);
          setEmotion('proud');
          setVisionStatus('Gemini 视觉解析完成：已精校品种、毛色分布、双瞳与体态特征。');
        } else {
          setEmotion('happy');
          setVisionStatus('已启用本地离线洪泛＋受光面 50–80 分位精准换肤（零延迟兜底）。');
        }
      } catch (err) {
        setIsEnhancingVision(false);
        setVisionStatus(err instanceof Error ? err.message : '识图处理失败，请更换清晰猫咪照片');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBatchRefreshQuotes = async () => {
    setIsGeneratingQuotes(true);
    setQuoteStatus('正在呼唤 Gemini 定制 30 条专属主子毒舌语录...');
    const updated = await refreshQuotesWithGemini(
      profile.name,
      profile.breed,
      profile.personalityTag
    );
    setIsGeneratingQuotes(false);

    if (updated) {
      setQuotes(updated);
      setQuoteStatus(`已更新并缓存 ${updated.length} 条专属主子语录至 LocalStorage。`);
    } else {
      saveQuoteBank(DEFAULT_30_QUOTES);
      setQuotes(DEFAULT_30_QUOTES);
      setQuoteStatus('当前为离线模式，已重载本地 30 条精选毒舌猫语词库。');
    }
  };

  const handleExportPoster = async () => {
    const snapshot = viewportRef.current?.captureSnapshotDataUrl();
    if (!snapshot) return;
    setIsExportingPoster(true);
    try {
      const url = await generateSharePosterDataUrl({
        snapshotDataUrl: snapshot,
        profile,
        translation,
      });
      setPosterDataUrl(url);
    } finally {
      setIsExportingPoster(false);
    }
  };

  const handleSaveCurrentCat = () => {
    const updated = [profile, ...savedCats.filter((c) => c.id !== profile.id)].slice(0, 12);
    setSavedCats(updated);
    try {
      localStorage.setItem(SAVED_CATS_KEY, JSON.stringify(updated));
    } catch {
      // ignore quota errors
    }
  };

  const selectPreset = (preset: CatProfile) => {
    setProfile(preset);
    setCatNameInput(preset.name);
    setEmotion('proud');
    playProceduralMeowTone('royal', muted);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF1F5] text-slate-900">
      {/* Top Bar: Clean 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200 px-4 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base lg:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            PocketMeow 口袋主子
          </span>
        </div>

        {/* Zone 2: Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="功能模块切换">
          <button
            type="button"
            onClick={() => setActiveTab('translate')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'translate'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            猫语翻译
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('skin')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'skin'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            AI 拍照换肤
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'archive'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            主子档案与进度
          </button>
        </nav>

        {/* Zone 3: Single Primary Action + Mute */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? '开启音效' : '静音'}
            title={muted ? '开启音效' : '静音'}
            className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleExportPoster}
            disabled={isExportingPoster}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPoster ? '生成中...' : '导出圣旨卡'}</span>
          </button>
        </div>
      </header>

      {/* Main Responsive Workspace (1440px Dual-Column on Desktop / Mobile Thumb-First) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-3 sm:p-5 lg:p-6 pb-24 md:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Columns: Unobstructed 3D Cat Stage */}
        <section className="lg:col-span-7 flex flex-col">
          <CatViewport
            ref={viewportRef}
            profile={profile}
            emotion={emotion}
            onEmotionChange={setEmotion}
            onPet={handlePetCat}
            speechTitle={translation ? `${translation.quote.decreeTitle} · ${translation.rarityBonusLabel}` : undefined}
            speechText={translation ? translation.quote.text : profile.snarkyBio}
          />
        </section>

        {/* Right 5 Columns: Interactive Feature Deck */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {activeTab === 'translate' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <h1 className="text-lg font-bold text-slate-900">零延迟猫语翻译台</h1>
                <p className="text-xs text-slate-500 mt-1">
                  按住录音实时唤醒 3D 主子歪头竖耳倾听，本地 Web Audio 提取基频声纹并触发 30 条毒舌圣旨缓存。
                </p>
              </div>

              {/* Real-time Spectrum Visualizer */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>{isRecording ? '正在倾听主子声纹...' : '本地频谱待命中'}</span>
                  <span className="font-mono-tabular">
                    {translation ? `${translation.acoustics.pitchHz} Hz` : '0 Hz'}
                  </span>
                </div>
                <div className="h-14 flex items-end justify-between gap-1.5" aria-hidden="true">
                  {spectrumBars.map((val, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-sm transition-transform duration-75 ${
                        isRecording ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                      style={{
                        height: '100%',
                        transform: `scaleY(${Math.max(0.12, Math.min(1, val))})`,
                        transformOrigin: 'bottom',
                      }}
                    />
                  ))}
                </div>
                {micError && (
                  <p className="text-xs text-amber-700 mt-2">{micError}</p>
                )}
              </div>

              {/* Primary Hold-to-Translate Action */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onPointerDown={handleStartListening}
                  onPointerUp={handleStopListening}
                  onPointerLeave={() => {
                    if (isRecording) handleStopListening();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' && !isRecording) {
                      e.preventDefault();
                      handleStartListening();
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === ' ' && isRecording) {
                      e.preventDefault();
                      handleStopListening();
                    }
                  }}
                  className={`touch-none-select min-h-[54px] w-full rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    isRecording
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isRecording ? '松开立刻翻译圣旨' : '按住听主子发言（Web Audio）'}</span>
                </button>

                {/* Quick Acoustic Simulation Triggers */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAcousticTest('purr')}
                    className="min-h-[42px] px-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap truncate"
                  >
                    模拟：呼噜撒娇
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAcousticTest('demand')}
                    className="min-h-[42px] px-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap truncate"
                  >
                    模拟：催饭喵叫
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAcousticTest('hiss')}
                    className="min-h-[42px] px-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap truncate"
                  >
                    模拟：哈气警告
                  </button>
                </div>
              </div>

              {/* Translation Result Display */}
              {translation && (
                <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-amber-700">{translation.quote.decreeTitle}</span>
                    <span className="font-mono-tabular">
                      {translation.acoustics.pitchHz} Hz / 质心 {translation.acoustics.spectralCentroidHz} Hz
                    </span>
                  </div>
                  <p className="text-base font-medium text-slate-900 leading-relaxed">
                    “{translation.quote.text}”
                  </p>
                  <button
                    type="button"
                    onClick={handleExportPoster}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>合成 3D 造型＋今日猫语 PNG 海报</span>
                  </button>
                </div>
              )}

              {/* 30-Quote LocalStorage Cache Controls */}
              <div className="border-t border-slate-200 pt-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">毒舌文案库（LocalStorage 缓存）</h2>
                    <p className="text-xs text-slate-500 font-mono-tabular">
                      当前已缓存 {quotes.length} 条傲娇猫语
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBatchRefreshQuotes}
                    disabled={isGeneratingQuotes}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQuotes ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingQuotes ? '生成中...' : 'Gemini 批量定制'}</span>
                  </button>
                </div>
                {quoteStatus && (
                  <p className="text-xs text-teal-700">{quoteStatus}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'skin' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <h1 className="text-lg font-bold text-slate-900">AI 视觉识图与动态换肤</h1>
                <p className="text-xs text-slate-500 mt-1">
                  边缘洪泛去背＋50–80 分位受光面提取实现本地极速还原，联网自动叠加 Gemini 视觉精细特征。
                </p>
              </div>

              {/* Photo Upload + Cat Name */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium text-slate-700">
                  主子大名
                  <input
                    type="text"
                    value={catNameInput}
                    maxLength={20}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCatNameInput(val);
                      setProfile((prev) => ({ ...prev, name: val.trim() || '本尊主子' }));
                    }}
                    placeholder="输入你家猫的名字"
                    className="mt-1.5 w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </label>

                <label className="min-h-[48px] w-full rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap">
                  <Camera className="w-4 h-4" />
                  <span>{isEnhancingVision ? '正在 AI 解析猫片...' : '上传真猫照片 · 一键 3D 换肤'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>

                {visionStatus && (
                  <p className="text-xs text-slate-600 leading-relaxed">{visionStatus}</p>
                )}
              </div>

              {/* Flood Fill Mask + Color Palette Diagnostics */}
              {(uploadedPhotoUrl || floodExtraction) && (
                <div className="border-t border-slate-200 pt-4 flex items-center gap-3">
                  {uploadedPhotoUrl && (
                    <img
                      src={uploadedPhotoUrl}
                      alt="上传原图"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  {floodExtraction && (
                    <>
                      <img
                        src={floodExtraction.previewMaskDataUrl}
                        alt="边缘洪泛去背掩码"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                      />
                      <div className="text-xs text-slate-600 space-y-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          去背 {floodExtraction.diagnostics.backgroundRemovedPercent}% · 耗时 {floodExtraction.diagnostics.processingTimeMs} ms
                        </div>
                        <div className="font-mono-tabular flex items-center gap-1.5 flex-wrap">
                          {floodExtraction.diagnostics.dominantColors.map((hex, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                              <span
                                className="w-3 h-3 rounded-sm border border-slate-300 inline-block"
                                style={{ backgroundColor: hex }}
                              />
                              <span>{hex}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Curated Preset Cat Roster */}
              <div className="border-t border-slate-200 pt-4">
                <h2 className="text-xs font-semibold text-slate-700 mb-2.5">名猫快捷模板（点击即换装）</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CAT_PRESETS.map((preset) => {
                    const active = profile.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: preset.primaryColor }}
                        />
                        <span className="text-xs font-medium truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual Coat / Ear / Chubbiness Morph Controls */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">丰腴度体态微调</span>
                  <span className="font-mono-tabular text-slate-600">{profile.chubbiness.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.32}
                  step={0.02}
                  value={profile.chubbiness}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, chubbiness: Number(e.target.value) }))
                  }
                  className="w-full accent-slate-900"
                />

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {EAR_LABELS.map((ear) => (
                    <button
                      key={ear.id}
                      type="button"
                      onClick={() => setProfile((prev) => ({ ...prev, earStyle: ear.id }))}
                      className={`min-h-[38px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                        profile.earStyle === ear.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {ear.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {COAT_LABELS.map((coat) => (
                    <button
                      key={coat.id}
                      type="button"
                      onClick={() => setProfile((prev) => ({ ...prev, coatPattern: coat.id }))}
                      className={`min-h-[38px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                        profile.coatPattern === coat.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {coat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">主子档案库</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    保存当前定制花色造型至本地，或审阅全四阶段工程里程碑。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCurrentCat}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>收录当前主子</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {savedCats.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => selectPreset(cat)}
                    className={`w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                      profile.id === cat.id ? 'bg-slate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-7 h-7 rounded-lg border border-slate-300 shrink-0"
                        style={{ backgroundColor: cat.primaryColor }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{cat.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {cat.breed} · {cat.personalityTag}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-amber-700 shrink-0">
                      {cat.rarity}
                    </span>
                  </button>
                ))}
              </div>

              {/* 4-Stage Whitepaper Milestone Tracker */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <h2 className="text-sm font-semibold text-slate-900">全阶段工程里程碑（pocket-meow-mvp）</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>阶段 1：Three.js 14 部位骨骼猫、呼吸/眨眼/摇尾与手势逗猫就绪</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>阶段 2：边缘洪泛去背＋50–80 分位色值＋Gemini 视觉动态换肤就绪</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-900 font-medium">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>阶段 3：Web Audio 零延迟翻译＋30 条缓存＋PNG 圣旨海报错峰交付，请主公验收</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-500">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>阶段 4：核心渲染 `core/catRig.ts` 已解耦，待确认后迁移 Expo (`expo-gl`) 原生打包</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <a
                    href="/api/pocket-meow/download-repo-zip"
                    download="PocketMeow-standalone-repo.zip"
                    className="min-h-[44px] flex-1 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>下载独立 GitHub 源码包 (.zip)</span>
                  </a>
                  <a
                    href="https://github.com/sanwawa2026/Pocket_Meow"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub 仓库</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Sticky Thumb-Zone Bottom Tab Bar (Compact < 15% Viewport Height) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 grid grid-cols-3 h-16"
        aria-label="底部主导航"
      >
        <button
          type="button"
          onClick={() => setActiveTab('translate')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            activeTab === 'translate' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span>猫语翻译</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('skin')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            activeTab === 'skin' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>拍照换肤</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            activeTab === 'archive' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>档案进度</span>
        </button>
      </nav>

      <PosterModal
        posterDataUrl={posterDataUrl}
        catName={profile.name}
        onClose={() => setPosterDataUrl(null)}
      />
    </div>
  );
}
