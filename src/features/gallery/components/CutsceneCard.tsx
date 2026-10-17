import React from "react";
import { Film, Clock, Loader2, Play, Layers, DownloadCloud, Plus } from "lucide-react";
import { ProcessedVideoItem, VideoMetaInfo } from "@/features/catalog/stores/useCatalogStore";

interface CutsceneCardProps {
  video: ProcessedVideoItem;
  isSelected: boolean;
  isCurrent: boolean;
  meta?: VideoMetaInfo | null;
  thumb?: string;
  isExtracting: boolean;
  hoverScrubPct?: number;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onQuickAddToQueue: (e: React.MouseEvent) => void;
  dialogueMatch?: string;
}

export const CutsceneCard: React.FC<CutsceneCardProps> = ({
  video,
  isSelected,
  isCurrent,
  meta,
  thumb,
  isExtracting,
  hoverScrubPct,
  onMouseMove,
  onMouseLeave,
  onSelect,
  onDoubleClick,
  onQuickAddToQueue,
  dialogueMatch,
}) => {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={`group rounded-xl p-2 flex flex-col justify-between transition-all cursor-pointer select-none relative ${
        isSelected || isCurrent
          ? "bg-[#26262B] ring-1 ring-white/20 shadow-lg"
          : "bg-[#18181C] hover:bg-[#222227]"
      }`}
    >
      {/* Aspect Ratio 16:9 Clean Canvas */}
      <div
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#0A0A0C]"
      >
        {thumb ? (
          <img
            src={thumb}
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

        {/* Scrubbing indicator line */}
        {hoverScrubPct !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 pointer-events-none z-20">
            <div
              className="h-full bg-white transition-all duration-75"
              style={{ width: `${hoverScrubPct}%` }}
            />
          </div>
        )}

        {/* Top-Right: Loading status or cached indicator */}
        <div className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 z-10">
          {isExtracting ? (
            <div className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md flex items-center gap-1 text-[9px] font-mono text-white">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-white" />
              <span>สกัด...</span>
            </div>
          ) : video.isCached ? (
            <div
              className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm"
              title="พร้อมเปิดทันที"
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
                <span>เปิดดู</span>
              </>
            ) : video.isLevelSequence && !video.hasVideo ? (
              <>
                <Layers className="w-3 h-3 text-white" />
                <span>3D เรนเดอร์สด</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-3 h-3 text-white" />
                <span>สกัดวิดีโอ</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onQuickAddToQueue}
            className="w-7 h-7 rounded-full bg-black/85 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center shadow-xl hover:bg-white/[0.2] transition-colors cursor-pointer outline-none"
            title="เพิ่มเข้าคิวเรนเดอร์ทันที"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Info: Minimal text hierarchy */}
      <div className="pt-2 px-0.5">
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
          {video.roverType !== "Neutral" && (
            <span className="text-[#A1A1AA] text-[10px] font-mono shrink-0">
              {video.roverType === "Girl" ? "หญิง" : "ชาย"}
            </span>
          )}
        </div>
        {dialogueMatch && (
          <p className="text-[10px] text-neutral-300 truncate italic mt-1 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
            “{dialogueMatch}”
          </p>
        )}
      </div>
    </div>
  );
};
