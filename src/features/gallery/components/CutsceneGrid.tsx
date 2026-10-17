import React from "react";
import { Loader2, Film } from "lucide-react";
import { ProcessedVideoItem, VideoMetaInfo } from "@/features/catalog/stores/useCatalogStore";
import { CutsceneCard } from "./CutsceneCard";
import { CutsceneListItem } from "./CutsceneListItem";

interface CutsceneGridProps {
  loading: boolean;
  totalCatalogCount: number;
  filteredVideos: ProcessedVideoItem[];
  selectedFile: string | null;
  selectedFiles: Set<string>;
  videoMetas: Record<string, VideoMetaInfo>;
  thumbnails: Record<string, string>;
  extractingItems: Record<string, boolean>;
  hoverScrub: Record<string, number>;
  setHoverScrub: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dialogueMatches: Map<string, string>;
  onSelect: (video: ProcessedVideoItem, e: React.MouseEvent) => void;
  onDoubleClick: (video: ProcessedVideoItem) => void;
  onQuickAddToQueue: (e: React.MouseEvent, video: ProcessedVideoItem) => void;
  viewMode: "grid" | "list";
  noMatchingVideosLabel: string;
}

export const CutsceneGrid: React.FC<CutsceneGridProps> = ({
  loading,
  totalCatalogCount,
  filteredVideos,
  selectedFile,
  selectedFiles,
  videoMetas,
  thumbnails,
  extractingItems,
  hoverScrub,
  setHoverScrub,
  dialogueMatches,
  onSelect,
  onDoubleClick,
  onQuickAddToQueue,
  viewMode,
  noMatchingVideosLabel,
}) => {
  if (loading && totalCatalogCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#71717A]">
        <Loader2 className="w-7 h-7 animate-spin mb-3 text-white" />
        <p className="text-xs font-mono">กำลังโหลดแคตตาล็อกคัตซีนจากฐานข้อมูลเกม...</p>
      </div>
    );
  }

  if (filteredVideos.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center mb-3 text-[#52525B]">
          <Film className="w-6 h-6 stroke-[1.2]" />
        </div>
        <h3 className="text-xs font-semibold text-white mb-1">
          {noMatchingVideosLabel}
        </h3>
        <p className="text-[11px] text-[#71717A] max-w-sm">
          ไม่พบคัตซีนที่ตรงกับไดเรกทอรีหรือคำค้นหาที่เลือก
        </p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] content-start gap-3.5 pb-6">
        {filteredVideos.map((video) => {
          const uniqueKey = video.uniqueId || `${video.cgFile || video.fullPath}_${video.roverType}`;
          const isSelected =
            selectedFiles.has(video.uniqueId) ||
            selectedFiles.has(video.fullPath) ||
            (video.cgFile ? selectedFiles.has(video.cgFile) : false);
          const isCurrent =
            selectedFile === video.uniqueId ||
            selectedFile === video.fullPath ||
            (video.cgFile ? selectedFile === video.cgFile : false) ||
            (video.cgName ? selectedFile === video.cgName : false);
          const meta = videoMetas[video.fullPath];
          const thumb =
            thumbnails[video.uniqueId] ||
            (video.fullPath && thumbnails[video.fullPath]) ||
            (video.cgFile && thumbnails[video.cgFile]);
          const isExtracting =
            extractingItems[video.uniqueId] ||
            (video.cgFile ? extractingItems[video.cgFile] : false) ||
            false;
          const stem = (video.cgName || video.baseCgName || video.fileName).toLowerCase().replace(/\.[^/.]+$/, "");
          const dialogueMatch = dialogueMatches.get(stem);

          return (
            <CutsceneCard
              key={uniqueKey}
              video={video}
              isSelected={isSelected}
              isCurrent={Boolean(isCurrent)}
              meta={meta}
              thumb={thumb}
              isExtracting={isExtracting}
              hoverScrubPct={hoverScrub[uniqueKey]}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                setHoverScrub((prev) => ({ ...prev, [uniqueKey]: pct }));
              }}
              onMouseLeave={() => {
                setHoverScrub((prev) => {
                  const next = { ...prev };
                  delete next[uniqueKey];
                  return next;
                });
              }}
              onSelect={(e) => onSelect(video, e)}
              onDoubleClick={() => onDoubleClick(video)}
              onQuickAddToQueue={(e) => onQuickAddToQueue(e, video)}
              dialogueMatch={dialogueMatch}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 pb-6">
      {filteredVideos.map((video) => {
        const uniqueKey = video.uniqueId || `${video.cgFile || video.fullPath}_${video.roverType}`;
        const isSelected =
          selectedFiles.has(video.uniqueId) ||
          selectedFiles.has(video.fullPath) ||
          (video.cgFile ? selectedFiles.has(video.cgFile) : false);
        const isCurrent =
          selectedFile === video.uniqueId ||
          selectedFile === video.fullPath ||
          (video.cgFile ? selectedFile === video.cgFile : false) ||
          (video.cgName ? selectedFile === video.cgName : false);
        const meta = videoMetas[video.fullPath];
        const thumb =
          thumbnails[video.uniqueId] ||
          (video.fullPath && thumbnails[video.fullPath]) ||
          (video.cgFile && thumbnails[video.cgFile]);
        const isExtracting =
          extractingItems[video.uniqueId] ||
          (video.cgFile ? extractingItems[video.cgFile] : false) ||
          false;

        return (
          <CutsceneListItem
            key={uniqueKey}
            video={video}
            isSelected={isSelected}
            isCurrent={Boolean(isCurrent)}
            meta={meta}
            thumb={thumb}
            isExtracting={isExtracting}
            onSelect={(e) => onSelect(video, e)}
            onDoubleClick={() => onDoubleClick(video)}
          />
        );
      })}
    </div>
  );
};
