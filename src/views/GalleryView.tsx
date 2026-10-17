import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";
import { ScannerAPI, ExtractorAPI, RendererAPI } from "@/core/ipc";
import { useApp } from "@/context/AppContext";
import { useTaskStore } from "@/features/task-monitor/stores/useTaskStore";
import { useExtractionStore } from "@/features/catalog/stores/useExtractionStore";
import { useQueueStore } from "@/features/queue/stores/useQueueStore";
import {
  useCatalogStore,
  type ProcessedVideoItem,
  type VideoMetaInfo,
} from "@/features/catalog/stores/useCatalogStore";
import { GalleryToolbar } from "@/features/gallery/components/GalleryToolbar";
import { CutsceneGrid } from "@/features/gallery/components/CutsceneGrid";

export type { ProcessedVideoItem, VideoMetaInfo };

interface GalleryViewProps {
  selectedFile: string | null;
  selectedFiles: Set<string>;
  onSelectVideo: (
    video: ProcessedVideoItem | null,
    meta?: VideoMetaInfo | null,
    isMultiSelect?: boolean
  ) => void;
  onOpenQuickLook: (video: ProcessedVideoItem, meta?: VideoMetaInfo | null) => void;
  refreshTrigger?: number;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  selectedFile,
  selectedFiles,
  onSelectVideo,
  onOpenQuickLook,
  refreshTrigger = 0,
  isInspectorOpen = true,
  onToggleInspector,
}) => {
  const { config, playSound, t } = useApp();
  const appendLog = useTaskStore((state) => state.appendLog);

  const items = useCatalogStore((state) => state.items);
  const loading = useCatalogStore((state) => state.loading);
  const selectedFolder = useCatalogStore((state) => state.selectedFolder);
  const searchQuery = useCatalogStore((state) => state.searchQuery);
  const setSearchQuery = useCatalogStore((state) => state.setSearchQuery);
  const roverFilter = useCatalogStore((state) => state.roverFilter);
  const setRoverFilter = useCatalogStore((state) => state.setRoverFilter);
  const assetKindFilter = useCatalogStore((state) => state.assetKindFilter);
  const setAssetKindFilter = useCatalogStore((state) => state.setAssetKindFilter);
  const viewMode = useCatalogStore((state) => state.viewMode);
  const setViewMode = useCatalogStore((state) => state.setViewMode);
  const updateCatalogItem = useCatalogStore((state) => state.updateItem);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);

  const [searchMode, setSearchMode] = useState<"name" | "dialogue">("name");
  const [dialogueMatches, setDialogueMatches] = useState<Map<string, string>>(new Map());
  const [hoverScrub, setHoverScrub] = useState<Record<string, number>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [toolbarMode, setToolbarMode] = useState<"full" | "compact" | "icon">("full");
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        let nextMode: "full" | "compact" | "icon" = "full";
        if (width < 540) {
          nextMode = "icon";
        } else if (width < 780) {
          nextMode = "compact";
        } else {
          nextMode = "full";
        }
        setToolbarMode((prev) => (prev !== nextMode ? nextMode : prev));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [videoMetas, setVideoMetas] = useState<Record<string, VideoMetaInfo>>({});
  const [extractingItems, setExtractingItems] = useState<Record<string, boolean>>({});
  const activeRequestIdRef = useRef<string | null>(null);
  const attemptedKeysRef = useRef<Set<string>>(new Set());

  // Listen to external catalog scan requests
  useEffect(() => {
    attemptedKeysRef.current.clear();
    if (config.export_dir) {
      fetchCatalog(config.export_dir);
    }
  }, [config.export_dir, refreshTrigger, fetchCatalog]);

  // Dialogue Search Debouncer
  useEffect(() => {
    if (searchMode !== "dialogue" || !searchQuery.trim()) {
      setDialogueMatches(new Map());
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await RendererAPI.searchDialogue(searchQuery.trim(), config.subtitle_lang || "th");
        const map = new Map<string, string>();
        for (const r of results) {
          map.set(r.cg_name.toLowerCase(), r.content);
        }
        setDialogueMatches(map);
      } catch (err) {
        console.error("Dialogue search failed:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, config.subtitle_lang]);

  // Total Counts for Asset Kind Badges
  const { videoCount, sequenceCount, totalKindCount } = useMemo(() => {
    let vCount = 0;
    let sCount = 0;
    for (const v of items) {
      if (selectedFolder && selectedFolder !== "all") {
        if (selectedFolder === "cached" || selectedFolder === "คลังในเครื่อง") {
          if (!v.isCached) continue;
        } else {
          const itemFolder = (v.categoryFolder || v.folderName || "").replace(/\\/g, "/");
          const normSelected = selectedFolder.replace(/\\/g, "/");
          const matches =
            itemFolder === normSelected ||
            itemFolder.startsWith(`${normSelected}/`) ||
            itemFolder.endsWith(`/${normSelected}`) ||
            itemFolder.includes(`/${normSelected}/`);
          if (!matches) continue;
        }
      }
      const targetGender = roverFilter;
      if (targetGender && targetGender !== "all" && v.roverType !== "Neutral") {
        if (targetGender === "Girl" && v.roverType === "Boy") continue;
        if (targetGender === "Boy" && v.roverType === "Girl") continue;
      }
      if (v.hasVideo || v.assetKind === "video") {
        vCount++;
      } else {
        sCount++;
      }
    }
    return {
      videoCount: vCount,
      sequenceCount: sCount,
      totalKindCount: vCount + sCount,
    };
  }, [items, selectedFolder, roverFilter]);

  // Main Filtered Cutscenes
  const filteredVideos = useMemo(() => {
    return items.filter((v) => {
      // 1. Asset Kind Filter
      if (assetKindFilter === "video" && !v.hasVideo && v.assetKind !== "video") {
        return false;
      }
      if (assetKindFilter === "sequence" && (v.hasVideo || v.assetKind === "video")) {
        return false;
      }

      // 2. Rover Protagonist Gender Filter
      const targetGender = roverFilter;
      if (targetGender && targetGender !== "all" && v.roverType !== "Neutral") {
        if (targetGender === "Girl" && v.roverType === "Boy") return false;
        if (targetGender === "Boy" && v.roverType === "Girl") return false;
      }

      // 3. Folder Navigation Filter
      if (selectedFolder && selectedFolder !== "all") {
        if (selectedFolder === "cached" || selectedFolder === "คลังในเครื่อง") {
          if (!v.isCached) return false;
        } else {
          const itemFolder = (v.categoryFolder || v.folderName || "").replace(/\\/g, "/");
          const normSelected = selectedFolder.replace(/\\/g, "/");
          const matches =
            itemFolder === normSelected ||
            itemFolder.startsWith(`${normSelected}/`) ||
            itemFolder.endsWith(`/${normSelected}`) ||
            itemFolder.includes(`/${normSelected}/`);
          if (!matches) return false;
        }
      }

      // 4. Search query matching on filename, folder or dialogue script
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        if (searchMode === "dialogue") {
          const stem = (v.cgName || v.baseCgName || v.fileName).toLowerCase().replace(/\.[^/.]+$/, "");
          if (!dialogueMatches.has(stem)) return false;
        } else {
          const matchesName = v.fileName.toLowerCase().includes(q);
          const matchesFolder = (v.categoryFolder || v.folderName || "").toLowerCase().includes(q);
          if (!matchesName && !matchesFolder) return false;
        }
      }

      return true;
    });
  }, [items, roverFilter, selectedFolder, searchQuery, searchMode, dialogueMatches, assetKindFilter]);

  // Reset scroll position and auto-sync selection
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    if (filteredVideos.length > 0) {
      const stillInFiltered = selectedFile
        ? filteredVideos.some(
            (v) =>
              v.uniqueId === selectedFile ||
              v.fullPath === selectedFile ||
              v.cgFile === selectedFile ||
              v.cgName === selectedFile
          )
        : false;

      if (!stillInFiltered) {
        const first = filteredVideos[0];
        const thumb =
          thumbnails[first.uniqueId] ||
          (first.fullPath && thumbnails[first.fullPath]);
        const meta =
          videoMetas[first.fullPath] ||
          (thumb
            ? {
                thumbnail: thumb,
                duration_secs: 0,
                duration_formatted: "",
                resolution: "1080p",
              }
            : null);
        onSelectVideo(first, meta, false);
      }
    } else if (selectedFile) {
      onSelectVideo(null, null, false);
    }
  }, [selectedFolder, assetKindFilter, roverFilter, filteredVideos.length]);

  const inFlightExtractionRef = useRef<Map<string, Promise<ProcessedVideoItem>>>(new Map());

  // Handle on-demand extraction of a cutscene
  const extractCutsceneIfNeeded = useCallback(
    async (item: ProcessedVideoItem): Promise<ProcessedVideoItem> => {
      if (item.isCached || !item.cgName || !item.cgFile) {
        return item;
      }

      const dedupeKey = item.uniqueId || item.cgFile || item.cgName;
      const running = inFlightExtractionRef.current.get(dedupeKey);
      if (running) {
        return running;
      }

      const extractPromise = (async () => {
        const reqId = crypto.randomUUID();
        activeRequestIdRef.current = reqId;
        setExtractingItems((prev) => ({
          ...prev,
          [item.uniqueId]: true,
          ...(item.cgFile ? { [item.cgFile]: true } : {}),
        }));

        useExtractionStore.getState().startExtraction(item.fileName || item.cgName || "", reqId, "extraction");

        appendLog({
          message: `เริ่มดึงไฟล์คัตซีน ${item.fileName} จากแพ็กเกจเกม รหัสคำขอ ${reqId}`,
          level: "info",
        });

        try {
          const soundEvents = await RendererAPI.getVideoAudioEvent(item.cgName || item.fileName || "").catch(() => []);
          const result = await ExtractorAPI.extractCutsceneOnDemand(
            item.cgName || "",
            item.cgFile || "",
            soundEvents,
            reqId
          );

          useExtractionStore.getState().finishExtraction();

          appendLog({
            message: result.video_file
              ? `สกัดคัตซีน ${item.fileName} สำเร็จ บันทึกลงแคช ${result.video_file}`
              : `สกัดข้อมูลและไฟล์เสียงสำหรับ 3D Sequence ${item.fileName} สำเร็จ`,
            level: "success",
          });

          let effectiveThumb = result.thumbnail_base64;
          if (effectiveThumb) {
            setThumbnails((prev) => ({
              ...prev,
              [item.uniqueId]: effectiveThumb!,
              ...(result.video_file ? { [result.video_file]: effectiveThumb! } : {}),
              ...(item.fullPath ? { [item.fullPath]: effectiveThumb! } : {}),
            }));
          } else if (result.video_file) {
            try {
              const generatedThumb = await ScannerAPI.getVideoThumbnail(result.video_file);
              if (generatedThumb) {
                effectiveThumb = generatedThumb;
                setThumbnails((prev) => ({
                  ...prev,
                  [item.uniqueId]: generatedThumb,
                  [result.video_file]: generatedThumb,
                  ...(item.fullPath ? { [item.fullPath]: generatedThumb } : {}),
                }));
              }
            } catch {}
          }

          let meta = result.video_file ? await ScannerAPI.getVideoMeta(result.video_file).catch(() => null) : null;
          if (!meta && effectiveThumb) {
            meta = {
              thumbnail: effectiveThumb,
              duration_secs: 0,
              duration_formatted: "",
              resolution: "1080p",
            };
          }
          if (meta && result.video_file) {
            setVideoMetas((prev) => ({ ...prev, [result.video_file]: meta! }));
          }

          const hasExtractedVid = Boolean(result.video_file);
          const updated: ProcessedVideoItem = {
            ...item,
            fullPath: result.video_file || item.fullPath,
            isCached: hasExtractedVid,
            audio_ready: true,
            folderName: hasExtractedVid ? "คลังในเครื่อง" : item.folderName,
          };

          updateCatalogItem(item.uniqueId, updated);
          onSelectVideo(updated, meta || videoMetas[updated.fullPath] || null, false);
          playSound("success");
          return updated;
        } catch (err) {
          if (
            String(err).includes("CANCELLED") ||
            String(err).includes("ยกเลิก") ||
            useExtractionStore.getState().isCancelled
          ) {
            return item;
          }
          useExtractionStore.getState().setError(String(err));
          const errorText = String(err);
          appendLog({
            message: `การสกัดคัตซีน ${item.fileName} ล้มเหลว: ${errorText}`,
            level: "error",
          });
          toast.error(`ดึงไฟล์คัตซีนไม่สำเร็จ: ${errorText}`);
          throw err;
        } finally {
          setExtractingItems((prev) => {
            const next = { ...prev };
            delete next[item.uniqueId];
            if (item.cgFile) delete next[item.cgFile];
            return next;
          });
          if (activeRequestIdRef.current === reqId) {
            activeRequestIdRef.current = null;
          }
          inFlightExtractionRef.current.delete(dedupeKey);
        }
      })();

      inFlightExtractionRef.current.set(dedupeKey, extractPromise);
      return extractPromise;
    },
    [playSound, onSelectVideo, videoMetas, appendLog, updateCatalogItem]
  );

  // Single Click: Immediately select cutscene
  const handleSelect = (video: ProcessedVideoItem, e: React.MouseEvent) => {
    playSound("click");
    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    const thumb =
      thumbnails[video.uniqueId] ||
      (video.fullPath && thumbnails[video.fullPath]) ||
      (video.cgFile && thumbnails[video.cgFile]);
    const existingMeta = videoMetas[video.fullPath];
    const effectiveMeta: VideoMetaInfo | null = existingMeta || (thumb ? {
      thumbnail: thumb,
      duration_secs: 0,
      duration_formatted: "",
      resolution: "1080p",
    } : null);

    appendLog({
      message: `เลือกคัตซีน ${video.fileName || video.cgName} รหัส ${video.uniqueId || video.cgName}`,
      level: "info",
    });

    onSelectVideo(video, effectiveMeta, isMulti);
  };

  // Double Click: Open Quick Look preview
  const handleDoubleClick = async (video: ProcessedVideoItem) => {
    playSound("click");
    appendLog({
      message: `เปิดดูตัวอย่างคัตซีน ${video.fileName || video.cgName}`,
      level: "info",
    });
    const thumb =
      thumbnails[video.uniqueId] ||
      (video.fullPath && thumbnails[video.fullPath]) ||
      (video.cgFile && thumbnails[video.cgFile]);
    const effectiveMeta = videoMetas[video.fullPath] || (thumb ? {
      thumbnail: thumb,
      duration_secs: 0,
      duration_formatted: "",
      resolution: "1080p",
    } : null);

    if (!video.isCached && video.cgName) {
      if (video.isLevelSequence && !video.hasVideo) {
        toast.info(`คัตซีน ${video.fileName} เป็น LevelSequence เรนเดอร์ 3D ในเอนจินเกม`);
        onOpenQuickLook(video, effectiveMeta);
        return;
      }
      toast.info(`กำลังสกัดไฟล์คัตซีน ${video.fileName} จากคลังเกม`);
      try {
        const ready = await extractCutsceneIfNeeded(video);
        if (ready && ready.isCached) {
          onOpenQuickLook(ready, videoMetas[ready.fullPath] || effectiveMeta);
        }
      } catch (err) {
        if (
          String(err).includes("CANCELLED") ||
          String(err).includes("ยกเลิก") ||
          useExtractionStore.getState().isCancelled
        ) {
          return;
        }
        toast.error("ไม่สามารถเปิดวิดีโอตัวอย่างได้");
      }
    } else {
      onOpenQuickLook(video, effectiveMeta);
    }
  };

  // Spacebar Quick Look key listener
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.code === "Space" && selectedFile) {
        e.preventDefault();
        const item = items.find(
          (v) =>
            v.uniqueId === selectedFile ||
            v.fullPath === selectedFile ||
            v.cgFile === selectedFile ||
            v.cgName === selectedFile
        );
        if (item) {
          await handleDoubleClick(item);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFile, items, handleDoubleClick]);

  // Parallel thumbnail & metadata fetcher for visible cutscenes
  useEffect(() => {
    let active = true;
    const targetVideos = filteredVideos.filter((v) => {
      const key = v.uniqueId;
      return key && !thumbnails[key] && !attemptedKeysRef.current.has(key);
    });

    if (targetVideos.length === 0) return;

    const BATCH_SIZE = 6;
    let idx = 0;

    const loadBatch = async () => {
      while (active && idx < targetVideos.length) {
        const batch = targetVideos.slice(idx, idx + BATCH_SIZE);
        idx += BATCH_SIZE;

        await Promise.all(
          batch.map(async (v) => {
            const key = v.uniqueId;
            if (!key) return;
            attemptedKeysRef.current.add(key);

            try {
              let thumbFound = false;
              if (v.isCached) {
                const [thumb, meta] = await Promise.all([
                  ScannerAPI.getVideoThumbnail(v.fullPath).catch(() => null),
                  ScannerAPI.getVideoMeta(v.fullPath).catch(() => null),
                ]);
                if (active) {
                  if (thumb) {
                    thumbFound = true;
                    setThumbnails((prev) => ({
                      ...prev,
                      [v.uniqueId]: thumb,
                      [v.fullPath]: thumb,
                    }));
                  }
                  if (meta) {
                    setVideoMetas((prev) => ({ ...prev, [v.fullPath]: meta }));
                  }
                }
              } else if (v.cgName) {
                const thumb = await ExtractorAPI.getCutsceneThumbnail(
                  v.cgName,
                  v.cgFile || "",
                  v.girlOrBoy ?? -1
                ).catch(() => null);
                if (active && thumb) {
                  thumbFound = true;
                  setThumbnails((prev) => ({
                    ...prev,
                    [v.uniqueId]: thumb,
                    ...(v.fullPath ? { [v.fullPath]: thumb } : {}),
                  }));
                }
              }
              if (!thumbFound) {
                attemptedKeysRef.current.delete(key);
              }
            } catch {
              attemptedKeysRef.current.delete(key);
            }
          })
        );
      }
    };

    loadBatch();
    return () => {
      active = false;
    };
  }, [filteredVideos, thumbnails]);

  // Sync selected video metadata when its thumbnail arrives
  useEffect(() => {
    if (selectedFile) {
      const key = selectedFile;
      const thumb =
        thumbnails[key] ||
        (key ? thumbnails[key.toLowerCase()] : undefined);
      if (thumb && (!videoMetas[key] || !videoMetas[key].thumbnail)) {
        setVideoMetas((prev) => ({
          ...prev,
          [key]: {
            thumbnail: thumb,
            duration_secs: prev[key]?.duration_secs || 0,
            duration_formatted: prev[key]?.duration_formatted || "",
            resolution: prev[key]?.resolution || "1080p",
          },
        }));
      }
    }
  }, [thumbnails, selectedFile, videoMetas]);

  const handleQuickAddToQueue = (e: React.MouseEvent, video: ProcessedVideoItem) => {
    e.stopPropagation();
    playSound("click");
    useQueueStore.getState().addToQueue([
      {
        cutscenePath: video.fullPath || video.cgFile || video.fileName,
        fileName: video.fileName,
        folderName: video.folderName,
        locale: config.locale_selection || "ja",
        gender: (config.char_selection as "Girl" | "Boy") || "Girl",
        subtitleMode: "Hard-sub",
        renderResolution: config.render_resolution || "1920x1080",
      },
    ]);
    toast.success(`เพิ่ม ${video.fileName} เข้าคิวเรนเดอร์เรียบร้อยแล้ว`);
  };

  const handleRoverFilterChange = (gender: "all" | "Girl" | "Boy") => {
    playSound("click");
    setRoverFilter(gender);
    appendLog({
      message: `เปลี่ยนตัวกรองเพศเป็น ${gender === "all" ? "ทุกเพศ" : gender === "Girl" ? "โรเวอร์หญิง" : "โรเวอร์ชาย"}`,
      level: "info",
    });
  };

  const handleAssetKindChange = (kind: "all" | "video" | "sequence") => {
    playSound("click");
    setAssetKindFilter(kind);
    const label =
      kind === "video"
        ? "วิดีโอภาพยนตร์"
        : kind === "sequence"
        ? "ซีน 3D และเสียง"
        : "คัตซีนทั้งหมด";
    appendLog({
      message: `เปลี่ยนตัวกรองเป็น ${label}`,
      level: "info",
    });
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-w-0 h-full bg-[#0E0E11] select-none">
      <GalleryToolbar
        toolbarMode={toolbarMode}
        isSearchOverlayOpen={isSearchOverlayOpen}
        setIsSearchOverlayOpen={setIsSearchOverlayOpen}
        assetKindFilter={assetKindFilter}
        onAssetKindChange={handleAssetKindChange}
        videoCount={videoCount}
        sequenceCount={sequenceCount}
        totalKindCount={totalKindCount}
        roverFilter={roverFilter}
        charSelection={config.char_selection}
        onRoverFilterChange={handleRoverFilterChange}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchMode={searchMode}
        onToggleSearchMode={() => {
          playSound("click");
          setSearchMode(searchMode === "name" ? "dialogue" : "name");
        }}
        loading={loading}
        onRefresh={() => {
          playSound("click");
          fetchCatalog(config.export_dir);
        }}
        viewMode={viewMode}
        onViewModeChange={(m) => {
          playSound("click");
          setViewMode(m);
        }}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={onToggleInspector}
      />

      {/* Main Cutscenes Canvas */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#0E0E11]">
        {/* Directory Breadcrumb */}
        <div className="flex items-center justify-between mb-3 px-1 text-xs text-[#8E8E93]">
          <div className="flex items-center gap-1.5 font-mono truncate">
            <FolderOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-white font-medium truncate">
              {!selectedFolder || selectedFolder === "all" ? "คลังคัตซีนทั้งหมด" : selectedFolder.replace(/\\/g, " / ")}
            </span>
            <span className="text-[#52525B]">/</span>
            <span className="text-[11px] text-[#71717A] shrink-0 font-sans">
              {filteredVideos.length} รายการ
            </span>
          </div>
        </div>

        <CutsceneGrid
          loading={loading}
          totalCatalogCount={items.length}
          filteredVideos={filteredVideos}
          selectedFile={selectedFile}
          selectedFiles={selectedFiles}
          videoMetas={videoMetas}
          thumbnails={thumbnails}
          extractingItems={extractingItems}
          hoverScrub={hoverScrub}
          setHoverScrub={setHoverScrub}
          dialogueMatches={dialogueMatches}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
          onQuickAddToQueue={handleQuickAddToQueue}
          viewMode={viewMode}
          noMatchingVideosLabel={t("noMatchingVideos")}
        />
      </div>
    </div>
  );
};
