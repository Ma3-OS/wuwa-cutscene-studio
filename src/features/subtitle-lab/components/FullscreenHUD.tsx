import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, Minimize2 } from "lucide-react";
import type { FramingMode } from "./SubtitleCanvas";

interface FullscreenHUDProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: {
    id: string;
    label: string;
    bg: string;
    image?: string;
    isLight: boolean;
  };
  framingMode: FramingMode;
  showGuides: boolean;
  renderSubtitleText: (isFull: boolean) => React.ReactNode;
  showFullscreenHUD: boolean;
  setShowFullscreenHUD: (val: boolean) => void;
  subSize: number;
  setSubSize: (val: number) => void;
  subOutline: number;
  setSubOutline: (val: number) => void;
  subShadow: number;
  setSubShadow: (val: number) => void;
  subMarginV: number;
  setSubMarginV: (val: number) => void;
  labels: {
    title: string;
    exitFullscreen: string;
    fontSize: string;
    outlineWidth: string;
    shadowDepth: string;
    verticalMargin: string;
  };
}

export const FullscreenHUD: React.FC<FullscreenHUDProps> = ({
  isOpen,
  onClose,
  activeTheme,
  framingMode,
  showGuides,
  renderSubtitleText,
  showFullscreenHUD,
  setShowFullscreenHUD,
  subSize,
  setSubSize,
  subOutline,
  setSubOutline,
  subShadow,
  setSubShadow,
  subMarginV,
  setSubMarginV,
  labels,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center select-none ${activeTheme.bg}`}
      style={
        activeTheme.image
          ? {
              backgroundImage: `url("${activeTheme.image}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Top Fullscreen Controls Bar */}
      <div className="absolute top-6 inset-x-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white tracking-wider uppercase">
            {labels.title} เต็มจอ
          </span>
          <span className="text-xs font-mono text-white/50">
            {window.innerWidth}x{window.innerHeight}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFullscreenHUD(!showFullscreenHUD)}
            className={`h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer outline-none backdrop-blur-xl ${
              showFullscreenHUD ? "bg-white/[0.15] text-white" : "bg-black/60 text-white/70 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>แถบปรับแต่ง</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 bg-black/60 text-white hover:bg-white/[0.15] transition-colors cursor-pointer outline-none backdrop-blur-xl"
            title="ออกจากโหมดเต็มจอ"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{labels.exitFullscreen}</span>
          </button>
        </div>
      </div>

      {/* 21:9 Letterbox Matte Simulation in Fullscreen */}
      {framingMode === "16/9_letterbox" && (
        <>
          <div
            className="absolute top-0 left-0 right-0 bg-black pointer-events-none z-10 border-b border-white/[0.04] flex items-center px-8"
            style={{ height: "12.78%" }}
          >
            <span className="text-[10px] font-mono text-white/20">
              แถบดำบน
            </span>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10 border-t border-white/[0.04] flex items-center px-8"
            style={{ height: "12.78%" }}
          >
            <span className="text-[10px] font-mono text-white/20">
              แถบดำล่าง
            </span>
          </div>
        </>
      )}

      {/* Fullscreen Canvas Safe Guides */}
      {showGuides && (
        <>
          <div className="absolute inset-[5%] border border-dashed border-white/10 pointer-events-none rounded-xl z-15" />
          <div className="absolute inset-[10%] border border-dashed border-white/20 pointer-events-none rounded-lg z-15" />
        </>
      )}

      {/* Subtitle in Fullscreen */}
      {renderSubtitleText(true)}

      {/* Floating In-Place Settings HUD Drawer */}
      <AnimatePresence>
        {showFullscreenHUD && (
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-8 top-20 w-80 max-h-[80vh] overflow-y-auto no-scrollbar bg-black/85 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 shadow-2xl z-40 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-semibold text-white tracking-wider uppercase">
                ปรับแต่งตัวอักษรสด
              </span>
              <button
                type="button"
                onClick={() => setShowFullscreenHUD(false)}
                className="text-white/40 hover:text-white text-xs cursor-pointer"
              >
                ปิด
              </button>
            </div>

            {/* HUD Sliders */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white">
                  <span>{labels.fontSize}</span>
                  <span className="font-mono">{subSize} px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={72}
                  value={subSize}
                  onChange={(e) => setSubSize(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white">
                  <span>{labels.outlineWidth}</span>
                  <span className="font-mono">{subOutline.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.1}
                  value={subOutline}
                  onChange={(e) => setSubOutline(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white">
                  <span>{labels.shadowDepth}</span>
                  <span className="font-mono">{subShadow.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.1}
                  value={subShadow}
                  onChange={(e) => setSubShadow(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white">
                  <span>{labels.verticalMargin}</span>
                  <span className="font-mono">{subMarginV} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={subMarginV}
                  onChange={(e) => setSubMarginV(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Keyboard Hint */}
      <div className="absolute bottom-4 inset-x-0 text-center text-[11px] text-white/40 font-mono pointer-events-none">
        กดปุ่ม Escape เพื่อออกจากโหมดเต็มจอ
      </div>
    </motion.div>,
    document.body
  );
};
