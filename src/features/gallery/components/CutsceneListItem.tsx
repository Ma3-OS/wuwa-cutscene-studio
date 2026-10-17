import React from "react";
import { Film, Loader2 } from "lucide-react";
import { ProcessedVideoItem, VideoMetaInfo } from "@/features/catalog/stores/useCatalogStore";
import { resolveThumbnailSrc } from "@/utils/thumbnailResolver";
import { useApp } from "@/context/AppContext";

export interface CutsceneListItemProps {
  video: ProcessedVideoItem;
  isSelected: boolean;
  isCurrent: boolean;
  meta?: VideoMetaInfo | null;
  thumb?: string;
  isExtracting: boolean;
  onSelect: (video: ProcessedVideoItem, e: React.MouseEvent) => void;
  onDoubleClick: (video: ProcessedVideoItem) => void;
  cardRefCallback?: (node: HTMLDivElement | null, video: ProcessedVideoItem) => void;
}

const CutsceneListItemComponent: React.FC<CutsceneListItemProps> = ({
  video,
  isSelected,
  isCurrent,
  meta,
  thumb,
  isExtracting,
  onSelect,
  onDoubleClick,
  cardRefCallback,
}) => {
  const { t } = useApp();
  const resolvedThumb = resolveThumbnailSrc(thumb);

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
        containIntrinsicSize: "auto 44px",
      }}
      className={`h-11 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none ${
        isSelected || isCurrent
          ? "bg-[#26262B] ring-1 ring-white/20"
          : "bg-[#18181C] hover:bg-[#222227]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-12 h-7 rounded overflow-hidden bg-[#0A0A0C] shrink-0 flex items-center justify-center">
          {resolvedThumb ? (
            <img
              src={resolvedThumb}
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
              {video.roverType === "Girl" ? t("galleryFilterFemaleShort") : t("galleryFilterMaleShort")}
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
            {t("galleryExtractingProgress")}
          </span>
        ) : video.isCached ? (
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" title={t("galleryReadyDot")} />
        ) : null}
      </div>
    </div>
  );
};

export const CutsceneListItem = React.memo(CutsceneListItemComponent, (prev, next) => {
  return (
    prev.video.uniqueId === next.video.uniqueId &&
    prev.isSelected === next.isSelected &&
    prev.isCurrent === next.isCurrent &&
    prev.thumb === next.thumb &&
    prev.isExtracting === next.isExtracting &&
    prev.meta?.duration_formatted === next.meta?.duration_formatted &&
    prev.onSelect === next.onSelect &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.cardRefCallback === next.cardRefCallback
  );
});
