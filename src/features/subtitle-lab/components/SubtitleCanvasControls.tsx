import React from "react";
import { ZoomIn, Grid, Maximize2, Play, Pause, Film } from "lucide-react";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { FramingMode } from "./SubtitleCanvas";
import { SCENE_THEMES } from "../constants";

interface SubtitleCanvasControlsProps {
  framingMode: FramingMode;
  setFramingMode: (val: FramingMode) => void;
  previewType: "both" | "dialogue" | "lyric";
  setPreviewType: (val: "both" | "dialogue" | "lyric") => void;
  zoomMode: "fit" | "actual";
  setZoomMode: (val: "fit" | "actual") => void;
  activeThemeId: string;
  setActiveThemeId: (val: string) => void;
  showGuides: boolean;
  setShowGuides: (val: boolean) => void;
  onOpenFullscreen: () => void;
  fitLabel: string;
  actualLabel: string;
  guidesLabel: string;
  fullscreenLabel: string;
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
  zoomMode,
  setZoomMode,
  activeThemeId,
  setActiveThemeId,
  showGuides,
  setShowGuides,
  onOpenFullscreen,
  fitLabel,
  actualLabel,
  guidesLabel,
  fullscreenLabel,
  hasVideoSource = false,
  isVideoPlaying = true,
  onTogglePlayVideo,
  videoTitle,
}) => {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2.5 bg-[#141417] p-2.5 rounded-2xl border border-white/[0.06]">
      {/* Group 1: Framing and Aspect Ratio Mode */}
      <div className="flex items-center flex-wrap gap-2">
        <StudioSegmentedControl<FramingMode>
          size="sm"
          value={framingMode}
          onChange={setFramingMode}
          options={[
            { value: "16/9_letterbox", label: "16:9 มีแถบดำ" },
            { value: "16/9_zoom", label: "16:9 ซูมเต็มจอ" },
            { value: "21/9_native", label: "21:9 ต้นฉบับ" },
          ]}
        />

        {/* Group 2: Preview Content Layers */}
        <StudioSegmentedControl<"both" | "dialogue" | "lyric">
          size="sm"
          value={previewType}
          onChange={setPreviewType}
          options={[
            { value: "both", label: "แสดงคู่" },
            { value: "dialogue", label: "บทสนทนา" },
            { value: "lyric", label: "เนื้อเพลง" },
          ]}
        />

        {/* Group 3: Real Video Playback Controller */}
        {hasVideoSource && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <Film className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px] font-mono text-neutral-300 max-w-[120px] truncate">
              {videoTitle || "คัตซีนจริง"}
            </span>
            <button
              type="button"
              onClick={onTogglePlayVideo}
              className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/[0.1] text-white transition-colors cursor-pointer outline-none ml-1"
              title={isVideoPlaying ? "พักการเล่น" : "เล่นต่อ"}
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

      {/* Group 4: Scene Backdrop & Tools */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Themes Selector */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl text-xs">
          {SCENE_THEMES.slice(0, 3).map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setActiveThemeId(theme.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer outline-none ${
                activeThemeId === theme.id ? "bg-white/[0.12] text-white" : "text-[#737373] hover:text-white"
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>

        {/* View Scaling Mode */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setZoomMode("fit")}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer outline-none ${
              zoomMode === "fit" ? "bg-white/[0.12] text-white" : "text-[#737373] hover:text-white"
            }`}
          >
            {fitLabel}
          </button>
          <button
            type="button"
            onClick={() => setZoomMode("actual")}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer outline-none ${
              zoomMode === "actual" ? "bg-white/[0.12] text-white" : "text-[#737373] hover:text-white"
            }`}
            title="มาตราส่วน 1 ต่อ 1 ระดับพิกเซล 1080p"
          >
            <ZoomIn className="w-3 h-3" />
            <span>{actualLabel}</span>
          </button>
        </div>

        {/* SMPTE Safe Area Guides Toggle */}
        <button
          type="button"
          onClick={() => setShowGuides(!showGuides)}
          className={`h-7 px-2.5 rounded-xl flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer outline-none ${
            showGuides ? "bg-white/[0.12] text-white" : "bg-white/[0.04] text-[#737373] hover:text-white"
          }`}
          title="เส้นกรอบปลอดภัยสำหรับการส่งออก"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>{guidesLabel}</span>
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={onOpenFullscreen}
          className="h-7 px-2.5 rounded-xl flex items-center gap-1 text-[11px] font-medium bg-white/[0.04] text-[#737373] hover:text-white transition-colors cursor-pointer outline-none"
          title="แสดงพรีวิวแบบเต็มหน้าจอ"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>{fullscreenLabel}</span>
        </button>
      </div>
    </div>
  );
};
