import React, { useState, useEffect } from "react";
import {
  Film,
  Play,
  FolderOpen,
  FolderArchive,
  Volume2,
  Subtitles,
  Sparkles,
  CheckCircle2,
  X,
  Layers,
  Clock,
  SlidersHorizontal,
  ListPlus,
  ExternalLink,
  Copy,
  Check,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { StudioButton } from "../ui/StudioButton";
import { StudioSegmentedControl } from "../ui/StudioSegmentedControl";
import { StudioSelect } from "../ui/StudioSelect";
import { useApp } from "../../context/AppContext";
import { RendererAPI, type CutsceneSubtitleLineDto } from "../../core/ipc";
import { resolveThumbnailSrc } from "../../utils/thumbnailResolver";
import { SUBTITLE_LANGUAGES } from "../../locales";

const dialogueCache = new Map<string, CutsceneSubtitleLineDto[]>();

export interface VideoMetaInfo {
  thumbnail: string;
  duration_secs: number;
  duration_formatted: string;
  resolution: string;
}

export interface InspectorProps {
  selectedFile: string | null;
  selectedCount?: number;
  fileName?: string;
  folderPath?: string;
  meta?: VideoMetaInfo | null;
  thumbnailUrl?: string;
  audioEventCount?: number;
  isOpen: boolean;
  onClose: () => void;
  isLevelSequence?: boolean;
  hasVideo?: boolean;
  isCached?: boolean;
  // Video Options
  gender: "Girl" | "Boy";
  onGenderChange: (gender: "Girl" | "Boy") => void;
  locale: string;
  onLocaleChange: (locale: string) => void;
  subtitleMode: "None" | "Soft-sub" | "Hard-sub";
  onSubtitleModeChange: (mode: "None" | "Soft-sub" | "Hard-sub") => void;
  renderResolution: string;
  onResolutionChange: (res: string) => void;
  // Actions & Navigation
  onExtractRaw?: () => void;
  isExtracting?: boolean;
  onRender: () => void;
  onCancelRender?: () => void;
  onBatchQueue?: () => void;
  onNavigateToSubtitleLab?: () => void;
  isRendering: boolean;
  renderedVideoPath: string | null;
  onOpenRawVideo: () => void;
  onOpenExternal?: () => void;
  onOpenClipFolder: () => void;
  onOpenSourceFolder?: () => void;
  onOpenRenderedVideo?: () => void;
  onOpenOutputDir: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedFile,
  selectedCount = 1,
  fileName,
  folderPath,
  meta,
  thumbnailUrl,
  audioEventCount = 0,
  isOpen,
  onClose,
  isLevelSequence = false,
  hasVideo = true,
  isCached = false,
  gender,
  onGenderChange,
  locale,
  onLocaleChange,
  subtitleMode,
  onSubtitleModeChange,
  renderResolution,
  onResolutionChange,
  onExtractRaw,
  isExtracting = false,
  onRender,
  onCancelRender,
  onBatchQueue,
  onNavigateToSubtitleLab,
  isRendering,
  renderedVideoPath,
  onOpenRawVideo,
  onOpenExternal,
  onOpenClipFolder,
  onOpenSourceFolder,
  onOpenRenderedVideo: _onOpenRenderedVideo,
  onOpenOutputDir,
}) => {
  const { t, config, updateConfig } = useApp();
  const currentSubLang = config.subtitle_lang || "th";
  const [dialogueLines, setDialogueLines] = useState<CutsceneSubtitleLineDto[]>([]);
  const [isDialogueOpen, setIsDialogueOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile && !fileName) {
      setDialogueLines([]);
      return;
    }
    const clean = (fileName || "").replace(/\.[^/.]+$/, "");
    if (!clean) return;

    const cacheKey = `${clean}:${currentSubLang}`;
    if (dialogueCache.has(cacheKey)) {
      setDialogueLines(dialogueCache.get(cacheKey) || []);
      return;
    }

    RendererAPI.getCutsceneDialogue(clean, currentSubLang)
      .then((lines) => {
        const resolved = lines || [];
        dialogueCache.set(cacheKey, resolved);
        setDialogueLines(resolved);
      })
      .catch(() => setDialogueLines([]));
  }, [selectedFile, fileName, currentSubLang]);

  const handleCopyText = (text: string, type: string, successMsg: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success(successMsg);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyAllDialogue = () => {
    if (dialogueLines.length === 0) return;
    const fullText = dialogueLines
      .map((l) => `${l.time_formatted}: ${l.content}`)
      .join("\n");
    handleCopyText(fullText, "dialogue", t("toastAllDialogueCopied"));
  };

  const handleExportSubtitles = async () => {
    const clean = (fileName || "").replace(/\.[^/.]+$/, "");
    if (!clean) return;
    try {
      const files = await RendererAPI.exportSubtitlesBundle(clean, currentSubLang);
      if (files && files.length > 0) {
        toast.success(t("toastExportSubSuccess"));
      } else {
        toast.error(t("toastNoDialogueError"));
      }
    } catch {
      toast.error(t("toastExportSubError"));
    }
  };

  if (!isOpen) return null;

  const isMulti = selectedCount > 1;

  return (
    <aside className="w-[320px] h-full bg-[#131316] border-l border-white/[0.04] flex flex-col shrink-0 select-none z-30">
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-[#131316]">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#8E8E93]" />
          <span className="text-xs font-medium text-white tracking-tight">
            {isMulti ? `${t("selectedItemsCount")} ${selectedCount}` : t("studioControls")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-md text-[#8E8E93] hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer outline-none"
          title={t("inspectorClose")}
          aria-label={t("inspectorClose")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5">
        {!selectedFile && !isMulti ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3 text-[#52525B]">
              <Film className="w-6 h-6 stroke-[1.2]" />
            </div>
            <h4 className="text-xs font-semibold text-[#8E8E93] mb-1">
              {t("noCutsceneSelected")}
            </h4>
            <p className="text-[11px] text-[#52525B] leading-relaxed">
              {t("clickToSelect")}
            </p>
          </div>
        ) : (
          <>
            {/* 1. Single Cutscene Preview & Metadata Card */}
            {!isMulti && (
              <div className="bg-[#16161a] rounded-xl p-3.5 space-y-3">
                <div
                  onClick={onOpenRawVideo}
                  className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#0A0A0C] cursor-pointer group select-none shadow-sm"
                  title={t("inspectorClickToPreview")}
                >
                  {thumbnailUrl || meta?.thumbnail ? (
                    <img
                      src={resolveThumbnailSrc(thumbnailUrl || meta?.thumbnail)}
                      alt={fileName}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                    />
                  ) : isLevelSequence && !hasVideo ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#121215] group-hover:bg-[#16161A] transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-white mb-1.5 shadow-sm">
                        <Layers className="w-4 h-4 stroke-[1.25] text-neutral-300" />
                      </div>
                      <span className="text-[11px] font-medium text-white tracking-tight">{t("inspectorLevelSequence")}</span>
                      <span className="text-[9px] font-mono text-[#71717A] mt-0.5">{t("inspectorClickAudioInfo")}</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#71717A] group-hover:text-white transition-colors bg-[#121215]">
                      <Film className="w-7 h-7 stroke-[1.2] mb-1" />
                      <span className="text-[10px] font-mono text-[#52525B]">{t("inspectorClickToPreview")}</span>
                    </div>
                  )}

                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                      <Play className="w-4 h-4 ml-0.5 fill-white" />
                    </div>
                  </div>

                  {meta?.duration_formatted && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md flex items-center gap-1 text-[10px] font-mono text-[#A1A1AA]">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{meta.duration_formatted}</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-[#A1A1AA]">
                    {isLevelSequence && !hasVideo ? "3D Sequence" : (meta?.resolution || "1080p")}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-white truncate" title={fileName}>
                    {fileName}
                  </h3>
                  {folderPath && (
                    <p className="text-[10px] text-[#71717A] truncate font-mono mt-0.5" title={folderPath}>
                      {folderPath}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyText(fileName || "", "id", t("toastCopiedIdSuccess"))}
                      className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-[#A1A1AA] flex items-center gap-1 transition-colors cursor-pointer outline-none"
                      title={t("inspectorCopyId")}
                    >
                      {copiedType === "id" ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copiedType === "id" ? t("copied") : t("inspectorCopyId")}</span>
                    </button>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedFile, "path", t("toastCopiedPathSuccess"))}
                        className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-[#A1A1AA] flex items-center gap-1 transition-colors cursor-pointer outline-none"
                        title={t("inspectorCopyPath")}
                      >
                        {copiedType === "path" ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedType === "path" ? t("copied") : t("inspectorCopyPath")}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  {hasVideo ? (
                    <StudioButton
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[11px] h-8 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.06]"
                      onClick={onOpenRawVideo}
                    >
                      <Play className="w-3.5 h-3.5 text-neutral-300 fill-neutral-300/20" />
                      <span>{isCached ? t("btnPlayRaw") : t("inspectorExtractToPlay")}</span>
                    </StudioButton>
                  ) : (
                    <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.03] text-[11px] text-neutral-400 font-mono text-center truncate">
                      In-Engine 3D Sequence
                    </div>
                  )}
                  {selectedFile && onOpenExternal && (
                    <StudioButton
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2.5 flex items-center gap-1.5 text-[11px] text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] shrink-0"
                      onClick={onOpenExternal}
                      title={t("inspectorOpenExternal")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{t("quickLookOpenExternal")}</span>
                    </StudioButton>
                  )}
                </div>
              </div>
            )}

            {/* 2. Audio Engine Card: Minimal Horizontal Sliding Controls */}
            <div className="bg-[#16161a] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                  <Volume2 className="w-3.5 h-3.5 text-[#8E8E93]" />
                  <span>{t("audioEngineTitle")}</span>
                </div>
                {!isMulti && audioEventCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-[#71717A]">
                    {audioEventCount} Tracks
                  </span>
                )}
              </div>

              {/* Rover Gender: Horizontal Sliding Pill */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider block">
                  {t("roverProtagonist")}
                </label>
                <StudioSegmentedControl<"Girl" | "Boy">
                  value={gender}
                  onChange={onGenderChange}
                  className="w-full bg-[#121215]"
                  options={[
                    { value: "Girl", label: t("roverGirl") },
                    { value: "Boy", label: t("roverBoy") },
                  ]}
                />
              </div>

              {/* Voice Language: Horizontal Sliding Pill JP / EN / CN / KR */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider block">
                  {t("voiceLanguageTitle")}
                </label>
                <StudioSegmentedControl<string>
                  value={locale}
                  onChange={onLocaleChange}
                  className="w-full bg-[#121215]"
                  options={[
                    { value: "ja", label: "JP" },
                    { value: "en", label: "EN" },
                    { value: "ko", label: "KR" },
                    { value: "zh", label: "CN" },
                  ]}
                />
              </div>
            </div>

            {/* 3. Subtitles & Dialogue Card: Only for video files */}
            {(!isLevelSequence || hasVideo) && (
              <div className="bg-[#16161a] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                    <Subtitles className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <span>{t("subStudioTitle")}</span>
                  </div>
                  {/* Bridge to Subtitle Lab */}
                  {onNavigateToSubtitleLab && (
                    <button
                      type="button"
                      onClick={onNavigateToSubtitleLab}
                      className="flex items-center gap-1 text-[11px] text-[#8E8E93] hover:text-white transition-colors cursor-pointer outline-none"
                      title={t("btnCustomizeSub")}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{t("btnCustomizeSub")}</span>
                    </button>
                  )}
                </div>

                {/* Subtitle Language Selector: Two-tier layout (Quick Pills + Full Dropdown) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider block">
                      {t("inspectorSubLangTitle")}
                    </label>
                  </div>

                  <StudioSegmentedControl<string>
                    value={
                      ["th", "en", "ja", "zh-Hans", "ko"].includes(currentSubLang)
                        ? currentSubLang
                        : "other"
                    }
                    onChange={(val) => {
                      if (val !== "other") {
                        updateConfig({ subtitle_lang: val });
                        toast.success(`${t("toastSubLangSwitched")}: ${val.toUpperCase()}`);
                      }
                    }}
                    className="w-full bg-[#121215]"
                    options={[
                      { value: "th", label: "TH" },
                      { value: "en", label: "EN" },
                      { value: "ja", label: "JA" },
                      { value: "zh-Hans", label: "ZH" },
                      { value: "ko", label: "KO" },
                    ]}
                  />

                  <StudioSelect
                    value={currentSubLang}
                    onChange={(e) => {
                      updateConfig({ subtitle_lang: e.target.value });
                      toast.success(`${t("toastSubLangSwitched")}: ${e.target.value.toUpperCase()}`);
                    }}
                    options={SUBTITLE_LANGUAGES.map((l) => ({
                      value: l.code,
                      label: `${l.shortLabel} — ${l.nativeLabel}`,
                    }))}
                    className="h-8 bg-[#121215] border border-white/[0.06] text-xs"
                  />
                </div>

                {/* Subtitle Mode: Horizontal Sliding Pill */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider block">
                    {t("inspectorSubModeLabel")}
                  </label>
                  <StudioSegmentedControl<"None" | "Soft-sub" | "Hard-sub">
                    value={subtitleMode}
                    onChange={onSubtitleModeChange}
                    className="w-full bg-[#121215]"
                    options={[
                      { value: "Hard-sub", label: t("subModeHardsub") },
                      { value: "Soft-sub", label: t("subModeSoftsub") },
                      { value: "None", label: t("subModeNone") },
                    ]}
                  />
                </div>

                {/* Dialogue Script Box */}
                {!isMulti && dialogueLines.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setIsDialogueOpen(!isDialogueOpen)}
                        className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-neutral-300 transition-colors cursor-pointer outline-none min-w-0"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                        <span className="whitespace-nowrap shrink-0">{t("inspectorDialogueTitle")}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-[#71717A] shrink-0">
                          {dialogueLines.length}
                        </span>
                        {isDialogueOpen ? (
                          <ChevronUp className="w-3 h-3 text-[#71717A] shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#71717A] shrink-0" />
                        )}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyAllDialogue}
                          className="w-6 h-6 rounded-md text-[#8E8E93] hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer outline-none"
                          title={t("inspectorCopyAllDialogue")}
                          aria-label={t("inspectorCopyAllDialogue")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleExportSubtitles}
                          className="w-6 h-6 rounded-md text-[#8E8E93] hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer outline-none"
                          title={t("inspectorExportSubs")}
                          aria-label={t("inspectorExportSubs")}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isDialogueOpen && (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-[#121215] text-[11px]">
                        {dialogueLines.map((line) => (
                          <div key={line.caption_id} className="flex gap-2 leading-relaxed">
                            <span className="text-[10px] font-mono text-[#71717A] shrink-0 pt-0.5">
                              {line.time_formatted}
                            </span>
                            <span className="text-[#D4D4D8]">{line.content}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Render & Resolution Card */}
            <div className="bg-[#16161a] rounded-xl p-3.5 space-y-3">
              {(!isLevelSequence || hasVideo) && (
                <StudioSelect
                  label={t("aspectRatioTitle")}
                  value={renderResolution}
                  onChange={(e) => onResolutionChange(e.target.value)}
                  options={[
                    { value: "1920x1080", label: t("res1080pCinema") },
                    { value: "1920x1080_zoom", label: t("res1080pZoom") },
                    { value: "original", label: t("resOriginalUltrawide") },
                    { value: "1080x1920", label: t("resVerticalShorts") },
                    { value: "2560x1440", label: t("res2kQHD") },
                    { value: "3840x2160", label: t("res4kUHD") },
                    { value: "1280x720", label: t("res720pHD") },
                  ]}
                />
              )}

              {isMulti ? (
                /* Multi-Select: Add to Batch Queue */
                <StudioButton
                  variant="primary"
                  size="md"
                  className="w-full h-9 text-xs font-semibold bg-white text-black hover:bg-neutral-200"
                  onClick={onBatchQueue}
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>
                    {t("btnAddAllToQueue")} {selectedCount} {t("queueClipsUnit")}
                  </span>
                </StudioButton>
              ) : (
                /* Single Cutscene Actions: Separate Raw Extraction & Render */
                <div className="space-y-2">
                  {/* Progressive extraction status / button */}
                  {isCached ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 text-[11px]">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{t("inspectorRawReady")}</span>
                      </span>
                      {onExtractRaw && (
                        <button
                          type="button"
                          onClick={onExtractRaw}
                          disabled={isRendering || isExtracting}
                          className="text-[10px] text-neutral-400 hover:text-white transition-colors cursor-pointer outline-none underline underline-offset-2"
                        >
                          {t("inspectorReExtract")}
                        </button>
                      )}
                    </div>
                  ) : (
                    onExtractRaw && (
                      <StudioButton
                        variant="secondary"
                        size="md"
                        className="w-full h-9 text-xs font-medium bg-[#1c1c21] text-neutral-300 hover:bg-[#25252c] border border-white/[0.06]"
                        onClick={onExtractRaw}
                        disabled={isRendering || isExtracting}
                      >
                        <FolderArchive className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{t("inspectorExtractRaw")}</span>
                      </StudioButton>
                    )
                  )}

                  {/* Action 2: Start video render or cancel */}
                  {isRendering ? (
                    <StudioButton
                      variant="danger"
                      size="md"
                      className="w-full h-9 text-xs font-semibold bg-neutral-800 text-neutral-200 border-0 hover:bg-neutral-700"
                      onClick={onCancelRender}
                    >
                      <X className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                      <span>{t("inspectorCancelRender")}</span>
                    </StudioButton>
                  ) : (
                    <StudioButton
                      variant="primary"
                      size="md"
                      className="w-full h-9 text-xs font-semibold bg-white text-black hover:bg-neutral-200 border-0 shadow-lg shadow-white/5 transition-all"
                      onClick={onRender}
                      disabled={isExtracting}
                    >
                      {isLevelSequence && !hasVideo ? (
                        <>
                          <Layers className="w-3.5 h-3.5 text-black" />
                          <span>{t("inspectorExtractAudioData")}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-black" />
                          <span>{t("inspectorStartRender")}</span>
                        </>
                      )}
                    </StudioButton>
                  )}
                </div>
              )}

              {/* Render Success Card */}
              {!isMulti && renderedVideoPath && (
                <div className="p-2.5 rounded-lg bg-white/[0.04] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                    <span>{t("inspectorRenderDone")}</span>
                  </div>
                  <StudioButton
                    variant="secondary"
                    size="sm"
                    className="w-full text-[11px] bg-white/[0.08] hover:bg-white/[0.14] text-neutral-200 border-0"
                    onClick={onOpenOutputDir}
                  >
                    <FolderOpen className="w-3 h-3 text-neutral-300" />
                    <span>{t("inspectorOpenFolder")}</span>
                  </StudioButton>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <StudioButton
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#71717A] hover:text-white"
                  onClick={onOpenSourceFolder || onOpenClipFolder}
                  title={t("inspectorSourceFolder")}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span className="truncate">{t("inspectorSourceFolder")}</span>
                </StudioButton>
                <StudioButton
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#71717A] hover:text-white"
                  onClick={onOpenOutputDir}
                  title={t("inspectorOutputFolder")}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="truncate">{t("inspectorOutputFolder")}</span>
                </StudioButton>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
