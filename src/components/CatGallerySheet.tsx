import { Trash2 } from 'lucide-react';
import { type CatProfile } from '../schemas/cat';

interface CatGallerySheetProps {
  cats: CatProfile[];
  activeCatId: string;
  onSelectCat: (cat: CatProfile) => void;
  onDeleteCat: (id: string) => void;
  onClose: () => void;
}

export function CatGallerySheet({
  cats,
  activeCatId,
  onSelectCat,
  onDeleteCat,
  onClose,
}: CatGallerySheetProps) {
  return (
    <div className="pocket-scroll max-h-[58vh] overflow-y-auto px-5 pb-5 pt-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            御猫档案馆
          </h2>
          <p className="text-xs text-slate-500">
            点击切换预设名猫或你通过照片换肤复刻的专属主子
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

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((cat) => {
          const isActive = cat.id === activeCatId;
          const isPreset = cat.id.startsWith('preset-');
          return (
            <div
              key={cat.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                isActive
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCat(cat)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {cat.thumbnailDataUrl ? (
                    <img
                      src={cat.thumbnailDataUrl}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full">
                      <div
                        className="h-full w-1/2"
                        style={{ backgroundColor: cat.appearance.primaryColor }}
                      />
                      <div
                        className="h-full w-1/2"
                        style={{ backgroundColor: cat.appearance.secondaryColor }}
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {cat.name}
                    </span>
                    <span className="text-xs font-medium text-orange-700 font-mono-tabular">
                      {cat.appearance.rarity}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {cat.appearance.breedLabel}
                  </p>
                </div>
              </button>

              {!isPreset && (
                <button
                  type="button"
                  aria-label={`删除 ${cat.name}`}
                  onClick={() => onDeleteCat(cat.id)}
                  className="flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
