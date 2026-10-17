import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, Minimize2 } from "lucide-react";
import type { FramingMode } from "./SubtitleCanvas";
import { SubtitleStage } from "./SubtitleStage";
import { useApp } from "@/context/AppContext";

interface FullscreenHUDProps {
  isOpen: boolean;
  onClose: () => void;
  activeThemeId: string;
  activeTheme: {
    id: string;
    label?: string;
    labelKey?: string;
    bg: string;
    image?: string;
    isLight: boolean;
  };
  videoUrl?: string | null;
  isVideoPlaying?: boolean;
  framingMode: FramingMode;
  showGuides: boolean;
  showFullscreenHUD: boolean;
  setShowFullscreenHUD: (val: boolean) => void;

  // Dialogue properties
  subFont: string;
  subSize: number;
  setSubSize: (val: number) => void;
  subOutline: number;
  setSubOutline: (val: number) => void;
  subShadow: number;
  setSubShadow: (val: number) => void;
  subMarginV: number;
  setSubMarginV: (val: number) => void;
  subColor: string;
  previewType: "both" | "dialogue" | "lyric";
  sampleLang: "th" | "en" | "ja" | "zh";

  // Ruby properties
  enableRuby?: boolean;
  rubyFont?: string;
  rubySize?: number;
  rubyOutline?: number;
  rubyShadow?: number;
  rubyOffsetY?: number;
  rubyColor?: string;
  rubyText?: string;
  baseText: string;

  // Lyric properties
  lyricFont?: string;
  lyricSize?: number;
  lyricOutline?: number;
  lyricShadow?: number;
  lyricMarginX?: number;
  lyricMarginY?: number;
  lyricBilingual?: boolean;
  lyricColor?: string;

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
  activeThemeId,
  activeTheme,
  videoUrl,
  isVideoPlaying = true,
  framingMode,
  showGuides,
  showFullscreenHUD,
  setShowFullscreenHUD,
  subFont,
  subSize,
  setSubSize,
  subOutline,
  setSubOutline,
  subShadow,
  setSubShadow,
  subMarginV,
  setSubMarginV,
  subColor,
  previewType,
  sampleLang,
  enableRuby = true,
  rubyFont,
  rubySize = 0,
  rubyOutline = 1.0,
  rubyShadow = 0.6,
  rubyOffsetY = 0,
  rubyColor = "#E0E0E0",
  rubyText,
  baseText,
  lyricFont,
  lyricSize = 0,
  lyricOutline = 1.0,
  lyricShadow = 0.6,
  lyricMarginX = 160,
  lyricMarginY = 30,
  lyricBilingual = true,
  lyricColor = "#FFFFFF",
  labels,
}) => {
  const { t } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync video play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVideoPlaying]);

  if (!isOpen) return null;

  const isNative219 = framingMode === "21/9_native";
  const stageWidth = isNative219 ? 2560 : 1920;
  const stageHeight = 1080;
  const scale = Math.min(window.innerWidth / stageWidth, window.innerHeight / stageHeight);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center select-none bg-black overflow-hidden"
    >
      {/* Top Fullscreen Controls Bar */}
      <div className="absolute top-6 inset-x-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white tracking-wider uppercase">
            {labels.title} {t("subFullscreenBtn")}
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
            <span>{t("subLiveInspectHUD")}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 bg-black/60 text-white hover:bg-white/[0.15] transition-colors cursor-pointer outline-none backdrop-blur-xl"
            title={labels.exitFullscreen}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{labels.exitFullscreen}</span>
          </button>
        </div>
      </div>

      {/* Main Unified Virtual Stage */}
      <SubtitleStage
        framingMode={framingMode}
        themeId={activeThemeId}
        activeTheme={activeTheme}
        videoUrl={videoUrl}
        videoRef={videoRef}
        showGuides={showGuides}
        scale={scale}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
        subFont={subFont}
        subSize={subSize}
        subOutline={subOutline}
        subShadow={subShadow}
        subMarginV={subMarginV}
        subColor={subColor}
        previewType={previewType}
        sampleLang={sampleLang}
        enableRuby={enableRuby}
        rubyFont={rubyFont}
        rubySize={rubySize}
        rubyOutline={rubyOutline}
        rubyShadow={rubyShadow}
        rubyOffsetY={rubyOffsetY}
        rubyColor={rubyColor}
        rubyText={rubyText}
        baseText={baseText}
        lyricFont={lyricFont}
        lyricSize={lyricSize}
        lyricOutline={lyricOutline}
        lyricShadow={lyricShadow}
        lyricMarginX={lyricMarginX}
        lyricMarginY={lyricMarginY}
        lyricBilingual={lyricBilingual}
        lyricColor={lyricColor}
      />

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
                {t("subLiveInspectHUD")}
              </span>
              <button
                type="button"
                onClick={() => setShowFullscreenHUD(false)}
                className="text-white/40 hover:text-white text-xs cursor-pointer"
              >
                {t("btnCancel")}
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
        {t("subEscapeExitHUD")}
      </div>
    </motion.div>,
    document.body
  );
};
