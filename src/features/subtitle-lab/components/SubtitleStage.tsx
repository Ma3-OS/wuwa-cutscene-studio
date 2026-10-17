import React from "react";
import { SAMPLE_LYRICS } from "../constants";
import type { FramingMode } from "./SubtitleCanvas";

export interface SubtitleStageProps {
  framingMode: FramingMode;
  themeId: string;
  activeTheme: {
    id: string;
    label?: string;
    labelKey?: string;
    bg: string;
    image?: string;
    isLight: boolean;
  };
  videoUrl?: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  showGuides: boolean;
  scale: number;
  stageWidth: number;
  stageHeight: number;

  // Dialogue properties
  subFont: string;
  subSize: number;
  subOutline: number;
  subShadow: number;
  subMarginV: number;
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
}

export function renderDialogueSegments(
  text: string,
  subFont: string,
  rubyFont: string,
  rubySize: number,
  rubyOutline: number,
  rubyShadow: number,
  rubyOffsetY: number,
  rubyColor: string,
  enableRuby: boolean
): React.ReactNode {
  if (!text.includes("<ano=")) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /<ano=([^>]+)>([^<]+)<\/ano>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const ruby = match[1].trim();
    const base = match[2];

    if (!enableRuby) {
      parts.push(<span key={match.index}>{base}</span>);
    } else {
      parts.push(
        <span key={match.index} className="inline-flex flex-col items-center relative align-baseline">
          <span
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none select-none font-medium tracking-normal"
            style={{
              bottom: `calc(100% + ${8 + rubyOffsetY}px)`,
              fontFamily: rubyFont || subFont,
              fontSize: `${rubySize}px`,
              color: rubyColor,
              lineHeight: 1.0,
              WebkitTextStroke: rubyOutline > 0 ? `${rubyOutline}px rgba(0, 0, 0, 0.85)` : "none",
              paintOrder: "stroke fill",
              textShadow: rubyShadow > 0 ? `${rubyShadow}px ${rubyShadow}px 2px rgba(0, 0, 0, 0.5)` : "none",
            }}
          >
            {ruby}
          </span>
          <span>{base}</span>
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const SubtitleStage: React.FC<SubtitleStageProps> = ({
  framingMode,
  themeId,
  activeTheme,
  videoUrl,
  videoRef,
  showGuides,
  scale,
  stageWidth,
  stageHeight,
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
  const showLyric = previewType === "lyric" || previewType === "both";
  const showDialogue = previewType === "dialogue" || previewType === "both";
  const lyricData = SAMPLE_LYRICS[sampleLang];

  const effRubyFont = rubyFont || subFont;
  const effRubySize = rubySize > 0 ? rubySize : Math.max(18, Math.round(subSize * 0.52));
  const effLyricFont = lyricFont || subFont;
  const effLyricThSize = lyricSize > 0 ? lyricSize : Math.max(34, Math.round(subSize * 0.85));
  const effLyricZhSize = Math.max(26, Math.round(effLyricThSize * 0.76));

  const isVideoSourceActive = themeId === "cutscene_video" && Boolean(videoUrl);

  return (
    <div
      style={{
        width: stageWidth,
        height: stageHeight,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
      className={`relative shrink-0 overflow-hidden flex items-center justify-center ${activeTheme.bg}`}
    >
      {/* Background Layer */}
      {isVideoSourceActive ? (
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full ${
            framingMode === "16/9_zoom" ? "object-cover scale-100" : "object-contain"
          }`}
        />
      ) : themeId === "cutscene" && activeTheme.image ? (
        <div
          className={`absolute inset-0 w-full h-full ${
            framingMode === "16/9_zoom" ? "bg-cover" : "bg-contain"
          } bg-center bg-no-repeat`}
          style={{ backgroundImage: `url("${activeTheme.image}")` }}
        />
      ) : null}

      {/* 16:9 Letterbox Black Matte Simulation: Top and Bottom 138px bars */}
      {framingMode === "16/9_letterbox" && (
        <>
          <div
            className="absolute top-0 left-0 right-0 bg-black pointer-events-none z-10 border-b border-white/[0.06]"
            style={{ height: 138 }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10 border-t border-white/[0.06]"
            style={{ height: 138 }}
          />
        </>
      )}

      {/* Safe Area Guides: SMPTE 90% Action Safe and 80% Title Safe */}
      {showGuides && (
        <>
          <div className="absolute inset-[10%] border border-dashed border-white/20 pointer-events-none rounded-lg z-15" />
          <div className="absolute inset-[5%] border border-dashed border-white/10 pointer-events-none rounded-xl z-15" />
          <div className="absolute w-6 h-0.5 bg-white/25 pointer-events-none z-15" />
          <div className="absolute h-6 w-0.5 bg-white/25 pointer-events-none z-15" />
        </>
      )}

      {/* Top Music Lyrics */}
      {showLyric && (
        <div
          className="absolute pointer-events-none select-none z-20"
          style={{
            top: lyricMarginY,
            left: lyricMarginX,
            maxWidth: 1400,
          }}
        >
          <div
            className="italic tracking-wide"
            style={{
              fontFamily: effLyricFont,
              fontSize: `${effLyricThSize}px`,
              fontWeight: 500,
              color: lyricColor,
              WebkitTextStroke: lyricOutline > 0 ? `${lyricOutline}px rgba(0, 0, 0, 0.85)` : "none",
              paintOrder: "stroke fill",
              textShadow: lyricShadow > 0 ? `${lyricShadow}px ${lyricShadow}px 2px rgba(0, 0, 0, 0.5)` : "none",
              lineHeight: 1.15,
            }}
          >
            {lyricData.line1}
          </div>
          {lyricBilingual && (
            <div
              className="italic tracking-normal"
              style={{
                fontFamily: "Microsoft YaHei, sans-serif",
                fontSize: `${effLyricZhSize}px`,
                fontWeight: 400,
                color: lyricColor,
                marginTop: 10,
                WebkitTextStroke: lyricOutline > 0 ? `${lyricOutline * 0.8}px rgba(0, 0, 0, 0.85)` : "none",
                paintOrder: "stroke fill",
                textShadow: lyricShadow > 0 ? `${lyricShadow}px ${lyricShadow}px 2px rgba(0, 0, 0, 0.5)` : "none",
                lineHeight: 1.15,
              }}
            >
              {lyricData.line2}
            </div>
          )}
        </div>
      )}

      {/* Bottom Dialogue Subtitle: Locked Baseline Anchoring */}
      {showDialogue && (
        <div
          className="absolute left-0 right-0 text-center transition-all pointer-events-none select-none z-20 flex flex-col items-center justify-end"
          style={{
            bottom: subMarginV,
          }}
        >
          {/* Standalone ruby header only if explicit rubyText exists and baseText does NOT contain ano tag */}
          {enableRuby && rubyText && rubyText.trim() !== "" && !baseText.includes("<ano=") && (
            <div
              className="font-medium tracking-wide opacity-90 select-none"
              style={{
                fontFamily: effRubyFont,
                fontSize: `${effRubySize}px`,
                color: rubyColor,
                marginBottom: `${8 + rubyOffsetY}px`,
                WebkitTextStroke: rubyOutline > 0 ? `${rubyOutline}px rgba(0, 0, 0, 0.85)` : "none",
                paintOrder: "stroke fill",
                textShadow: rubyShadow > 0 ? `${rubyShadow}px ${rubyShadow}px 2px rgba(0, 0, 0, 0.5)` : "none",
                lineHeight: 1.15,
              }}
            >
              {rubyText}
            </div>
          )}
          <div
            style={{
              fontFamily: subFont,
              fontSize: `${subSize}px`,
              color: subColor,
              WebkitTextStroke: subOutline > 0 ? `${subOutline * 1.5}px rgba(0, 0, 0, 0.9)` : "none",
              paintOrder: "stroke fill",
              textShadow: subShadow > 0 ? `${subShadow}px ${subShadow}px 2px rgba(0, 0, 0, 0.5)` : "none",
              letterSpacing: "0.012em",
              lineHeight: 1.25,
              maxWidth: 1480,
              width: "100%",
            }}
            className="font-medium mx-auto break-words text-center px-4"
          >
            {renderDialogueSegments(
              baseText,
              subFont,
              effRubyFont,
              effRubySize,
              rubyOutline,
              rubyShadow,
              rubyOffsetY,
              rubyColor,
              enableRuby
            )}
          </div>
        </div>
      )}
    </div>
  );
};
