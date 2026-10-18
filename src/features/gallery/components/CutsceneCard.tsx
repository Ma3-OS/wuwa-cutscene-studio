import React, { useRef } from "react";
import { Film, Clock, Loader2, Play, Layers, DownloadCloud, Plus } from "lucide-react";
import { ProcessedVideoItem, VideoMetaInfo } from "@/features/catalog/stores/useCatalogStore";
import { resolveThumbnailSrc } from "@/utils/thumbnailResolver";
import { useApp } from "@/context/AppContext";

export interface CutsceneCardProps {
  video: ProcessedVideoItem;
  isSelected: boolean;
  isCurrent: boolean;
  meta?: VideoMetaInfo | null;
  thumb?: string;
  isExtracting: boolean;
  onSelect: (video: ProcessedVideoItem, e: React.MouseEvent) => void;
  onDoubleClick: (video: ProcessedVideoItem) => void;
  onQuickAddToQueue: (e: React.MouseEvent, video: ProcessedVideoItem) => void;
  dialogueMatch?: string;
  cardRefCallback?: (node: HTMLDivElement | null, video: ProcessedVideoItem) => void;
}

const CutsceneCardComponent: React.FC<CutsceneCardProps> = ({
  video,
  isSelected,
  isCurrent,
  meta,
  thumb,
  isExtracting,
  onSelect,
  onDoubleClick,
  onQuickAddToQueue,
  dialogueMatch,
  cardRefCallback,
}) => {
  const { t } = useApp();
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const resolvedThumb = resolveThumbnailSrc(thumb);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    if (scrubBarRef.current) {
      scrubBarRef.current.style.width = `${pct}%`;
      scrubBarRef.current.style.opacity = "1";
    }
  };

  const handleMouseLeave = () => {
    if (scrubBarRef.current) {
      scrubBarRef.current.style.opacity = "0";
    }
  };

  const handleRef = (node: HTMLDivElement | null) => {
    if (cardRefCallback) {
      cardRefCallback(node, video);
    }
  };

  return (
    <div
      ref={handleRef}
      data-cutscene-id={video.uniqueId}
      onClick={(e) => onSelect(video, e)}
      onDoubleClick={() => onDoubleClick(video)}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "auto 220px",
      }}
      className={`group rounded-xl overflow-hidden flex flex-col justify-between transition-all cursor-pointer select-none relative border border-white/[0.04] ${
        isSelected || isCurrent
          ? "bg-[#1E1E24] ring-1 ring-white/20 shadow-lg"
          : "bg-[#141417] hover:bg-[#1A1A1F]"
      }`}
    >
      {/* Aspect Ratio 16:9 Edge-to-Edge Canvas */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative aspect-video w-full overflow-hidden bg-[#0A0A0C]"
      >
        {resolvedThumb ? (
          <img
            src={resolvedThumb}
            alt={video.fileName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#141416]">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#71717A] group-hover:text-white transition-colors">
              <Film className="w-4 h-4 stroke-[1.25]" />
            </div>
          </div>
        )}

        {/* Gradient Overlay for bottom text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Zero-State Scrubbing indicator line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 pointer-events-none z-20">
          <div
            ref={scrubBarRef}
            className="h-full bg-white opacity-0 transition-opacity duration-150"
            style={{ width: "0%" }}
          />
        </div>

        {/* Top-Left: Monochrome Rover Gender Badge */}
        {video.roverType && video.roverType !== "Neutral" && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md flex items-center gap-1 text-[9px] font-mono font-medium text-white/90 border border-white/10 pointer-events-none z-10 shadow-sm">
            <span>{video.roverType === "Girl" ? t("roverGirl") : t("roverBoy")}</span>
          </div>
        )}

        {/* Top-Right: Loading status or cached indicator */}
        <div className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 z-10">
          {isExtracting ? (
            <div className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md flex items-center gap-1 text-[9px] font-mono text-white">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-white" />
              <span>{t("galleryExtracting")}</span>
            </div>
          ) : video.isCached ? (
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm"
              title={t("galleryReady")}
            />
          ) : null}
        </div>

        {/* Bottom-Left: Format Badge */}
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono text-[#A1A1AA] pointer-events-none uppercase z-10">
          {video.hasVideo || video.assetKind === "video"
            ? video.videoFormat?.toUpperCase() ||
              (video.cgFile?.toLowerCase().endsWith(".bk2") ? "BK2" : "MP4")
            : "3D SEQ"}
        </div>

        {/* Bottom-Right: Duration in monospace */}
        {meta?.duration_formatted && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md flex items-center gap-1 text-[9px] font-mono text-[#D4D4D8] pointer-events-none z-10">
            <Clock className="w-2.5 h-2.5 text-[#A1A1AA]" />
            <span>{meta.duration_formatted}</span>
          </div>
        )}

        {/* Hover Action Pill */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
          <div className="px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 shadow-xl pointer-events-none">
            {video.isCached ? (
              <>
                <Play className="w-3 h-3 fill-white text-white" />
                <span>{t("queueOpenBtn")}</span>
              </>
            ) : video.isLevelSequence && !video.hasVideo ? (
              <>
                <Layers className="w-3 h-3 text-white" />
                <span>{t("gallery3DLiveRender")}</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-3 h-3 text-white" />
                <span>{t("galleryExtractVideo")}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => onQuickAddToQueue(e, video)}
            className="w-7 h-7 rounded-full bg-black/85 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center shadow-xl hover:bg-white/[0.2] transition-colors cursor-pointer outline-none"
            title={t("galleryQueueInstant")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Info: Minimal text hierarchy */}
      <div className="p-2.5">
        <h4
          className="text-xs font-medium text-white truncate"
          title={video.fileName}
        >
          {video.fileName}
        </h4>
        <div className="flex items-center justify-between gap-1 text-[10px] text-[#71717A] mt-0.5 font-mono">
          <span className="truncate" title={video.folderName}>
            {video.folderName}
          </span>
        </div>
        {dialogueMatch && (
          <p className="text-[10px] text-neutral-300 truncate italic mt-1.5 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
            “{dialogueMatch}”
          </p>
        )}
      </div>
    </div>
  );
};

export const CutsceneCard = React.memo(CutsceneCardComponent, (prev, next) => {
  return (
    prev.video.uniqueId === next.video.uniqueId &&
    prev.isSelected === next.isSelected &&
    prev.isCurrent === next.isCurrent &&
    prev.thumb === next.thumb &&
    prev.isExtracting === next.isExtracting &&
    prev.dialogueMatch === next.dialogueMatch &&
    prev.meta?.duration_formatted === next.meta?.duration_formatted &&
    prev.onSelect === next.onSelect &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.onQuickAddToQueue === next.onQuickAddToQueue &&
    prev.cardRefCallback === next.cardRefCallback
  );
});
