import React from 'react';
import { Download, X } from 'lucide-react';

interface PosterModalProps {
  posterDataUrl: string | null;
  catName: string;
  onClose: () => void;
}

export const PosterModal: React.FC<PosterModalProps> = ({ posterDataUrl, catName, onClose }) => {
  if (!posterDataUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = posterDataUrl;
    link.download = `PocketMeow_${catName}_${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="主子今日圣旨收藏海报"
    >
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">主子圣旨收藏卡已生成</h3>
            <p className="text-xs text-slate-500">1080×1520 高清 PNG · 含毛色色卡与今日猫语</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-slate-100 overflow-y-auto flex items-center justify-center">
          <img
            src={posterDataUrl}
            alt={`${catName} 圣旨海报`}
            referrerPolicy="no-referrer"
            className="w-full max-w-[320px] rounded-xl border border-slate-200 shadow-sm object-contain"
          />
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            返回工作台
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[44px] flex-1 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>保存 PNG 海报</span>
          </button>
        </div>
      </div>
    </div>
  );
};
