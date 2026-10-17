import React, { useState, useEffect, useRef, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useApp } from "@/context/AppContext";
import { useCatalogStore } from "@/features/catalog/stores/useCatalogStore";
import { toast } from "sonner";
import {
  PRESETS,
  SCENE_THEMES,
  SAMPLE_TEXTS,
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
  const [activeThemeId, setActiveThemeId] = useState(
    cachedVideos.length > 0 ? "cutscene_video" : "cutscene"
  );

  const [sampleLang, setSampleLang] = useState<"th" | "en" | "ja" | "zh">(
    (config.subtitle_lang as "th" | "en" | "ja" | "zh") || "th"
  );
  const [rubyText, setRubyText] = useState(SAMPLE_TEXTS[sampleLang].ruby);
  const [baseText, setBaseText] = useState(SAMPLE_TEXTS[sampleLang].base);

  // Fullscreen states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenHUD, setShowFullscreenHUD] = useState(false);

  // Subtitle custom parameters
  const [subFont, setSubFont] = useState(config.sub_font || "Kanit Medium");
  const [subSize, setSubSize] = useState(config.sub_size || 54);
  const [subOutline, setSubOutline] = useState(config.sub_outline ?? 1.0);
  const [subShadow, setSubShadow] = useState(config.sub_shadow ?? 0.6);
  const [subMarginV, setSubMarginV] = useState(config.sub_margin_v ?? 54);
  const [subColor, setSubColor] = useState(config.sub_color || "#FFFFFF");

  // Ruby custom parameters
  const [rubyEnabledState, setRubyEnabledState] = useState(config.ruby_enabled ?? true);
  const [rubyFont, setRubyFont] = useState(config.ruby_font || "Kanit Medium");
  const [rubySize, setRubySize] = useState(config.ruby_size || 0);
  const [rubyOutline, setRubyOutline] = useState(config.ruby_outline ?? 1.0);
  const [rubyShadow, setRubyShadow] = useState(config.ruby_shadow ?? 0.6);
  const [rubyOffsetY, setRubyOffsetY] = useState(config.ruby_offset_y || 0);
  const [rubyColor, setRubyColor] = useState(config.ruby_color || "#E0E0E0");

  // Lyric custom parameters
  const [lyricFont, setLyricFont] = useState(config.lyric_font || "Kanit Medium");
  const [lyricSize, setLyricSize] = useState(config.lyric_size || 0);
  const [lyricOutline, setLyricOutline] = useState(config.lyric_outline ?? 1.0);
  const [lyricShadow, setLyricShadow] = useState(config.lyric_shadow ?? 0.6);
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
          ruby_font: rubyFont,
          ruby_size: rubySize,
          ruby_outline: rubyOutline,
          ruby_shadow: rubyShadow,
          ruby_offset_y: rubyOffsetY,
          ruby_color: rubyColor,
          lyric_font: lyricFont,
          lyric_size: lyricSize,
          lyric_outline: lyricOutline,
          lyric_shadow: lyricShadow,
          lyric_margin_x: lyricMarginX,
          lyric_margin_y: lyricMarginY,
          lyric_bilingual: lyricBilingual,
          lyric_color: lyricColor,
        });
        setLastSaved(t("subAutoSaved"));
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
    rubyFont,
    rubySize,
    rubyOutline,
    rubyShadow,
    rubyOffsetY,
    rubyColor,
    lyricFont,
    lyricSize,
    lyricOutline,
    lyricShadow,
    lyricMarginX,
    lyricMarginY,
    lyricBilingual,
    lyricColor,
    updateConfig,
  ]);

  const handleReset = () => {
    playSound("click");
    handleApplyPreset(PRESETS[0]);
    setRubyFont("Kanit Medium");
    setRubySize(0);
    setRubyOutline(1.0);
    setRubyShadow(0.6);
    setRubyOffsetY(0);
    setRubyColor("#E0E0E0");
    setLyricFont("Kanit Medium");
    setLyricSize(0);
    setLyricOutline(1.0);
    setLyricShadow(0.6);
    setLyricMarginX(160);
    setLyricMarginY(30);
    setLyricBilingual(true);
    setLyricColor("#FFFFFF");
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
              activeThemeId={activeThemeId}
              activeTheme={activeTheme}
              videoUrl={videoUrl}
              isVideoPlaying={isVideoPlaying}
              showGuides={showGuides}
              subFont={subFont}
              subSize={subSize}
              subOutline={subOutline}
              subShadow={subShadow}
              subMarginV={subMarginV}
              subColor={subColor}
              previewType={previewType}
              sampleLang={sampleLang}
              enableRuby={rubyEnabledState}
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

            <SubtitleCanvasControls
              framingMode={framingMode}
              setFramingMode={setFramingMode}
              previewType={previewType}
              setPreviewType={setPreviewType}
              activeThemeId={activeThemeId}
              setActiveThemeId={setActiveThemeId}
              showGuides={showGuides}
              setShowGuides={setShowGuides}
              onOpenFullscreen={() => setIsFullscreen(true)}
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
          rubyFont={rubyFont}
          setRubyFont={setRubyFont}
          rubySize={rubySize}
          setRubySize={setRubySize}
          rubyOutline={rubyOutline}
          setRubyOutline={setRubyOutline}
          rubyShadow={rubyShadow}
          setRubyShadow={setRubyShadow}
          rubyOffsetY={rubyOffsetY}
          setRubyOffsetY={setRubyOffsetY}
          rubyColor={rubyColor}
          setRubyColor={setRubyColor}
          lyricFont={lyricFont}
          setLyricFont={setLyricFont}
          lyricSize={lyricSize}
          setLyricSize={setLyricSize}
          lyricOutline={lyricOutline}
          setLyricOutline={setLyricOutline}
          lyricShadow={lyricShadow}
          setLyricShadow={setLyricShadow}
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
        activeThemeId={activeThemeId}
        activeTheme={activeTheme}
        videoUrl={videoUrl}
        isVideoPlaying={isVideoPlaying}
        framingMode={framingMode}
        showGuides={showGuides}
        showFullscreenHUD={showFullscreenHUD}
        setShowFullscreenHUD={setShowFullscreenHUD}
        subFont={subFont}
        subSize={subSize}
        setSubSize={setSubSize}
        subOutline={subOutline}
        setSubOutline={setSubOutline}
        subShadow={subShadow}
        setSubShadow={setSubShadow}
        subMarginV={subMarginV}
        setSubMarginV={setSubMarginV}
        subColor={subColor}
        previewType={previewType}
        sampleLang={sampleLang}
        enableRuby={rubyEnabledState}
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
