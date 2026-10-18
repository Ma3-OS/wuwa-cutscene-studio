import { create } from "zustand";
import { RendererAPI, ExtractorAPI } from "../../../core/ipc";
import { useCatalogStore } from "../../catalog/stores/useCatalogStore";

export interface QueueItem {
  id: string;
  cutscenePath: string;
  fileName: string;
  folderName: string;
  locale: string;
  gender: "Girl" | "Boy";
  subtitleMode: "None" | "Soft-sub" | "Hard-sub";
  renderResolution: string;
  status: "queued" | "rendering" | "completed" | "failed";
  progress: number;
  outputPath?: string;
  error?: string;
}

interface QueueState {
  items: QueueItem[];
  isProcessing: boolean;
  isParallel: boolean;
  addToQueue: (newItems: Array<Omit<QueueItem, "id" | "status" | "progress">>) => void;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  clearFinished: () => void;
  clearAll: () => void;
  updateAllPendingPresets: (presets: {
    locale?: string;
    gender?: "Girl" | "Boy";
    subtitleMode?: "None" | "Soft-sub" | "Hard-sub";
    renderResolution?: string;
  }) => void;
  setParallel: (parallel: boolean) => void;
  startProcessing: () => Promise<void>;
  pauseProcessing: () => void;
}

import { safeUUID } from "../../../utils/uuid";

