import { create } from "zustand";
import { ExtractorAPI, ScannerAPI } from "../../../core/ipc";
import { useTaskStore } from "../../task-monitor/stores/useTaskStore";

export interface ProcessedVideoItem {
  uniqueId: string;
  fullPath: string;
  fileName: string;
  folderName: string;
  categoryPath: string;
  roverType: "Girl" | "Boy" | "Neutral";
  girlOrBoy?: number;
  cgName?: string;
  cgFile?: string;
  isCached?: boolean;
  audio_ready?: boolean;
  canSkip?: boolean;
  aspect?: number;
  categoryFolder?: string;
  hasVideo?: boolean;
  isLevelSequence?: boolean;
  baseCgName?: string;
  fileSize?: number;
  assetKind?: "video" | "sequence";
  videoFormat?: "mp4" | "bk2" | "webm" | "usm" | "uasset";
}

export interface VideoMetaInfo {
  thumbnail: string;
  duration_secs: number;
  duration_formatted: string;
  resolution: string;
}

interface CatalogState {
  items: ProcessedVideoItem[];
  loading: boolean;
  selectedFolder: string;
  searchQuery: string;
  roverFilter: "all" | "Girl" | "Boy";
  assetKindFilter: "video" | "sequence" | "all";
  viewMode: "grid" | "list";

  thumbnails: Record<string, string>;
  videoMetas: Record<string, VideoMetaInfo>;

  setItems: (items: ProcessedVideoItem[]) => void;
  setLoading: (loading: boolean) => void;
  setSelectedFolder: (folder: string) => void;
  setSearchQuery: (query: string) => void;
  setRoverFilter: (filter: "all" | "Girl" | "Boy") => void;
  setAssetKindFilter: (filter: "video" | "sequence" | "all") => void;
  setViewMode: (mode: "grid" | "list") => void;
  updateItem: (key: string, patch: Partial<ProcessedVideoItem>) => void;
  setThumbnailsBatch: (batch: Record<string, string>) => void;
  setVideoMetasBatch: (batch: Record<string, VideoMetaInfo>) => void;
  fetchCatalog: (exportDir?: string) => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  loading: false,
  selectedFolder: "all",
  searchQuery: "",
  roverFilter: "all",
  assetKindFilter: "all",
  viewMode: "grid",
  thumbnails: {},
  videoMetas: {},

  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setRoverFilter: (roverFilter) => set({ roverFilter }),
  setAssetKindFilter: (assetKindFilter) => set({ assetKindFilter }),
  setViewMode: (viewMode) => set({ viewMode }),
  setThumbnailsBatch: (batch) =>
    set((state) => ({ thumbnails: { ...state.thumbnails, ...batch } })),
  setVideoMetasBatch: (batch) =>
    set((state) => ({ videoMetas: { ...state.videoMetas, ...batch } })),

  updateItem: (key, patch) => {
    set((state) => {
      const hasUnique = state.items.some((i) => i.uniqueId === key);
      return {
        items: state.items.map((item) => {
          if (hasUnique) {
            return item.uniqueId === key ? { ...item, ...patch } : item;
          }
          if (item.cgFile === key || item.fullPath === key || item.cgName === key) {
            return { ...item, ...patch };
          }
          return item;
        }),
      };
    });
  },

