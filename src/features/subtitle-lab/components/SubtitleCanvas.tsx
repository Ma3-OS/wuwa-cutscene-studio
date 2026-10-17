import React, { useEffect, useRef, useState } from "react";
import { SubtitleStage } from "./SubtitleStage";

export type FramingMode = "16/9_letterbox" | "16/9_zoom" | "21/9_native";

export interface SubtitleCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  framingMode: FramingMode;
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
  showGuides: boolean;
  subFont: string;
  subSize: number;
  subOutline: number;
  subShadow: number;
  subMarginV: number;
  subColor: string;
  previewType: "both" | "dialogue" | "lyric";
  sampleLang: "th" | "en" | "ja" | "zh";

  // Ruby custom parameters
  enableRuby?: boolean;
  rubyFont?: string;
  rubySize?: number;
  rubyOutline?: number;
  rubyShadow?: number;
  rubyOffsetY?: number;
  rubyColor?: string;
  rubyText: string;
  baseText: string;

  // Lyric custom parameters
  lyricFont?: string;
  lyricSize?: number;
  lyricOutline?: number;
  lyricShadow?: number;
  lyricMarginX?: number;
  lyricMarginY?: number;
  lyricBilingual?: boolean;
  lyricColor?: string;
}

export const SubtitleCanvas: React.FC<SubtitleCanvasProps> = ({
  canvasRef,
  framingMode,
  activeThemeId,
  activeTheme,
  videoUrl,
  isVideoPlaying = true,
  showGuides,
  subFont,
  subSize,
  subOutline,
  subShadow,
  subMarginV,
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
}) => {
  const [containerWidth, setContainerWidth] = useState(960);
  const [containerHeight, setContainerHeight] = useState(540);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ResizeObserver for responsive stage fitting
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setContainerWidth(canvasRef.current.clientWidth);
        setContainerHeight(canvasRef.current.clientHeight);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (canvasRef.current) {
      ro.observe(canvasRef.current);
    }
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [canvasRef]);

  // Video play / pause synchronization
  useEffect(() => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVideoPlaying]);

  const isNative219 = framingMode === "21/9_native";
  const stageWidth = isNative219 ? 2560 : 1920;
  const stageHeight = 1080;

  // Responsive Fit Scale
  const scale = Math.min(containerWidth / stageWidth, containerHeight / stageHeight);

  return (
    <div
      ref={canvasRef}
      className={`w-full relative rounded-2xl overflow-hidden flex items-center justify-center select-none shadow-2xl bg-black ${
        isNative219 ? "aspect-[21/9]" : "aspect-video"
      }`}
    >
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
    </div>
  );
};
