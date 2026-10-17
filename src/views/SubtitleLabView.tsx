import React, { useState, useEffect, useRef, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useApp } from "@/context/AppContext";
import { useCatalogStore } from "@/features/catalog/stores/useCatalogStore";
import { toast } from "sonner";
import {
  PRESETS,
  SCENE_THEMES,
  SAMPLE_TEXTS,
  SAMPLE_LYRICS,
  StylePreset,
} from "@/features/subtitle-lab/constants";
import { SubtitleHeader } from "@/features/subtitle-lab/components/SubtitleHeader";
import { SubtitleCanvasControls } from "@/features/subtitle-lab/components/SubtitleCanvasControls";
import { SubtitleCanvas, FramingMode } from "@/features/subtitle-lab/components/SubtitleCanvas";
import { SampleDialogueCard } from "@/features/subtitle-lab/components/SampleDialogueCard";
import { TypographyParametersPanel } from "@/features/subtitle-lab/components/TypographyParametersPanel";
import { FullscreenHUD } from "@/features/subtitle-lab/components/FullscreenHUD";

export const SubtitleLabView: React.FC = () => {
  const { config, updateConfig, t, playSound } = useApp();
  const catalogItems = useCatalogStore((state) => state.items);

  // Framing and display states
  const [framingMode, setFramingMode] = useState<FramingMode>("16/9_letterbox");
  const [showGuides, setShowGuides] = useState(true);
  const [previewType, setPreviewType] = useState<"both" | "dialogue" | "lyric">("both");
  const [zoomMode, setZoomMode] = useState<"fit" | "actual">("fit");
  const [activeThemeId, setActiveThemeId] = useState("cutscene");
  const [sampleLang, setSampleLang] = useState<"th" | "en" | "ja" | "zh">(
    (config.subtitle_lang as "th" | "en" | "ja" | "zh") || "th"
  );
  const [rubyText, setRubyText] = useState(SAMPLE_TEXTS[sampleLang].ruby);
  const [baseText, setBaseText] = useState(SAMPLE_TEXTS[sampleLang].base);

  // Live video cutscene background
  const cachedVideos = useMemo(
    () => catalogItems.filter((it) => it.isCached && it.fullPath),
    [catalogItems]
  );
  const activeVideo = cachedVideos[0] || null;
  const videoUrl = activeVideo?.fullPath
    ? convertFileSrc(activeVideo.fullPath.replace(/\\/g, "/"))
    : null;
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // Fullscreen states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenHUD, setShowFullscreenHUD] = useState(false);

  // Subtitle custom parameters
  const [subFont, setSubFont] = useState(config.sub_font || "Kanit Medium");
  const [subSize, setSubSize] = useState(config.sub_size || 54);
  const [subOutline, setSubOutline] = useState(config.sub_outline ?? 1.2);
  const [subShadow, setSubShadow] = useState(config.sub_shadow ?? 0.0);
  const [subMarginV, setSubMarginV] = useState(config.sub_margin_v ?? 54);
  const [subColor, setSubColor] = useState(config.sub_color || "#FFFFFF");

  // Ruby custom parameters
  const [rubyEnabledState, setRubyEnabledState] = useState(config.ruby_enabled ?? true);
  const [rubySize, setRubySize] = useState(config.ruby_size || 0);
  const [rubyOffsetY, setRubyOffsetY] = useState(config.ruby_offset_y || 0);
  const [rubyColor, setRubyColor] = useState(config.ruby_color || "#E0E0E0");

  // Lyric custom parameters
  const [lyricSize, setLyricSize] = useState(config.lyric_size || 0);
  const [lyricMarginX, setLyricMarginX] = useState(config.lyric_margin_x || 160);
  const [lyricMarginY, setLyricMarginY] = useState(config.lyric_margin_y || 30);
  const [lyricBilingual, setLyricBilingual] = useState(config.lyric_bilingual ?? true);
  const [lyricColor, setLyricColor] = useState(config.lyric_color || "#FFFFFF");

  // Save status indicator
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const activeTheme = SCENE_THEMES.find((theme) => theme.id === activeThemeId) || SCENE_THEMES[0];

  // Escape key listener for fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Handle switching sample language
  const handleLanguageSwitch = (lang: "th" | "en" | "ja" | "zh") => {
    setSampleLang(lang);
    setRubyText(SAMPLE_TEXTS[lang].ruby);
    setBaseText(SAMPLE_TEXTS[lang].base);
  };

  // Apply style preset
  const handleApplyPreset = (preset: StylePreset) => {
    playSound("click");
    setSubFont(preset.font);
    setSubSize(preset.size);
    setSubOutline(preset.outline);
    setSubShadow(preset.shadow);
    setSubMarginV(preset.marginV);
    setSubColor(preset.color);
    toast.success(`${t("presetStyles")}: ${preset.label}`);
  };

  // Reactive Auto-Save Debounce
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await updateConfig({
          sub_font: subFont,
          sub_size: subSize,
          sub_outline: subOutline,
          sub_shadow: subShadow,
          sub_margin_v: subMarginV,
          sub_color: subColor,
          ruby_enabled: rubyEnabledState,
          ruby_size: rubySize,
          ruby_offset_y: rubyOffsetY,
          ruby_color: rubyColor,
          lyric_size: lyricSize,
          lyric_margin_x: lyricMarginX,
          lyric_margin_y: lyricMarginY,
          lyric_bilingual: lyricBilingual,
          lyric_color: lyricColor,
        });
        setLastSaved("บันทึกอัตโนมัติ");
      } catch (e) {
        console.error("Auto-save subtitles failed:", e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    subFont,
    subSize,
    subOutline,
    subShadow,
    subMarginV,
    subColor,
    rubyEnabledState,
    rubySize,
    rubyOffsetY,
    rubyColor,
    lyricSize,
    lyricMarginX,
    lyricMarginY,
    lyricBilingual,
    lyricColor,
    updateConfig,
  ]);

  const handleReset = () => {
    playSound("click");
    handleApplyPreset(PRESETS[0]);
  };

  // Render Subtitle and Lyric Text elements for fullscreen portal
  const renderFullscreenSubtitleText = () => {
    const curScale = window.innerHeight / 1080;
    const curFontSize = Math.round(subSize * curScale);
    const curOutline = Number((subOutline * curScale).toFixed(2));
    const curShadow = Number((subShadow * curScale).toFixed(2));
    const curMargin = Math.round(subMarginV * curScale);

    const showLyric = previewType === "lyric" || previewType === "both";
    const showDialogue = previewType === "dialogue" || previewType === "both";
    const lyricData = SAMPLE_LYRICS[sampleLang];

    const effRubySize = rubySize > 0 ? rubySize : Math.max(18, Math.round(subSize * 0.52));
    const curRubySize = Math.round(effRubySize * curScale);
    const effLyricThSize = lyricSize > 0 ? lyricSize : Math.max(34, Math.round(subSize * 0.85));
    const curLyricThSize = Math.round(effLyricThSize * curScale);
    const effLyricZhSize = Math.max(26, Math.round(effLyricThSize * 0.76));
    const curLyricZhSize = Math.round(effLyricZhSize * curScale);

    return (
      <>
        {showLyric && (
          <div
            className="absolute transition-all pointer-events-none select-none z-20"
            style={{
              top: `${Math.round(lyricMarginY * curScale)}px`,
              left: `${Math.round(lyricMarginX * curScale)}px`,
              maxWidth: "75%",
            }}
          >
            <div
              className="font-semibold italic tracking-wide"
              style={{
                fontFamily: subFont,
                fontSize: `${curLyricThSize}px`,
                color: lyricColor,
                WebkitTextStroke: "none",
                paintOrder: "stroke fill",
                textShadow: "none",
                lineHeight: 1.2,
              }}
            >
              {lyricData.line1}
            </div>
            {lyricBilingual && (
              <div
                className="font-medium italic tracking-normal"
                style={{
                  fontFamily: "Microsoft YaHei, sans-serif",
                  fontSize: `${curLyricZhSize}px`,
                  color: lyricColor,
                  marginTop: `${Math.round(8 * curScale)}px`,
                  WebkitTextStroke: "none",
                  paintOrder: "stroke fill",
                  textShadow: "none",
                  lineHeight: 1.2,
                }}
              >
                {lyricData.line2}
              </div>
            )}
          </div>
        )}

        {showDialogue && (
          <div
            className="absolute left-0 right-0 text-center px-6 transition-all pointer-events-none select-none z-20"
            style={{ bottom: `${curMargin}px` }}
          >
            {rubyEnabledState && (
              <div
                className="font-medium tracking-wide opacity-95"
                style={{
                  fontFamily: subFont,
                  fontSize: `${curRubySize}px`,
                  color: rubyColor,
                  marginBottom: `${Math.round((8 + rubyOffsetY) * curScale)}px`,
                  WebkitTextStroke:
                    curOutline > 0
                      ? `${Math.max(0.4, curOutline * 1.5)}px rgba(0, 0, 0, 0.9)`
                      : "none",
                  paintOrder: "stroke fill",
                  textShadow:
                    curShadow > 0
                      ? `${curShadow}px ${curShadow}px 2px rgba(0, 0, 0, 0.5)`
                      : "none",
                }}
              >
                {rubyText}
              </div>
            )}
            <div
              style={{
                fontFamily: subFont,
                fontSize: `${curFontSize}px`,
                color: subColor,
                WebkitTextStroke:
                  curOutline > 0 ? `${curOutline * 2}px rgba(0, 0, 0, 0.9)` : "none",
                paintOrder: "stroke fill",
                textShadow:
                  curShadow > 0
                    ? `${curShadow}px ${curShadow}px 2px rgba(0, 0, 0, 0.5)`
                    : "none",
                letterSpacing: "0.015em",
                lineHeight: 1.18,
              }}
              className="font-medium"
            >
              {baseText}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex-1 h-full bg-[#111113] flex flex-col min-w-0 overflow-y-auto select-none p-6 space-y-6">
      {/* Top Header Bar */}
      <SubtitleHeader
        title={t("wsSubtitles")}
        desc={t("subStudioDesc")}
        lastSaved={lastSaved}
        onReset={handleReset}
        resetLabel={t("btnResetDefault")}
        presets={PRESETS}
        onApplyPreset={handleApplyPreset}
      />

      {/* 2-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Interactive Canvas and Controls */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="rounded-2xl overflow-hidden bg-[#141417] border border-white/[0.06] flex flex-col">
            <SubtitleCanvas
              canvasRef={canvasRef}
              framingMode={framingMode}
              activeTheme={activeTheme}
              videoUrl={videoUrl}
              isVideoPlaying={isVideoPlaying}
              showGuides={showGuides}
              zoomMode={zoomMode}
              subFont={subFont}
              subSize={subSize}
              subOutline={subOutline}
              subShadow={subShadow}
              subMarginV={subMarginV}
              subColor={subColor}
              previewType={previewType}
              sampleLang={sampleLang}
              enableRuby={rubyEnabledState}
              rubySize={rubySize}
              rubyOffsetY={rubyOffsetY}
              rubyColor={rubyColor}
              rubyText={rubyText}
              baseText={baseText}
              lyricSize={lyricSize}
              lyricMarginX={lyricMarginX}
              lyricMarginY={lyricMarginY}
              lyricBilingual={lyricBilingual}
              lyricColor={lyricColor}
            />

            <SubtitleCanvasControls
              framingMode={framingMode}
              setFramingMode={setFramingMode}
              previewType={previewType}
              setPreviewType={setPreviewType}
              zoomMode={zoomMode}
              setZoomMode={setZoomMode}
              activeThemeId={activeThemeId}
              setActiveThemeId={setActiveThemeId}
              showGuides={showGuides}
              setShowGuides={setShowGuides}
              onOpenFullscreen={() => setIsFullscreen(true)}
              fitLabel={t("previewFitFrame")}
              actualLabel={t("previewActual")}
              guidesLabel={t("previewGuides")}
              fullscreenLabel={t("btnFullscreen")}
              hasVideoSource={Boolean(videoUrl)}
              isVideoPlaying={isVideoPlaying}
              onTogglePlayVideo={() => setIsVideoPlaying((prev) => !prev)}
              videoTitle={activeVideo?.fileName}
            />
          </div>

          <SampleDialogueCard
            label={t("sampleDialogue")}
            sampleLang={sampleLang}
            onSwitchLanguage={handleLanguageSwitch}
            enableRuby={rubyEnabledState}
            setEnableRuby={setRubyEnabledState}
            rubyText={rubyText}
            setRubyText={setRubyText}
            baseText={baseText}
            setBaseText={setBaseText}
          />
        </div>

        {/* Right Column: Parameters Panel */}
        <TypographyParametersPanel
          title={t("subStudioTitle")}
          fontFamilyLabel={t("fontFamilyLabel")}
          fontSizeLabel={t("fontSizeLabel")}
          outlineWidthLabel={t("outlineWidthLabel")}
          shadowDepthLabel={t("shadowDepthLabel")}
          verticalMarginLabel={t("verticalMarginLabel")}
          textColorLabel={t("textColorLabel")}
          subFont={subFont}
          setSubFont={setSubFont}
          subSize={subSize}
          setSubSize={setSubSize}
          subOutline={subOutline}
          setSubOutline={setSubOutline}
          subShadow={subShadow}
          setSubShadow={setSubShadow}
          subMarginV={subMarginV}
          setSubMarginV={setSubMarginV}
          subColor={subColor}
          setSubColor={setSubColor}
          rubyEnabled={rubyEnabledState}
          setRubyEnabled={setRubyEnabledState}
          rubySize={rubySize}
          setRubySize={setRubySize}
          rubyOffsetY={rubyOffsetY}
          setRubyOffsetY={setRubyOffsetY}
          rubyColor={rubyColor}
          setRubyColor={setRubyColor}
          lyricSize={lyricSize}
          setLyricSize={setLyricSize}
          lyricMarginX={lyricMarginX}
          setLyricMarginX={setLyricMarginX}
          lyricMarginY={lyricMarginY}
          setLyricMarginY={setLyricMarginY}
          lyricBilingual={lyricBilingual}
          setLyricBilingual={setLyricBilingual}
          lyricColor={lyricColor}
          setLyricColor={setLyricColor}
        />
      </div>

      {/* True Fullscreen Canvas Portal */}
      <FullscreenHUD
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        activeTheme={activeTheme}
        framingMode={framingMode}
        showGuides={showGuides}
        renderSubtitleText={renderFullscreenSubtitleText}
        showFullscreenHUD={showFullscreenHUD}
        setShowFullscreenHUD={setShowFullscreenHUD}
        subSize={subSize}
        setSubSize={setSubSize}
        subOutline={subOutline}
        setSubOutline={setSubOutline}
        subShadow={subShadow}
        setSubShadow={setSubShadow}
        subMarginV={subMarginV}
        setSubMarginV={setSubMarginV}
        labels={{
          title: t("wsSubtitles"),
          exitFullscreen: t("btnExitFullscreen"),
          fontSize: t("fontSizeLabel"),
          outlineWidth: t("outlineWidthLabel"),
          shadowDepth: t("shadowDepthLabel"),
          verticalMargin: t("verticalMarginLabel"),
        }}
      />
    </div>
  );
};
