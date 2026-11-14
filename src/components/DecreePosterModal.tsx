import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { pickQuoteForEmotion } from '../engine/quoteCache';
import { renderImperialDecreePoster } from '../engine/shareCardExporter';
import { type CatProfile, type SassyQuote } from '../schemas/cat';

interface DecreePosterModalProps {
  open: boolean;
  cat: CatProfile;
  initialQuote: SassyQuote;
  captureSnapshot: () => string | null;
  onClose: () => void;
}

export function DecreePosterModal({
  open,
  cat,
  initialQuote,
  captureSnapshot,
  onClose,
}: DecreePosterModalProps) {
  const [quote, setQuote] = useState<SassyQuote>(initialQuote);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const buildPoster = async (q: SassyQuote) => {
    setIsRendering(true);
    try {
      const snap = captureSnapshot();
      if (!snap) return;
      const url = await renderImperialDecreePoster({
        snapshotDataUrl: snap,
        cat,
        quote: q,
      });
      setPosterUrl(url);
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuote(initialQuote);
      void buildPoster(initialQuote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cat.id]);

  if (!open) return null;

  const handleRerollQuote = () => {
    const emotions = [
      'demanding',
      'annoyed',
      'affectionate',
      'hungry',
      'sleepy',
      'philosophical',
    ] as const;
    const nextEmo = emotions[Math.floor(Math.random() * emotions.length)];
    const nextQ = pickQuoteForEmotion(nextEmo, quote.id);
    setQuote(nextQ);
    void buildPoster(nextQ);
  };

  const handleDownload = () => {
    if (!posterUrl) return;
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `PocketMeow-${cat.name}-今日圣旨.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              主子今日圣旨卡
            </h3>
            <p className="text-xs text-slate-500">
              实时 3D 造型 · {cat.appearance.rarity} 级御猫 · 1080×1440 高清海报
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="pocket-scroll flex-1 overflow-y-auto bg-slate-100 p-4">
          {isRendering || !posterUrl ? (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-white text-sm text-slate-500">
              正在合成 3D 圣旨海报…
            </div>
          ) : (
            <img
              src={posterUrl}
              alt="PocketMeow 今日圣旨海报"
              referrerPolicy="no-referrer"
              className="mx-auto w-full rounded-xl border border-slate-200 shadow-sm"
            />
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            disabled={isRendering}
            onClick={handleRerollQuote}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>换一条圣旨</span>
          </button>
          <button
            type="button"
            disabled={!posterUrl || isRendering}
            onClick={handleDownload}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>保存 PNG 海报</span>
          </button>
        </div>
      </div>
    </div>
  );
}
