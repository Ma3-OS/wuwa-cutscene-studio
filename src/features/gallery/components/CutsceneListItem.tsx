import React from "react";
import { Film, Loader2 } from "lucide-react";
import { ProcessedVideoItem, VideoMetaInfo } from "@/features/catalog/stores/useCatalogStore";

interface CutsceneListItemProps {
  video: ProcessedVideoItem;
  isSelected: boolean;
  isCurrent: boolean;
  meta?: VideoMetaInfo | null;
  thumb?: string;
  isExtracting: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export const CutsceneListItem: React.FC<CutsceneListItemProps> = ({
  video,
  isSelected,
  isCurrent,
  meta,
  thumb,
  isExtracting,
  onSelect,
  onDoubleClick,
}) => {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={`h-11 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none ${
        isSelected || isCurrent
          ? "bg-[#26262B] ring-1 ring-white/20"
          : "bg-[#18181C] hover:bg-[#222227]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-12 h-7 rounded overflow-hidden bg-[#0A0A0C] shrink-0 flex items-center justify-center">
          {thumb ? (
            <img
              src={thumb}
              alt={video.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Film className="w-3 h-3 text-[#52525B]" />
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-white truncate">
            {video.fileName}
          </span>
          {video.roverType !== "Neutral" && (
            <span className="text-[10px] text-[#A1A1AA] font-mono">
              {video.roverType === "Girl" ? "หญิง" : "ชาย"}
            </span>
          )}
          <span className="text-[10px] font-mono text-[#71717A] truncate">
            {video.folderName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 font-mono text-[10px] text-[#71717A]">
        <span className="text-[9px] font-mono text-[#A1A1AA] uppercase bg-white/[0.04] px-1.5 py-0.5 rounded">
          {video.hasVideo || video.assetKind === "video"
            ? video.videoFormat?.toUpperCase() ||
              (video.cgFile?.toLowerCase().endsWith(".bk2") ? "BK2" : "MP4")
            : "3D SEQ"}
        </span>
        {meta?.duration_formatted && <span>{meta.duration_formatted}</span>}
        {isExtracting ? (
          <span className="text-white flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            กำลังสกัด...
          </span>
        ) : video.isCached ? (
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" title="พร้อมเปิด" />
        ) : null}
      </div>
    </div>
  );
};
