import React from "react";
import { Grid, Maximize2, Play, Pause, Film } from "lucide-react";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import type { FramingMode } from "./SubtitleCanvas";
import { SCENE_THEMES } from "../constants";
import { useApp } from "@/context/AppContext";

interface SubtitleCanvasControlsProps {
  framingMode: FramingMode;
  setFramingMode: (val: FramingMode) => void;
  previewType: "both" | "dialogue" | "lyric";
  setPreviewType: (val: "both" | "dialogue" | "lyric") => void;
  activeThemeId: string;
  setActiveThemeId: (val: string) => void;
  showGuides: boolean;
  setShowGuides: (val: boolean) => void;
  onOpenFullscreen: () => void;
  hasVideoSource?: boolean;
  isVideoPlaying?: boolean;
  onTogglePlayVideo?: () => void;
  videoTitle?: string;
}

export const SubtitleCanvasControls: React.FC<SubtitleCanvasControlsProps> = ({
  framingMode,
  setFramingMode,
  previewType,
  setPreviewType,
  activeThemeId,
  setActiveThemeId,
  showGuides,
  setShowGuides,
  onOpenFullscreen,
  hasVideoSource = false,
  isVideoPlaying = true,
  onTogglePlayVideo,
  videoTitle,
}) => {
  const { t } = useApp();

  // Primary backdrop themes
  const availableThemes = SCENE_THEMES.filter((theme) => {
    if (theme.id === "cutscene_video" && !hasVideoSource) return false;
    return ["cutscene_video", "cutscene", "dark", "space"].includes(theme.id);
  });

  return (
    <div className="flex items-center justify-between flex-wrap gap-2.5 bg-[#141417] px-3.5 py-2.5 border-t border-white/[0.06] shrink-0">
      {/* Group 1: Scene Backdrop & Playback */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl text-xs border border-white/[0.04]">
          {availableThemes.map((theme) => {
            const isSelected = activeThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setActiveThemeId(theme.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer outline-none flex items-center gap-1.5 ${
                  isSelected ? "bg-white/[0.12] text-white" : "text-[#737373] hover:text-white"
                }`}
              >
                {theme.id === "cutscene_video" && <Film className="w-3 h-3 text-neutral-400" />}
                <span>{t(theme.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Video Play/Pause Controller if Video Backdrop is active */}
        {hasVideoSource && activeThemeId === "cutscene_video" && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[11px] font-mono text-neutral-300 max-w-[110px] truncate" title={videoTitle}>
              {videoTitle || t("subRealCutscene")}
            </span>
            <button
              type="button"
              onClick={onTogglePlayVideo}
              className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/[0.1] text-white transition-colors cursor-pointer outline-none ml-0.5"
              title={isVideoPlaying ? t("subPauseVideo") : t("subResumeVideo")}
            >
              {isVideoPlaying ? (
                <Pause className="w-3 h-3 fill-white" />
              ) : (
                <Play className="w-3 h-3 fill-white" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Group 2: Preview Content Layers */}
      <div className="flex items-center gap-2">
        <StudioSegmentedControl<"both" | "dialogue" | "lyric">
          size="sm"
          value={previewType}
          onChange={setPreviewType}
          options={[
            { value: "both", label: t("subModeBoth") },
            { value: "dialogue", label: t("subModeDialogueOnly") },
            { value: "lyric", label: t("subModeLyricOnly") },
          ]}
        />
      </div>

      {/* Group 3: Aspect Ratio & Canvas Tools */}
      <div className="flex items-center gap-2">
        <StudioSegmentedControl<FramingMode>
          size="sm"
          value={framingMode}
          onChange={setFramingMode}
          options={[
            { value: "16/9_letterbox", label: t("subAspectLetterbox") },
            { value: "16/9_zoom", label: t("subAspectZoom") },
            { value: "21/9_native", label: t("subAspectNative") },
          ]}
        />

        {/* Safe Area Guides Toggle */}
        <button
          type="button"
          onClick={() => setShowGuides(!showGuides)}
          className={`h-7 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer outline-none ${
            showGuides ? "bg-white/[0.12] text-white" : "bg-white/[0.04] text-[#737373] hover:text-white"
          }`}
          title={t("subSafeMarginDesc")}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("subSafeMargin")}</span>
        </button>

        {/* Fullscreen Trigger */}
        <button
          type="button"
          onClick={onOpenFullscreen}
          className="h-7 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px] font-medium bg-white/[0.04] text-[#737373] hover:text-white transition-colors cursor-pointer outline-none"
          title={t("subFullscreenDesc")}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("subFullscreenBtn")}</span>
        </button>
      </div>
    </div>
  );
};
