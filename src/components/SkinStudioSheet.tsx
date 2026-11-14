import { type ChangeEvent, useRef, useState } from 'react';
import { Camera, Check, Sparkles, Upload } from 'lucide-react';
import {
  analyzeCatWithGeminiFallback,
  compressImageFileToDataUrl,
} from '../engine/catSkinAnalyzer';
import {
  type CatAppearance,
  type CatProfile,
  type EarType,
  type FloodFillDebug,
} from '../schemas/cat';

interface SkinStudioSheetProps {
  activeCat: CatProfile;
  onApplySkin: (profile: CatProfile) => void;
  onClose: () => void;
}

/**
 * Generates real synthetic cat portrait images on canvas so users can also 1-click test
 * our actual Flood-Fill background removal & 50-80 percentile lit-fur algorithm without needing a local file handy.
 */
function buildSamplePhotoDataUrl(variant: 'white-shadow' | 'ginger-sofa' | 'calico-wall'): string {
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 240;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  if (variant === 'white-shadow') {
    // Cool teal-slate wall background with shaded white cat + blue/amber heterochromia
    ctx.fillStyle = '#4B6378';
    ctx.fillRect(0, 0, 240, 240);
    // Shaded white fur body + lit white forehead
    ctx.fillStyle = '#D5DBE5';
    ctx.beginPath();
    ctx.ellipse(120, 175, 58, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EFF3FA';
    ctx.beginPath();
    ctx.arc(120, 102, 48, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(80, 74);
    ctx.lineTo(74, 34);
    ctx.lineTo(108, 60);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(160, 74);
    ctx.lineTo(166, 34);
    ctx.lineTo(132, 60);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#3B9EE8';
    ctx.beginPath();
    ctx.arc(102, 98, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8AC30';
    ctx.beginPath();
    ctx.arc(138, 98, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 'ginger-sofa') {
    ctx.fillStyle = '#738276';
    ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = '#E68A39';
    ctx.beginPath();
    ctx.ellipse(120, 175, 62, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(120, 100, 48, 0, Math.PI * 2);
    ctx.fill();
    // White chest bib
    ctx.fillStyle = '#FCF9F3';
    ctx.beginPath();
    ctx.ellipse(120, 165, 28, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(120, 102);
    ctx.lineTo(96, 140);
    ctx.lineTo(144, 140);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#D9D3C7';
    ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = '#FAF8F4';
    ctx.beginPath();
    ctx.ellipse(120, 175, 60, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(120, 100, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#DE7A2B';
    ctx.beginPath();
    ctx.arc(92, 85, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2A2930';
    ctx.beginPath();
    ctx.arc(146, 90, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  return c.toDataURL('image/jpeg', 0.9);
}

const EAR_OPTIONS: { value: EarType; label: string }[] = [
  { value: 'pointed', label: '立耳' },
  { value: 'folded', label: '折耳' },
  { value: 'tufted', label: '耳羽' },
  { value: 'curled', label: '卷耳' },
];

export function SkinStudioSheet({ activeCat, onApplySkin, onClose }: SkinStudioSheetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [catName, setCatName] = useState(activeCat.name);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sourcePreview, setSourcePreview] = useState<string | null>(activeCat.thumbnailDataUrl ?? null);
  const [debugInfo, setDebugInfo] = useState<FloodFillDebug | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [draftAppearance, setDraftAppearance] = useState<CatAppearance>(activeCat.appearance);
  const [sourceMethod, setSourceMethod] = useState<CatProfile['sourceMethod']>(activeCat.sourceMethod);

  const runAnalysis = async (dataUrl: string, suggestedName?: string) => {
    setIsAnalyzing(true);
    setSourcePreview(dataUrl);
    setStatusNotice('正在执行边缘洪泛去背与视觉特征解析…');

    try {
      const result = await analyzeCatWithGeminiFallback(dataUrl);
      setDraftAppearance(result.appearance);
      setDebugInfo(result.debug);
      setSourceMethod(result.method);
      setStatusNotice(result.notice ?? null);

      const finalName = suggestedName ?? (catName.trim() || result.appearance.breedLabel.slice(0, 6));
      setCatName(finalName);

      onApplySkin({
        id: `cat-${Date.now()}`,
        name: finalName,
        createdAt: Date.now(),
        sourceMethod: result.method,
        thumbnailDataUrl: dataUrl,
        appearance: result.appearance,
      });
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : '识图解析失败，请更换照片重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      await runAnalysis(compressed);
    } catch {
      setStatusNotice('图片读取失败，请确认文件格式为 PNG/JPG');
    } finally {
      e.target.value = '';
    }
  };

  const updateField = <K extends keyof CatAppearance>(key: K, val: CatAppearance[K]) => {
    const next = { ...draftAppearance, [key]: val };
    setDraftAppearance(next);
    onApplySkin({
      ...activeCat,
      name: catName.trim() || activeCat.name,
      sourceMethod,
      thumbnailDataUrl: sourcePreview ?? activeCat.thumbnailDataUrl,
      appearance: next,
    });
  };

  return (
    <div className="pocket-scroll max-h-[60vh] overflow-y-auto px-5 pb-5 pt-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            拍照 AI 动态换肤
          </h2>
          <p className="text-xs text-slate-500">
            边缘洪泛去背景 + 50–80 分位受光主色提取 · 联网自动启用 Gemini 视觉精修
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

      {/* Upload & Sample Test Strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-transform hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                <span>正在解析毛色与瞳孔…</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>上传自家主子照片</span>
              </>
            )}
          </button>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-slate-500">算法实测样本:</span>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => runAnalysis(buildSamplePhotoDataUrl('white-shadow'), '暗光白猫')}
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              暗光纯白异瞳
            </button>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => runAnalysis(buildSamplePhotoDataUrl('ginger-sofa'), '胖橘学长')}
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              绿沙发橘白
            </button>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => runAnalysis(buildSamplePhotoDataUrl('calico-wall'), '三花大王')}
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              招财三花
            </button>
          </div>
        </div>

        {/* Flood-Fill Visual Verification Box */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
          {debugInfo ? (
            <>
              <img
                src={debugInfo.segmentedPreviewUrl}
                alt="洪泛前景提取结果"
                referrerPolicy="no-referrer"
                className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {sourceMethod === 'gemini-vision' ? 'Gemini 视觉解析' : '本地洪泛去背'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 font-mono-tabular">
                  前景 {Math.round(debugInfo.foregroundRatio * 100)}% · 亮度 P50–P80 ({debugInfo.luminanceP50}–{debugInfo.luminanceP80})
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {debugInfo.litSwatches.map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      title={hex}
                      className="h-5 w-5 rounded-md border border-black/15"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <span className="ml-1 truncate text-xs text-slate-500">
                    {draftAppearance.breedLabel}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center gap-3 text-slate-500">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Camera className="h-6 w-6 text-slate-400" />
              </div>
              <div className="text-xs leading-relaxed">
                上传照片后，这里会实时展示边缘洪泛去背景结果与 50–80 分位受光主色色卡，并自动驱动 3D 换肤。
              </div>
            </div>
          )}
        </div>
      </div>

      {statusNotice && (
        <p className="mt-2.5 text-xs text-slate-600">{statusNotice}</p>
      )}

      {/* Fine-tune Appearance Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">主子爱称</label>
          <input
            type="text"
            maxLength={16}
            value={catName}
            onChange={(e) => {
              setCatName(e.target.value);
              onApplySkin({
                ...activeCat,
                name: e.target.value || '无名主子',
                appearance: draftAppearance,
                sourceMethod,
              });
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">
            耳型结构
          </label>
          <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
            {EAR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField('earType', opt.value)}
                className={`min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  draftAppearance.earType === opt.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>胖瘦体型</span>
            <span className="font-mono-tabular text-slate-500">
              {draftAppearance.chonkiness.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.78}
            max={1.34}
            step={0.02}
            value={draftAppearance.chonkiness}
            onChange={(e) => updateField('chonkiness', Number(e.target.value))}
            className="mt-3 w-full accent-orange-600"
          />
        </div>
      </div>

      {/* Quick Color Swatch Tweakers */}
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>主毛色</span>
          <input
            type="color"
            value={draftAppearance.primaryColor}
            onChange={(e) => updateField('primaryColor', e.target.value.toUpperCase())}
            className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>次毛色</span>
          <input
            type="color"
            value={draftAppearance.secondaryColor}
            onChange={(e) => updateField('secondaryColor', e.target.value.toUpperCase())}
            className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>左瞳</span>
          <input
            type="color"
            value={draftAppearance.leftEyeColor}
            onChange={(e) => updateField('leftEyeColor', e.target.value.toUpperCase())}
            className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>右瞳</span>
          <input
            type="color"
            value={draftAppearance.rightEyeColor}
            onChange={(e) => updateField('rightEyeColor', e.target.value.toUpperCase())}
            className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>项圈</span>
          <input
            type="color"
            value={draftAppearance.collarColor}
            onChange={(e) => updateField('collarColor', e.target.value.toUpperCase())}
            className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          />
        </label>
      </div>
    </div>
  );
}
