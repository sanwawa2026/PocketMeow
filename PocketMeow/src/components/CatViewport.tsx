import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { CatStageController, mountCatStage } from '../core/catRig';
import { CatEmotionState, CatProfile } from '../schemas/catSchema';

export interface CatViewportHandle {
  captureSnapshotDataUrl: () => string | null;
  resetCamera: () => void;
  triggerHeadPat: () => void;
}

interface CatViewportProps {
  profile: CatProfile;
  emotion: CatEmotionState;
  onEmotionChange: (emotion: CatEmotionState) => void;
  onPet: () => void;
  speechTitle?: string;
  speechText?: string;
}

const EMOTION_ACTIONS: Array<{ id: CatEmotionState; label: string }> = [
  { id: 'idle', label: '待机' },
  { id: 'happy', label: '踩奶' },
  { id: 'proud', label: '傲娇' },
  { id: 'listening', label: '倾听' },
  { id: 'sleepy', label: '打盹' },
  { id: 'angry', label: '炸毛' },
  { id: 'hungry', label: '讨饭' },
];

export const CatViewport = React.forwardRef<CatViewportHandle, CatViewportProps>(
  ({ profile, emotion, onEmotionChange, onPet, speechTitle, speechText }, ref) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const controllerRef = useRef<CatStageController | null>(null);
    const onPetRef = useRef(onPet);
    onPetRef.current = onPet;

    const [laserMode, setLaserMode] = useState(false);
    const [dockCollapsed, setDockCollapsed] = useState(false);
    const [webglLost, setWebglLost] = useState(false);

    useImperativeHandle(ref, () => ({
      captureSnapshotDataUrl: () => controllerRef.current?.captureSnapshotDataUrl() ?? null,
      resetCamera: () => controllerRef.current?.resetCamera(),
      triggerHeadPat: () => controllerRef.current?.triggerHeadPat(),
    }));

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      let ctrl: CatStageController | null = null;
      try {
        ctrl = mountCatStage(el, profile, () => onPetRef.current());
        controllerRef.current = ctrl;
      } catch {
        setWebglLost(true);
        return;
      }

      const canvas = el.querySelector('canvas');
      const handleLost = (e: Event) => {
        e.preventDefault();
        setWebglLost(true);
      };
      const handleRestored = () => {
        setWebglLost(false);
      };
      canvas?.addEventListener('webglcontextlost', handleLost);
      canvas?.addEventListener('webglcontextrestored', handleRestored);

      return () => {
        canvas?.removeEventListener('webglcontextlost', handleLost);
        canvas?.removeEventListener('webglcontextrestored', handleRestored);
        ctrl?.dispose();
        controllerRef.current = null;
      };
      // Mount WebGL once cleanly; profile and emotion updates flow imperatively via refs
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      controllerRef.current?.applyProfile(profile);
    }, [profile]);

    useEffect(() => {
      controllerRef.current?.setEmotion(emotion);
    }, [emotion]);

    useEffect(() => {
      controllerRef.current?.setLaserEnabled(laserMode);
    }, [laserMode]);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (
          e.key.toLowerCase() === 'h' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          setDockCollapsed((prev) => !prev);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!laserMode || !mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      controllerRef.current?.setLaserTargetNdc(ndcX, ndcY);
    };

    return (
      <div
        className="relative w-full h-full min-h-[340px] lg:min-h-[600px] bg-[#E8ECF2] rounded-2xl overflow-hidden border border-slate-200"
        onPointerMove={handlePointerMove}
      >
        {/* Dedicated empty mount node isolated from React HUD */}
        <div
          ref={mountRef}
          className={`w-full h-full ${laserMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          aria-label="3D 口袋主子互动舞台"
        />

        {webglLost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#E8ECF2] p-6 text-center z-20">
            <p className="text-base font-semibold text-slate-800">3D 渲染上下文已重置</p>
            <p className="text-sm text-slate-600 mt-1">当前浏览器环境暂不支持 WebGL 或显存受限</p>
          </div>
        )}

        {/* Top-Left Minimal Spec Header (No Pills, No Pulsing Dots) */}
        <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-4 z-10">
          <div className="bg-white/95 border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-sm max-w-[72%]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 truncate">
              <span>{profile.name}</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-mono-tabular text-xs font-semibold text-amber-700">{profile.rarity}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
              <span>{profile.breed}</span>
              <span aria-hidden="true">·</span>
              <span>{profile.personalityTag}</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLaserMode((v) => !v)}
              title="切换逗猫红点"
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                laserMode
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{laserMode ? '红点追踪中' : '逗猫光点'}</span>
            </button>
            <button
              type="button"
              onClick={() => controllerRef.current?.resetCamera()}
              title="重置视角"
              aria-label="重置视角"
              className="min-h-[44px] min-w-[44px] bg-white/95 text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Non-blocking Speech Toast at Upper-Right / Below Top Spec */}
        {speechText && !dockCollapsed && (
          <div className="pointer-events-none absolute top-22 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-xs z-10">
            <div className="bg-white/95 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              {speechTitle && (
                <div className="text-xs font-semibold text-amber-700 mb-1">{speechTitle}</div>
              )}
              <p className="text-sm text-slate-800 leading-relaxed">{speechText}</p>
            </div>
          </div>
        )}

        {/* Collapsible Bottom Emotion Dock (No backdrop-filter over WebGL) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-xl z-10 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="mb-1.5 px-3 py-1 bg-white/95 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? '展开动作台 (H)' : '收起 HUD 纯享视角 (H)'}</span>
          </button>

          {!dockCollapsed && (
            <div className="w-full bg-white/95 border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto">
              <div className="flex items-center justify-between gap-1 min-w-max">
                {EMOTION_ACTIONS.map((item) => {
                  const active = emotion === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onEmotionChange(item.id)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

CatViewport.displayName = 'CatViewport';
