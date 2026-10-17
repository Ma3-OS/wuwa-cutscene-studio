import React from "react";
import { ListPlus, Plus, Trash2, FolderOpen, Pause, Play } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { useApp } from "@/context/AppContext";

interface QueueHeaderProps {
  totalCount: number;
  isProcessing: boolean;
  isParallel: boolean;
  hasItems: boolean;
  onOpenAddModal: () => void;
  onSetParallel: (val: boolean) => void;
  onClearFinished: () => void;
  onClearAll: () => void;
  onOpenOutput: () => void;
  onToggleProcessing: () => void;
}

export const QueueHeader: React.FC<QueueHeaderProps> = ({
  totalCount,
  isProcessing,
  isParallel,
  hasItems,
  onOpenAddModal,
  onSetParallel,
  onClearFinished,
  onClearAll,
  onOpenOutput,
  onToggleProcessing,
}) => {
  const { t } = useApp();

  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-white">
          <ListPlus className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-white tracking-wide">
              {t("queueBatchRenderTitle")}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60">
              {totalCount} {t("queueClipsUnit")}
            </span>
          </div>
          <p className="text-xs text-[#737373] mt-0.5">
            {t("queueBatchRenderDesc")}
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <StudioButton variant="secondary" size="sm" onClick={onOpenAddModal}>
          <Plus className="w-3.5 h-3.5" />
          <span>{t("queueAddCutsceneBtn")}</span>
        </StudioButton>

        <StudioSegmentedControl<string>
          size="sm"
          value={isParallel ? "parallel" : "sequential"}
          onChange={(val) => onSetParallel(val === "parallel")}
          options={[
            { value: "sequential", label: t("queueModeSequential") },
            { value: "parallel", label: t("queueModeParallel") },
          ]}
        />

        {hasItems && (
          <>
            <StudioButton variant="ghost" size="sm" onClick={onClearFinished}>
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t("queueClearFinished")}</span>
            </StudioButton>

            <StudioButton
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-neutral-400 hover:text-white"
            >
              <span>{t("queueClearAll")}</span>
            </StudioButton>
          </>
        )}

        <StudioButton variant="secondary" size="sm" onClick={onOpenOutput}>
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t("queueOutputFolderBtn")}</span>
        </StudioButton>

        <StudioButton
          variant="primary"
          size="sm"
          onClick={onToggleProcessing}
          disabled={!hasItems}
          className="min-w-[130px] justify-center"
        >
          {isProcessing ? (
            <>
              <Pause className="w-3.5 h-3.5 mr-1" />
              <span>{t("queuePauseBtn")}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 mr-1 text-black fill-current" />
              <span>{t("queueStartBtn")}</span>
            </>
          )}
        </StudioButton>
      </div>
    </div>
  );
};
