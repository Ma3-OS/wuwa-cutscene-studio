import React, { useEffect, useState } from "react";
import { SAMPLE_LYRICS } from "../constants";

export type FramingMode = "16/9_letterbox" | "16/9_zoom" | "21/9_native";

interface SubtitleCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  framingMode: FramingMode;
  activeTheme: {
    id: string;
    label: string;
    bg: string;
    image?: string;
    isLight: boolean;
  };
  videoUrl?: string | null;
  isVideoPlaying?: boolean;
  showGuides: boolean;
  zoomMode: "fit" | "actual";
  subFont: string;
  subSize: number;
  subOutline: number;
  subShadow: number;
  subMarginV: number;
  subColor: string;
  previewType: "both" | "dialogue" | "lyric";
  sampleLang: "th" | "en" | "ja" | "zh";
  enableRuby?: boolean;
  rubySize?: number;
  rubyOffsetY?: number;
  rubyColor?: string;
  rubyText: string;
  baseText: string;
  lyricSize?: number;
  lyricMarginX?: number;
  lyricMarginY?: number;
  lyricBilingual?: boolean;
  lyricColor?: string;
}

function renderDialogueWithRuby(
  text: string,
  subFont: string,
  rubySize: number,
  rubyOutline: number,
  subShadow: number,
  rubyOffsetY: number = 0,
  rubyColor: string = "#E0E0E0",
  enableRuby: boolean = true
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
              fontFamily: subFont,
              fontSize: rubySize,
              color: rubyColor,
              lineHeight: 1.0,
              WebkitTextStroke: rubyOutline > 0 ? `${rubyOutline}px rgba(0, 0, 0, 0.85)` : "none",
              paintOrder: "stroke fill",
              textShadow: subShadow > 0 ? `${(subShadow * 0.75).toFixed(2)}px ${(subShadow * 0.75).toFixed(2)}px 2px rgba(0, 0, 0, 0.5)` : "none",
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

export const SubtitleCanvas: React.FC<SubtitleCanvasProps> = ({
  canvasRef,
  framingMode,
  activeTheme,
  videoUrl,
  isVideoPlaying = true,
  showGuides,
  zoomMode,
  subFont,
  subSize,
  subOutline,
  subShadow,
  subMarginV,
  subColor,
  previewType,
  sampleLang,
  enableRuby = true,
  rubySize = 0,
  rubyOffsetY = 0,
  rubyColor = "#E0E0E0",
  rubyText,
  baseText,
  lyricSize = 0,
  lyricMarginX = 160,
  lyricMarginY = 30,
  lyricBilingual = true,
  lyricColor = "#FFFFFF",
}) => {
  const [containerWidth, setContainerWidth] = useState(960);
  const [containerHeight, setContainerHeight] = useState(540);

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

  const isNative219 = framingMode === "21/9_native";
  const stageWidth = isNative219 ? 2560 : 1920;
  const stageHeight = 1080;

  // Fit scale calculation based on stage width and height
  const scale = zoomMode === "actual"
    ? 1.0
    : Math.min(containerWidth / stageWidth, containerHeight / stageHeight);

  const showLyric = previewType === "lyric" || previewType === "both";
  const showDialogue = previewType === "dialogue" || previewType === "both";
  const lyricData = SAMPLE_LYRICS[sampleLang];

  const effectiveRubySize = rubySize > 0 ? rubySize : Math.max(18, Math.round(subSize * 0.52));
  const effectiveLyricThSize = lyricSize > 0 ? lyricSize : Math.max(34, Math.round(subSize * 0.85));
  const effectiveLyricZhSize = Math.max(26, Math.round(effectiveLyricThSize * 0.76));
  const effectiveOutline = subOutline > 0 ? Number((subOutline * 2).toFixed(2)) : 0;
  const rubyOutline = effectiveOutline > 0 ? Number((effectiveOutline * 0.75).toFixed(2)) : 0;

  return (
    <div
      ref={canvasRef}
      className={`w-full relative rounded-2xl overflow-hidden flex items-center justify-center transition-all select-none shadow-2xl bg-black ${
        isNative219 ? "aspect-[21/9]" : "aspect-video"
      }`}
    >
      {/* Virtual 1920x1080 Master Stage: 100% 1:1 Parity with FFmpeg libass */}
      <div
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className={`relative shrink-0 overflow-hidden flex items-center justify-center ${activeTheme.bg}`}
      >
        {/* Background Layer: Real Video vs Theme Backdrop */}
        {videoUrl ? (
          <video
            src={videoUrl}
            autoPlay={isVideoPlaying}
            loop
            muted
            playsInline
            className={`absolute inset-0 w-full h-full ${
              framingMode === "16/9_zoom" ? "object-cover scale-100" : "object-contain"
            }`}
          />
        ) : activeTheme.image ? (
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
              className="absolute top-0 left-0 right-0 bg-black pointer-events-none z-10 border-b border-white/[0.06] flex items-center px-8"
              style={{ height: 138 }}
            >
              <span className="text-[14px] font-mono text-white/30 tracking-widest uppercase">
                21:9 Letterbox Matte Top 138px
              </span>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none z-10 border-t border-white/[0.06] flex items-center px-8"
              style={{ height: 138 }}
            >
              <span className="text-[14px] font-mono text-white/30 tracking-widest uppercase">
                21:9 Letterbox Matte Bottom 138px
              </span>
            </div>
          </>
        )}

        {/* Safe Area Guides: SMPTE 90% Action Safe and 80% Title Safe */}
        {showGuides && (
          <>
            {/* Title Safe: 10% insets */}
            <div className="absolute inset-[10%] border border-dashed border-white/20 pointer-events-none rounded-lg z-15 flex items-start justify-end p-2">
              <span className="text-[12px] font-mono text-white/40">Title Safe 80%</span>
            </div>
            {/* Action Safe: 5% insets */}
            <div className="absolute inset-[5%] border border-dashed border-white/10 pointer-events-none rounded-xl z-15 flex items-start justify-end p-2">
              <span className="text-[12px] font-mono text-white/30">Action Safe 90%</span>
            </div>
            {/* Center Crosshair */}
            <div className="absolute w-6 h-0.5 bg-white/25 pointer-events-none z-15" />
            <div className="absolute h-6 w-0.5 bg-white/25 pointer-events-none z-15" />
          </>
        )}

        {/* Top-Left Authentic Music Lyric */}
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
                fontFamily: subFont,
                fontSize: effectiveLyricThSize,
                fontWeight: 500,
                color: lyricColor,
                WebkitTextStroke: "none",
                textShadow: "none",
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
                  fontSize: effectiveLyricZhSize,
                  fontWeight: 400,
                  color: lyricColor,
                  marginTop: 10,
                  WebkitTextStroke: "none",
                  textShadow: "none",
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
            {enableRuby && rubyText && !baseText.includes("<ano=") && (
              <div
                className="font-medium tracking-wide opacity-90 select-none"
                style={{
                  fontFamily: subFont,
                  fontSize: effectiveRubySize,
                  color: rubyColor,
                  marginBottom: `${8 + rubyOffsetY}px`,
                  WebkitTextStroke: rubyOutline > 0 ? `${rubyOutline}px rgba(0, 0, 0, 0.85)` : "none",
                  paintOrder: "stroke fill",
                  textShadow: subShadow > 0 ? `${(subShadow * 0.75).toFixed(2)}px ${(subShadow * 0.75).toFixed(2)}px 2px rgba(0, 0, 0, 0.5)` : "none",
                  lineHeight: 1.15,
                }}
              >
                {rubyText}
              </div>
            )}
            <div
              style={{
                fontFamily: subFont,
                fontSize: subSize,
                color: subColor,
                WebkitTextStroke: effectiveOutline > 0 ? `${effectiveOutline}px rgba(0, 0, 0, 0.85)` : "none",
                paintOrder: "stroke fill",
                textShadow: subShadow > 0 ? `${subShadow.toFixed(2)}px ${subShadow.toFixed(2)}px 2px rgba(0, 0, 0, 0.5)` : "none",
                letterSpacing: "0.012em",
                lineHeight: 1.25,
                maxWidth: 1480,
                width: "100%",
              }}
              className="font-medium mx-auto break-words text-center px-4"
            >
              {renderDialogueWithRuby(baseText, subFont, effectiveRubySize, rubyOutline, subShadow, rubyOffsetY, rubyColor, enableRuby)}
            </div>
          </div>
        )}

        {/* 1080p Resolution HUD Indicator */}
        <div className="absolute top-4 left-4 text-[13px] font-mono text-white/50 pointer-events-none z-30 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10">
            {stageWidth}x{stageHeight} Native
          </span>
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10">
            {Math.round(scale * 100)}% View Scale
          </span>
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10">
            {subFont} {subSize}pt
          </span>
        </div>
      </div>
    </div>
  );
};
