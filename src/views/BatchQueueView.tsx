import React, { useState, useMemo, useRef, useEffect } from "react";
import { Film, Plus } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";
import { useQueueStore } from "@/features/queue/stores/useQueueStore";
import { useCatalogStore } from "@/features/catalog/stores/useCatalogStore";
import { ToolsAPI } from "@/core/ipc";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { QueueHeader } from "@/features/queue/components/QueueHeader";
import { BatchPresetBar } from "@/features/queue/components/BatchPresetBar";
import { QueueOverallProgress } from "@/features/queue/components/QueueOverallProgress";
import { QueueItemRow } from "@/features/queue/components/QueueItemRow";
import { CutscenePickerModal } from "@/features/queue/components/CutscenePickerModal";

export const BatchQueueView: React.FC = () => {
  const { config, playSound, t } = useApp();
  const items = useQueueStore((state) => state.items);
  const isProcessing = useQueueStore((state) => state.isProcessing);
  const isParallel = useQueueStore((state) => state.isParallel);
  const setParallel = useQueueStore((state) => state.setParallel);
  const startProcessing = useQueueStore((state) => state.startProcessing);
  const pauseProcessing = useQueueStore((state) => state.pauseProcessing);
  const removeItem = useQueueStore((state) => state.removeItem);
  const retryItem = useQueueStore((state) => state.retryItem);
  const clearFinished = useQueueStore((state) => state.clearFinished);
  const clearAll = useQueueStore((state) => state.clearAll);
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const updateAllPendingPresets = useQueueStore((state) => state.updateAllPendingPresets);

  const catalogItems = useCatalogStore((state) => state.items);
  const thumbnails = useCatalogStore((state) => state.thumbnails);

  // Modal State for adding cutscenes
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  // Global Presets for the Queue
  const [batchGender, setBatchGender] = useState<"Girl" | "Boy">("Girl");
  const [batchLocale, setBatchLocale] = useState<string>(config.locale_selection || "ja");
  const [batchSubMode, setBatchSubMode] = useState<"Hard-sub" | "Soft-sub" | "None">("Hard-sub");
  const [batchResolution, setBatchResolution] = useState<string>(config.render_resolution || "1920x1080");
  const [autoAction, setAutoAction] = useState<"none" | "chime" | "folder" | "sleep" | "shutdown">("none");

  const prevProcessingRef = useRef(isProcessing);
  useEffect(() => {
    if (prevProcessingRef.current && !isProcessing && items.length > 0) {
      const allDone = items.every((i) => i.status === "completed" || i.status === "failed");
      if (allDone) {
        if (autoAction === "chime") {
          playSound("success");
          toast.success(t("toastQueueAllDone"));
        } else if (autoAction === "folder") {
          ToolsAPI.openOutputDir().catch(() => {});
          toast.success(t("toastQueueAllDoneFolder"));
        } else if (autoAction === "sleep") {
          toast.success(t("toastQueueSleepNotice"));
          ToolsAPI.systemPowerAction("sleep").catch(() => {});
        } else if (autoAction === "shutdown") {
          toast.success(t("toastQueueShutdownNotice"));
          ToolsAPI.systemPowerAction("shutdown").catch(() => {});
        }
      }
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, items, autoAction, playSound]);

  const completedCount = items.filter((i) => i.status === "completed").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const totalCount = items.length;
  const overallProgress =
    totalCount > 0
      ? Math.round((items.reduce((acc, i) => acc + i.progress, 0) / totalCount) * 100)
      : 0;

  // Filter catalog items for picker
  const filteredCatalog = useMemo(() => {
    return catalogItems.filter((item) => {
      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase();
      return (
        item.fileName.toLowerCase().includes(q) ||
        (item.cgName && item.cgName.toLowerCase().includes(q)) ||
        (item.folderName && item.folderName.toLowerCase().includes(q))
      );
    });
  }, [catalogItems, pickerSearch]);

  const handleApplyGlobalPresets = () => {
    playSound("click");
    updateAllPendingPresets({
      gender: batchGender,
      locale: batchLocale,
      subtitleMode: batchSubMode,
      renderResolution: batchResolution,
    });
    toast.success(t("toastQueuePresetApplied"));
  };

  const handleOpenOutput = async () => {
    try {
      await ToolsAPI.openOutputDir();
    } catch {
      toast.error(t("toastCannotOpenOutput"));
    }
  };

  const handleOpenFile = async (path?: string) => {
    if (!path) return;
    try {
      await ToolsAPI.openMediaExternal(path);
    } catch {
      toast.error(t("toastCannotOpenVideo"));
    }
  };

  const handleShowInFolder = async (path?: string) => {
    if (!path) return;
    try {
      await ToolsAPI.showInFolder(path);
    } catch {
      toast.error(t("toastCannotRevealFile"));
    }
  };

  const handleConfirmAddSelected = () => {
    playSound("click");
    if (pickerSelected.size === 0) return;

    const newQueueItems = Array.from(pickerSelected).map((cgFileOrPath) => {
      const match = catalogItems.find(
        (x) => x.cgFile === cgFileOrPath || x.fullPath === cgFileOrPath || x.cgName === cgFileOrPath
      );
      const name = match?.fileName || cgFileOrPath.split("/").pop() || "cutscene.mp4";
      const folder = match?.folderName || t("pickerCategoryGeneral");
      return {
        cutscenePath: match?.fullPath || cgFileOrPath,
        fileName: name,
        folderName: folder,
        locale: batchLocale,
        gender: batchGender,
        subtitleMode: batchSubMode,
        renderResolution: batchResolution,
      };
    });

    addToQueue(newQueueItems);
    setPickerSelected(new Set());
    setIsAddModalOpen(false);
    toast.success(`${t("toastAddedToQueue")} ${newQueueItems.length} ${t("queueClipsUnit")}`);
  };

  return (
    <div className="flex-1 h-full bg-[#111113] flex flex-col min-w-0 overflow-y-auto select-none p-5 space-y-4">
      {/* 1. Header & Primary Queue Controls */}
      <QueueHeader
        totalCount={totalCount}
        isProcessing={isProcessing}
        isParallel={isParallel}
        hasItems={items.length > 0}
        onOpenAddModal={() => {
          playSound("click");
          setIsAddModalOpen(true);
        }}
        onSetParallel={setParallel}
        onClearFinished={clearFinished}
        onClearAll={clearAll}
        onOpenOutput={handleOpenOutput}
        onToggleProcessing={() => {
          playSound("click");
          if (isProcessing) {
            pauseProcessing();
          } else {
            startProcessing();
          }
        }}
      />

      {/* 2. Global Batch Preset Bar */}
      {items.length > 0 && (
        <BatchPresetBar
          batchGender={batchGender}
          setBatchGender={setBatchGender}
          batchLocale={batchLocale}
          setBatchLocale={setBatchLocale}
          batchSubMode={batchSubMode}
          setBatchSubMode={setBatchSubMode}
          batchResolution={batchResolution}
          setBatchResolution={setBatchResolution}
          autoAction={autoAction}
          setAutoAction={setAutoAction}
          onApplyPresets={handleApplyGlobalPresets}
        />
      )}

      {/* 3. Overall Progress Summary Card */}
      {items.length > 0 && (
        <QueueOverallProgress
          completedCount={completedCount}
          totalCount={totalCount}
          failedCount={failedCount}
          overallProgress={overallProgress}
        />
      )}

      {/* 4. Queue Items List */}
      <div className="flex-1 min-h-0 space-y-2">
        {items.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[#141417]">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-white/30 mb-3">
              <Film className="w-6 h-6 stroke-[1.2]" />
            </div>
            <h4 className="text-sm font-semibold text-white/80 mb-1">
              {t("queueEmptyTitle")}
            </h4>
            <p className="text-xs text-white/40 max-w-sm mb-4 leading-relaxed">
              {t("queueEmptyDesc")}
            </p>
            <StudioButton
              variant="primary"
              size="sm"
              onClick={() => {
                playSound("click");
                setIsAddModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>{t("queueEmptyAction")}</span>
            </StudioButton>
          </div>
        ) : (
          items.map((item) => {
            const thumb =
              thumbnails[item.fileName] ||
              thumbnails[item.cutscenePath] ||
              thumbnails[item.id] ||
              (item.fileName ? thumbnails[item.fileName.toLowerCase()] : undefined);
            return (
              <QueueItemRow
                key={item.id}
                item={item}
                thumbnail={thumb}
                onRetry={(id) => {
                  playSound("click");
                  retryItem(id);
                }}
                onOpenFile={handleOpenFile}
                onShowInFolder={handleShowInFolder}
                onRemove={removeItem}
              />
            );
          })
        )}
      </div>

      {/* 5. Cutscene Picker Modal */}
      <CutscenePickerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        pickerSearch={pickerSearch}
        setPickerSearch={setPickerSearch}
        pickerSelected={pickerSelected}
        setPickerSelected={setPickerSelected}
        filteredCatalog={filteredCatalog}
        onConfirmAdd={handleConfirmAddSelected}
      />
    </div>
  );
};