  fetchCatalog: async (exportDir?: string) => {
    if (get().loading) return;
    const appendLog = useTaskStore.getState().appendLog;
    set({ loading: true });
    appendLog({
      message: "Scanning and indexing cutscene database and system cache...",
      level: "info",
    });

    try {
      // 1. Try to load full game catalog from CUE4Parse Worker daemon
      const catalog = await ExtractorAPI.getFullCatalog();
      if (catalog && catalog.length > 0) {
        const itemMap = new Map<string, ProcessedVideoItem>();

        for (const item of catalog) {
          let roverType: "Girl" | "Boy" | "Neutral" = "Neutral";
          if (item.girl_or_boy === 0) {
            roverType = "Girl";
          } else if (item.girl_or_boy === 1) {
            roverType = "Boy";
          } else {
            const lowerFile = (item.cg_file || "").toLowerCase();
            if (
              lowerFile.includes("nvzhu") ||
              lowerFile.includes("girl") ||
              lowerFile.includes("_nv_") ||
              lowerFile.includes("_nv.")
            ) {
              roverType = "Girl";
            } else if (
              lowerFile.includes("nanzhu") ||
              lowerFile.includes("boy") ||
              lowerFile.includes("_nan_") ||
              lowerFile.includes("_nan.")
            ) {
              roverType = "Boy";
            }
          }

          // Normalize folder structure to forward slashes
          const normCategoryFolder = (item.category_folder || "")
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");

          const folderName =
            normCategoryFolder ||
            (item.is_cached ? "cached" : "Aki/Movies");

          const effectiveFullPath = item.local_video_path || item.cg_file;
          const baseName = (item.base_cg_name || item.cg_name || "video").trim();
          const cleanFolder = normCategoryFolder.toLowerCase();
          const dedupeKey = `${baseName.toLowerCase()}_${roverType}_${cleanFolder}`;

          const existing = itemMap.get(dedupeKey);
          if (existing) {
            const shouldUpgrade =
              (!existing.hasVideo && item.has_video) ||
              (!existing.isCached && item.is_cached) ||
              (!existing.fullPath.toLowerCase().endsWith(".mp4") &&
                (effectiveFullPath.toLowerCase().endsWith(".mp4") || effectiveFullPath.toLowerCase().endsWith(".bk2")));

            if (shouldUpgrade) {
              itemMap.set(dedupeKey, {
                ...existing,
                fullPath: effectiveFullPath,
                cgFile: item.cg_file || existing.cgFile,
                isCached: item.is_cached || existing.isCached,
                hasVideo: item.has_video || existing.hasVideo,
                audio_ready: item.audio_ready || existing.audio_ready,
                fileSize: item.file_size ?? existing.fileSize,
                videoFormat: (item.video_format as any) || existing.videoFormat,
                assetKind: item.has_video || item.is_cached ? "video" : existing.assetKind,
                isLevelSequence: !item.has_video && existing.isLevelSequence,
              });
            }
          } else {
            itemMap.set(dedupeKey, {
              uniqueId: dedupeKey,
              fullPath: effectiveFullPath,
              fileName: item.cg_name,
              folderName,
              categoryPath: item.cg_file,
              roverType,
              girlOrBoy: item.girl_or_boy,
              cgName: item.cg_name,
              cgFile: item.cg_file,
              isCached: item.is_cached,
              audio_ready: item.audio_ready,
              canSkip: item.can_skip,
              aspect: item.aspect,
              categoryFolder: normCategoryFolder,
              hasVideo: item.has_video,
              isLevelSequence: item.is_level_sequence,
              baseCgName: item.base_cg_name || item.cg_name,
              fileSize: item.file_size ?? undefined,
              assetKind: (item.asset_kind as "video" | "sequence") || (item.has_video ? "video" : "sequence"),
              videoFormat: (item.video_format as any) || (item.cg_file?.toLowerCase().endsWith(".mp4") ? "mp4" : item.cg_file?.toLowerCase().endsWith(".bk2") ? "bk2" : "uasset"),
            });
          }
        }

        const mapped = Array.from(itemMap.values());
        set({ items: mapped, loading: false });
        appendLog({
          message: `Loaded ${mapped.length} game cutscenes successfully`,
          level: "success",
        });
        return;
      }

      // 2. Fallback: Scan export directory if available
      if (exportDir) {
        const rawFiles = await ScannerAPI.getExportedVideos(exportDir);
        const fallbackMap = new Map<string, ProcessedVideoItem>();

        for (const raw of rawFiles) {
          const norm = raw.replace(/\\/g, "/");
          const parts = norm.split("/").filter(Boolean);
          const fileName = parts[parts.length - 1];

          // Compute relative folder under exportDir
          const normExport = exportDir.replace(/\\/g, "/");
          let relPath = "";
          if (norm.startsWith(normExport)) {
            relPath = norm.substring(normExport.length).replace(/^\/+/, "");
          }
          const relParts = relPath.split("/").filter(Boolean);
          const folderParts = relParts.length > 1 ? relParts.slice(0, -1) : ["Aki/Movies"];
          let folderName = folderParts.join("/");
          if (folderName.startsWith("Movies/") || folderName.startsWith("Sequence/")) {
            folderName = "Aki/" + folderName;
          } else if (!folderName.startsWith("Aki/")) {
            folderName = "Aki/Movies/" + folderName;
          }

          const lower = fileName.toLowerCase();
          let roverType: "Girl" | "Boy" | "Neutral" = "Neutral";
          if (lower.includes("nvzhu") || lower.includes("girl")) {
            roverType = "Girl";
          } else if (lower.includes("nanzhu") || lower.includes("boy")) {
            roverType = "Boy";
          }

          const uniqueId = `${fileName}_${roverType}_${folderName}_${norm}`;
          if (!fallbackMap.has(uniqueId)) {
            fallbackMap.set(uniqueId, {
              uniqueId,
              fullPath: norm,
              fileName,
              folderName,
              categoryPath: parts.slice(0, -1).join("/"),
              roverType,
              isCached: true,
              hasVideo: true,
              isLevelSequence: false,
              categoryFolder: folderName,
            });
          }
        }

        const fallbackItems = Array.from(fallbackMap.values());
        set({ items: fallbackItems, loading: false });
        appendLog({
          message: `Loaded ${fallbackItems.length} videos from export directory ${exportDir}`,
          level: "success",
        });
      } else {
        set({ items: [], loading: false });
      }
    } catch (e) {
      const rawErr = String(e);
      const cleanErr = rawErr.split("(").join("").split(")").join("").split("[").join("").split("]").join("");
      const errMsg = `Failed to load cutscenes: ${cleanErr}`;
      console.error(errMsg);
      appendLog({ message: errMsg, level: "error" });
      set({ loading: false });
    }
  },
}));