const inFlightExtractions = new Map<string, Promise<{ video_file: string }>>();

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  isProcessing: false,
  isParallel: false,

  addToQueue: (newItems) => {
    const existing = get().items;
    const mapped: QueueItem[] = newItems
      .filter((n) => !existing.some((e) => e.cutscenePath === n.cutscenePath && e.status !== "completed"))
      .map((n) => ({
        ...n,
        id: safeUUID(),
        status: "queued",
        progress: 0,
      }));
    if (mapped.length > 0) {
      set({ items: [...existing, ...mapped] });
    }
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  retryItem: (id) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: "queued", progress: 0, error: undefined } : i
      ),
    }));
  },

  clearFinished: () => {
    set((state) => ({
      items: state.items.filter((i) => i.status !== "completed" && i.status !== "failed"),
    }));
  },

  clearAll: () => {
    set({ items: [], isProcessing: false });
  },

  updateAllPendingPresets: (presets) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.status === "queued"
          ? {
              ...i,
              locale: presets.locale || i.locale,
              gender: presets.gender || i.gender,
              subtitleMode: presets.subtitleMode || i.subtitleMode,
              renderResolution: presets.renderResolution || i.renderResolution,
            }
          : i
      ),
    }));
  },

  setParallel: (isParallel) => set({ isParallel }),

  pauseProcessing: () => set({ isProcessing: false }),

  startProcessing: async () => {
    if (get().isProcessing) return;
    set({ isProcessing: true });

    const processItem = async (item: QueueItem): Promise<void> => {
      set((state) => ({
        items: state.items.map((i) =>
          i.id === item.id ? { ...i, status: "rendering", progress: 0.1 } : i
        ),
      }));

      try {
        let targetPath = item.cutscenePath;
        if (targetPath.includes(":\\") || targetPath.includes(":/")) {
          const colonIdx = Math.max(targetPath.lastIndexOf(":\\"), targetPath.lastIndexOf(":/"));
          if (colonIdx >= 1) {
            targetPath = targetPath.slice(colonIdx - 1);
          }
        }

        // Deduplicated extraction: await in-flight prefetch if active
        if (inFlightExtractions.has(targetPath)) {
          const res = await inFlightExtractions.get(targetPath)!;
          targetPath = res.video_file;
        } else {
          const catalogItem = useCatalogStore
            .getState()
            .items.find(
              (x) =>
                x.uniqueId === item.cutscenePath ||
                x.uniqueId === targetPath ||
                x.fullPath === targetPath ||
                x.cgFile === targetPath ||
                x.cgName === targetPath
            );

          const isTargetPathDisk = Boolean(
            targetPath &&
              !targetPath.startsWith("http") &&
              (targetPath.includes("/") || targetPath.includes("\\") || targetPath.endsWith(".mp4") || targetPath.endsWith(".bk2") || targetPath.endsWith(".mkv"))
          );

          const needsExtraction =
            (!catalogItem?.isCached || !catalogItem?.audio_ready || !isTargetPathDisk) &&
            catalogItem?.cgName &&
            catalogItem?.cgFile;

          if (needsExtraction) {
            const reqId = safeUUID();
            const cgFileKey = catalogItem.cgFile || "";
            const cgNameKey = catalogItem.cgName || catalogItem.fileName || "";
            const extractPromise = (async () => {
              const soundEvents = await RendererAPI.getVideoAudioEvent(cgNameKey).catch(() => []);
              const res = await ExtractorAPI.extractCutsceneOnDemand(
                cgNameKey,
                cgFileKey,
                soundEvents,
                reqId
              );
              useCatalogStore.getState().updateItem(catalogItem.uniqueId || cgFileKey, {
                fullPath: res.video_file,
                isCached: true,
                audio_ready: true,
                folderName: "cached",
              });
              return { video_file: res.video_file };
            })().finally(() => {
              inFlightExtractions.delete(targetPath);
            });

            inFlightExtractions.set(targetPath, extractPromise);
            const res = await extractPromise;
            targetPath = res.video_file;
          } else if (catalogItem?.fullPath) {
            targetPath = catalogItem.fullPath;
          }
        }

        const payload = await RendererAPI.generateSingleVideoInfo(
          targetPath,
          item.locale,
          item.gender
        );

        set((state) => ({
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, progress: 0.5 } : i
          ),
        }));

        // Lookahead Prefetch: while rendering current item, prefetch next queued item
        const allItems = get().items;
        const nextItem = allItems.find(
          (x) => x.id !== item.id && x.status === "queued" && !inFlightExtractions.has(x.cutscenePath)
        );
        if (nextItem) {
          const nextCatalog = useCatalogStore.getState().items.find(
            (x) =>
              x.fullPath === nextItem.cutscenePath ||
              x.cgFile === nextItem.cutscenePath ||
              x.cgName === nextItem.cutscenePath
          );
          const isNextPathDisk = Boolean(
            nextItem.cutscenePath &&
              !nextItem.cutscenePath.startsWith("http") &&
              (nextItem.cutscenePath.includes("/") || nextItem.cutscenePath.includes("\\") || nextItem.cutscenePath.endsWith(".mp4") || nextItem.cutscenePath.endsWith(".bk2") || nextItem.cutscenePath.endsWith(".mkv"))
          );
          if (
            nextCatalog &&
            (!nextCatalog.isCached || !nextCatalog.audio_ready || !isNextPathDisk) &&
            nextCatalog.cgName &&
            nextCatalog.cgFile
          ) {
            const prefetchKey = nextItem.cutscenePath;
            const reqId = safeUUID();
            const nextCgFileKey = nextCatalog.cgFile || "";
            const nextCgNameKey = nextCatalog.cgName || nextCatalog.fileName || "";
            const p = (async () => {
              const soundEvents = await RendererAPI.getVideoAudioEvent(nextCgNameKey).catch(() => []);
              const res = await ExtractorAPI.extractCutsceneOnDemand(
                nextCgNameKey,
                nextCgFileKey,
                soundEvents,
                reqId
              );
              useCatalogStore.getState().updateItem(nextCatalog.uniqueId || nextCgFileKey, {
                fullPath: res.video_file,
                isCached: true,
                audio_ready: true,
                folderName: "cached",
              });
              return { video_file: res.video_file };
            })().finally(() => {
              inFlightExtractions.delete(prefetchKey);
            });
            inFlightExtractions.set(prefetchKey, p);
          }
        }

        const outputPath = await RendererAPI.renderVideo(payload, item.subtitleMode);

        set((state) => ({
          items: state.items.map((i) =>
            i.id === item.id
              ? { ...i, status: "completed", progress: 1.0, outputPath }
              : i
          ),
        }));
      } catch (err) {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === item.id
              ? { ...i, status: "failed", progress: 0, error: String(err) }
              : i
          ),
        }));
      }
    };

    // Sequential loop (or 2 workers if parallel)
    while (get().isProcessing) {
      const currentItems = get().items;
      const concurrency = get().isParallel ? 2 : 1;
      const pending = currentItems.filter((i) => i.status === "queued").slice(0, concurrency);

      if (pending.length === 0) {
        set({ isProcessing: false });
        break;
      }

      await Promise.all(pending.map(processItem));
    }
  },
}));
