import React from "react";
import { Loader2, CheckCircle2, AlertTriangle, Clock, RotateCcw, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";
import { QueueItem } from "@/features/queue/stores/useQueueStore";

interface QueueItemRowProps {
  item: QueueItem;
  onRetry: (id: string) => void;
  onOpenFile: (path?: string) => void;
  onShowInFolder: (path?: string) => void;
  onRemove: (id: string) => void;
}

export const QueueItemRow: React.FC<QueueItemRowProps> = ({
  item,
  onRetry,
  onOpenFile,
  onShowInFolder,
  onRemove,
}) => {
  const isRendering = item.status === "rendering";
  const isDone = item.status === "completed";
  const isFailed = item.status === "failed";

  return (
    <div className="p-3.5 rounded-xl bg-[#141417] flex items-center justify-between gap-4 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-white/60">
          {isRendering ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : isDone ? (
            <CheckCircle2 className="w-4 h-4 text-white" />
          ) : isFailed ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : (
            <Clock className="w-4 h-4 text-white/40" />
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-medium text-white truncate max-w-md">
            {item.fileName}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono">
            <span>{item.folderName}</span>
            <span>•</span>
            <span>{item.gender === "Girl" ? "โรเวอร์หญิง" : "โรเวอร์ชาย"}</span>
            <span>•</span>
            <span>{item.locale.toUpperCase()}</span>
            <span>•</span>
            <span>{item.subtitleMode}</span>
            {item.renderResolution && item.renderResolution !== "original" && (
              <>
                <span>•</span>
                <span>{item.renderResolution}</span>
              </>
            )}
          </div>
          {item.error && (
            <div className="text-[11px] text-rose-400 font-mono truncate max-w-md">
              {item.error}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Progress Indicator */}
        {isRendering && (
          <div className="w-28 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-200"
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/70">
              {Math.round(item.progress * 100)}%
            </span>
          </div>
        )}

        {/* Retry Button if failed */}
        {isFailed && (
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={() => onRetry(item.id)}
            className="text-xs text-white"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            <span>ลองใหม่</span>
          </StudioButton>
        )}

        {/* Actions when done */}
        {isDone && (
          <>
            <StudioButton
              variant="ghost"
              size="sm"
              onClick={() => onOpenFile(item.outputPath)}
              className="text-xs text-white/80 hover:text-white"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              <span>เปิดดู</span>
            </StudioButton>
            <StudioButton
              variant="ghost"
              size="sm"
              onClick={() => onShowInFolder(item.outputPath)}
              className="text-xs text-white/50 hover:text-white"
            >
              <FolderOpen className="w-3 h-3" />
            </StudioButton>
          </>
        )}

        {/* Remove Button */}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
          title="ลบรายการนี้"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
