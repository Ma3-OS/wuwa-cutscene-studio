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
import { safeUUID } from "@/utils/uuid";

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

  const thumbnails = useCatalogStore((state) => state.thumbnails);
  const videoMetas = useCatalogStore((state) => state.videoMetas);
  const setThumbnailsBatch = useCatalogStore((state) => state.setThumbnailsBatch);
  const setVideoMetasBatch = useCatalogStore((state) => state.setVideoMetasBatch);

  const thumbnailsRef = useRef<Record<string, string>>(thumbnails);
  const videoMetasRef = useRef<Record<string, VideoMetaInfo>>(videoMetas);

  useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);

  useEffect(() => {
    videoMetasRef.current = videoMetas;
  }, [videoMetas]);

  const [extractingItems, setExtractingItems] = useState<Record<string, boolean>>({});
  const activeRequestIdRef = useRef<string | null>(null);
  const attemptedKeysRef = useRef<Set<string>>(new Set());

  // Viewport Lazy Fetching and Dwell Queue state refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElementsMap = useRef<Map<Element, ProcessedVideoItem>>(new Map());
  const dwellTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queueRef = useRef<ProcessedVideoItem[]>([]);
  const activeWorkersRef = useRef<number>(0);
  const pendingBatchThumbsRef = useRef<Record<string, string>>({});
  const pendingBatchMetasRef = useRef<Record<string, VideoMetaInfo>>({});
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen to external catalog scan requests
  useEffect(() => {
    attemptedKeysRef.current.clear();
    if (config.export_dir) {
      fetchCatalog(config.export_dir);
    }
  }, [config.export_dir, refreshTrigger, fetchCatalog]);

  // Dialogue Search Debouncer
  useEffect(() => {
    if (!searchQuery.trim()) {
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
  }, [searchQuery, config.subtitle_lang]);

  // Total Counts for Asset Kind Badges
  const { videoCount, sequenceCount, totalKindCount } = useMemo(() => {
    let vCount = 0;
    let sCount = 0;
    for (const v of items) {
      if (selectedFolder && selectedFolder !== "all") {
        if (selectedFolder === "cached") {
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
        if (selectedFolder === "cached") {
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
        const matchesName = v.fileName.toLowerCase().includes(q);
        const matchesCgName = v.cgName ? v.cgName.toLowerCase().includes(q) : false;
        const matchesFolder = (v.categoryFolder || v.folderName || "").toLowerCase().includes(q);
        const stem = (v.cgName || v.baseCgName || v.fileName).toLowerCase().replace(/\.[^/.]+$/, "");
        const matchesDialogue = dialogueMatches.has(stem);

        if (!matchesName && !matchesCgName && !matchesFolder && !matchesDialogue) {
          return false;
        }
      }

      return true;
    });
  }, [items, roverFilter, selectedFolder, searchQuery, dialogueMatches, assetKindFilter]);

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
        const reqId = safeUUID();
        activeRequestIdRef.current = reqId;
        setExtractingItems((prev) => ({
          ...prev,
          [item.uniqueId]: true,
          ...(item.cgFile ? { [item.cgFile]: true } : {}),
        }));

        useExtractionStore.getState().startExtraction(item.fileName || item.cgName || "", reqId, "extraction");

        appendLog({
          message: `Extracting cutscene ${item.fileName} from game packages, request ID ${reqId}`,
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
              ? `Extracted cutscene ${item.fileName} successfully to cache`
              : `Extracted audio and data for 3D Sequence ${item.fileName} successfully`,
            level: "success",
          });

          let effectiveThumb = result.thumbnail_base64;
          if (effectiveThumb) {
            setThumbnailsBatch({
              [item.uniqueId]: effectiveThumb!,
              ...(result.video_file ? { [result.video_file]: effectiveThumb! } : {}),
              ...(item.fullPath ? { [item.fullPath]: effectiveThumb! } : {}),
            });
          } else if (result.video_file) {
            try {
              const generatedThumb = await ScannerAPI.getVideoThumbnail(result.video_file);
              if (generatedThumb) {
                effectiveThumb = generatedThumb;
                setThumbnailsBatch({
                  [item.uniqueId]: generatedThumb,
                  [result.video_file]: generatedThumb,
                  ...(item.fullPath ? { [item.fullPath]: generatedThumb } : {}),
                });
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
            setVideoMetasBatch({ [result.video_file]: meta! });
          }

          const hasExtractedVid = Boolean(result.video_file);
          const updated: ProcessedVideoItem = {
            ...item,
            fullPath: result.video_file || item.fullPath,
            isCached: hasExtractedVid,
            audio_ready: true,
            folderName: hasExtractedVid ? "cached" : item.folderName,
          };

          updateCatalogItem(item.uniqueId, updated);
          onSelectVideo(updated, meta || videoMetas[updated.fullPath] || null, false);
          playSound("success");
          return updated;
        } catch (err) {
          if (
            String(err).includes("CANCELLED") ||
            String(err).toLowerCase().includes("cancel") ||
            useExtractionStore.getState().isCancelled
          ) {
            return item;
          }
          useExtractionStore.getState().setError(String(err));
          const errorText = String(err);
          appendLog({
            message: `Extraction failed for ${item.fileName}: ${errorText}`,
            level: "error",
          });
          toast.error(`${t("toastExtractingCutscene")}: ${errorText}`);
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

  const flushBatch = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    const thumbsToFlush = { ...pendingBatchThumbsRef.current };
    const metasToFlush = { ...pendingBatchMetasRef.current };
    const hasThumbs = Object.keys(thumbsToFlush).length > 0;
    const hasMetas = Object.keys(metasToFlush).length > 0;

    if (hasThumbs) {
      pendingBatchThumbsRef.current = {};
      thumbnailsRef.current = { ...thumbnailsRef.current, ...thumbsToFlush };
      setThumbnailsBatch(thumbsToFlush);
    }
    if (hasMetas) {
      pendingBatchMetasRef.current = {};
      videoMetasRef.current = { ...videoMetasRef.current, ...metasToFlush };
      setVideoMetasBatch(metasToFlush);
    }
  }, [setThumbnailsBatch, setVideoMetasBatch]);

  const scheduleBatchFlush = useCallback(() => {
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        flushBatch();
      }, 120);
    }
  }, [flushBatch]);

  const triggerWorker = useCallback(() => {
    const MAX_CONCURRENT = 4;
    while (activeWorkersRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const nextVideo = queueRef.current.shift();
      if (!nextVideo) break;
      const key = nextVideo.uniqueId;
      if (!key || thumbnailsRef.current[key] || attemptedKeysRef.current.has(key)) {
        continue;
      }
      attemptedKeysRef.current.add(key);
      activeWorkersRef.current++;

      (async () => {
        try {
          if (nextVideo.isCached) {
            const [thumb, meta] = await Promise.all([
              ScannerAPI.getVideoThumbnail(nextVideo.fullPath).catch(() => null),
              ScannerAPI.getVideoMeta(nextVideo.fullPath).catch(() => null),
            ]);
            if (thumb) {
              pendingBatchThumbsRef.current[nextVideo.uniqueId] = thumb;
              if (nextVideo.fullPath) {
                pendingBatchThumbsRef.current[nextVideo.fullPath] = thumb;
              }
            }
            if (meta) {
              pendingBatchMetasRef.current[nextVideo.fullPath] = meta;
            }
            if (thumb || meta) {
              scheduleBatchFlush();
            }
          } else if (nextVideo.cgName) {
            const thumb = await ExtractorAPI.getCutsceneThumbnail(
              nextVideo.cgName,
              nextVideo.cgFile || "",
              nextVideo.girlOrBoy ?? -1
            ).catch(() => null);
            if (thumb) {
              pendingBatchThumbsRef.current[nextVideo.uniqueId] = thumb;
              if (nextVideo.fullPath) {
                pendingBatchThumbsRef.current[nextVideo.fullPath] = thumb;
              }
              scheduleBatchFlush();
            }
          }
        } catch {
          // Ignore error and prevent hammering
        } finally {
          activeWorkersRef.current--;
          triggerWorker();
        }
      })();
    }
  }, [scheduleBatchFlush]);

  const handleCardRef = useCallback((node: HTMLDivElement | null, video: ProcessedVideoItem) => {
    if (!observerRef.current) return;
    if (node) {
      observedElementsMap.current.set(node, video);
      observerRef.current.observe(node);
    } else {
      for (const [el, v] of observedElementsMap.current.entries()) {
        if (v.uniqueId === video.uniqueId) {
          observedElementsMap.current.delete(el);
          observerRef.current.unobserve(el);
          break;
        }
      }
    }
  }, []);

  // Intersection Observer with 100ms dwell check and LIFO priority queue
  useEffect(() => {
    const root = scrollContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = observedElementsMap.current.get(entry.target);
          if (!video) return;
          const key = video.uniqueId;

          if (entry.isIntersecting) {
            if (thumbnailsRef.current[key] || attemptedKeysRef.current.has(key)) {
              observer.unobserve(entry.target);
              observedElementsMap.current.delete(entry.target);
              return;
            }

            if (!dwellTimersRef.current.has(key)) {
              const timer = setTimeout(() => {
                dwellTimersRef.current.delete(key);
                if (!queueRef.current.some((v) => v.uniqueId === key)) {
                  queueRef.current.unshift(video);
                  triggerWorker();
                }
              }, 100);
              dwellTimersRef.current.set(key, timer);
            }
          } else {
            const timer = dwellTimersRef.current.get(key);
            if (timer) {
              clearTimeout(timer);
              dwellTimersRef.current.delete(key);
            }
            queueRef.current = queueRef.current.filter((v) => v.uniqueId !== key);
          }
        });
      },
      {
        root,
        rootMargin: "250px",
        threshold: 0,
      }
    );

    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
      dwellTimersRef.current.forEach((t) => clearTimeout(t));
      dwellTimersRef.current.clear();
      queueRef.current = [];
    };
  }, [triggerWorker]);

  // Single Click: Immediately select cutscene
  const handleSelect = useCallback((video: ProcessedVideoItem, e: React.MouseEvent) => {
    playSound("click");
    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    const thumb =
      thumbnailsRef.current[video.uniqueId] ||
      (video.fullPath && thumbnailsRef.current[video.fullPath]) ||
      (video.cgFile && thumbnailsRef.current[video.cgFile]);
    const existingMeta = videoMetasRef.current[video.fullPath];
    const effectiveMeta: VideoMetaInfo | null = existingMeta || (thumb ? {
      thumbnail: thumb,
      duration_secs: 0,
      duration_formatted: "",
      resolution: "1080p",
    } : null);

    appendLog({
      message: `Selected cutscene ${video.fileName || video.cgName} (ID: ${video.uniqueId || video.cgName})`,
      level: "info",
    });

    onSelectVideo(video, effectiveMeta, isMulti);
  }, [playSound, appendLog, onSelectVideo]);

  // Double Click: Open Quick Look preview
  const handleDoubleClick = useCallback(async (video: ProcessedVideoItem) => {
    playSound("click");
    appendLog({
      message: `Opened preview for cutscene ${video.fileName || video.cgName}`,
      level: "info",
    });
    const thumb =
      thumbnailsRef.current[video.uniqueId] ||
      (video.fullPath && thumbnailsRef.current[video.fullPath]) ||
      (video.cgFile && thumbnailsRef.current[video.cgFile]);
    const effectiveMeta = videoMetasRef.current[video.fullPath] || (thumb ? {
      thumbnail: thumb,
      duration_secs: 0,
      duration_formatted: "",
      resolution: "1080p",
    } : null);

    if (!video.isCached && video.cgName) {
      if (video.isLevelSequence && !video.hasVideo) {
        toast.info(`${video.fileName} - ${t("inspectorInEngine3D")}`);
        onOpenQuickLook(video, effectiveMeta);
        return;
      }
      toast.info(`${t("galleryExtractingProgress")} ${video.fileName}`);
      try {
        const ready = await extractCutsceneIfNeeded(video);
        if (ready && ready.isCached) {
          onOpenQuickLook(ready, videoMetasRef.current[ready.fullPath] || effectiveMeta);
        }
      } catch (err) {
        if (
          String(err).includes("CANCELLED") ||
          String(err).toLowerCase().includes("cancel") ||
          useExtractionStore.getState().isCancelled
        ) {
          return;
        }
        toast.error(t("toastCannotOpenPreview"));
      }
    } else {
      onOpenQuickLook(video, effectiveMeta);
    }
  }, [playSound, appendLog, onOpenQuickLook, extractCutsceneIfNeeded, t]);

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

  // Sync selected video metadata when its thumbnail arrives
  useEffect(() => {
    if (selectedFile) {
      const key = selectedFile;
      const thumb =
        thumbnails[key] ||
        (key ? thumbnails[key.toLowerCase()] : undefined);
      if (thumb && (!videoMetas[key] || !videoMetas[key].thumbnail)) {
        setVideoMetasBatch({
          [key]: {
            thumbnail: thumb,
            duration_secs: videoMetas[key]?.duration_secs || 0,
            duration_formatted: videoMetas[key]?.duration_formatted || "",
            resolution: videoMetas[key]?.resolution || "1080p",
          },
        });
      }
    }
  }, [thumbnails, selectedFile, videoMetas, setVideoMetasBatch]);

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
        subtitleLang: config.subtitle_lang || "th",
        renderResolution: config.render_resolution || "1920x1080",
      },
    ]);
    toast.success(`${t("toastAddedToQueue")}: ${video.fileName}`);
  };

  const handleRoverFilterChange = (gender: "all" | "Girl" | "Boy") => {
    playSound("click");
    setRoverFilter(gender);
    appendLog({
      message: `Gender filter changed to ${gender}`,
      level: "info",
    });
  };

  const handleAssetKindChange = (kind: "all" | "video" | "sequence") => {
    playSound("click");
    setAssetKindFilter(kind);
    appendLog({
      message: `Asset kind filter changed to ${kind}`,
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
          attemptedKeysRef.current.clear();
          import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("clear_video_index_cache").catch(() => {});
          });
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
              {!selectedFolder || selectedFolder === "all"
                ? t("galleryAllLibrary")
                : selectedFolder === "cached"
                ? t("folderInternalCache")
                : selectedFolder.replace(/\\/g, " / ")}
            </span>
            {filteredVideos.length !== items.length && (
              <>
                <span className="text-[#52525B]">/</span>
                <span className="text-[11px] text-[#71717A] shrink-0 font-sans">
                  {filteredVideos.length} / {items.length} {t("galleryItemsCount")}
                </span>
              </>
            )}
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
          dialogueMatches={dialogueMatches}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
          onQuickAddToQueue={handleQuickAddToQueue}
          cardRefCallback={handleCardRef}
          viewMode={viewMode}
          noMatchingVideosLabel={t("noMatchingVideos")}
        />
      </div>
    </div>
  );
};
