import React, { useRef, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Copy,
  Trash2,
  ChevronDown,
  Loader2,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "../../features/task-monitor/stores/useTaskStore";
import { useApp } from "../../context/AppContext";
import { ToolsAPI } from "../../core/ipc/tools.api";
import { toast } from "sonner";

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useApp();
  const logs = useTaskStore((state) => state.logs);
  const tasks = useTaskStore((state) => state.tasks);
  const clearLogs = useTaskStore((state) => state.clearLogs);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Find any active running task
  const activeTask = Object.values(tasks).find(
    (task) => task.status === "running"
  );

  // Auto-scroll on new log entry & Escape key listener
  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [logs.length, isOpen, onClose]);

  const handleCopyLogs = async () => {
    try {
      const text = logs
        .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
        .join("\n");
      await navigator.clipboard.writeText(text);
      toast.success(t("copiedSuccess"));
    } catch {
      toast.error(t("logCopyError"));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: "spring", stiffness: 450, damping: 35, mass: 0.8 }}
        className="h-48 w-full bg-[#121214] border-t border-white/[0.06] flex flex-col shrink-0 select-none z-20 shadow-2xl"
      >
        {/* Terminal Header */}
        <div className="h-8 px-3.5 bg-[#161619] border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <TerminalIcon className="w-3.5 h-3.5 text-[#A3A3A3]" />
              <span>{t("navTerminal")}</span>
            </div>

            {/* Active Task Status Bar */}
            {activeTask && (
              <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                <Loader2 className="w-3 h-3 text-white animate-spin" />
                <span className="text-[11px] font-mono text-[#A3A3A3] truncate max-w-[200px]">
                  {activeTask.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.08] text-white">
                  {Math.round(activeTask.progress * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyLogs}
              className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
              title={t("btnCopyLogs")}
            >
              <Copy className="w-3 h-3" />
              <span>{t("btnCopyLogs")}</span>
            </button>

            <button
              type="button"
              onClick={clearLogs}
              className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
              title={t("btnClearLogs")}
            >
              <Trash2 className="w-3 h-3" />
              <span>{t("btnClearLogs")}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const logPath = await ToolsAPI.getLogFilePath();
                  await ToolsAPI.openFile(logPath);
                } catch {
                  toast.error(t("terminalOpenLogError"));
                }
              }}
              className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
              title={t("terminalOpenDiskLog")}
            >
              <FileText className="w-3 h-3" />
              <span>{t("terminalOpenLogBtn")}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-[#737373] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none ml-1"
              title={t("terminalClose")}
              aria-label={t("terminalClose")}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed select-text space-y-1">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#525252]">
              <span>{t("noLogsYet")}</span>
            </div>
          ) : (
            logs.map((log) => {
              const levelColor = {
                info: "text-[#A1A1AA]",
                success: "text-white font-medium",
                warn: "text-[#F59E0B]",
                error: "text-[#FBBF24] font-medium",
              }[log.level];


              return (
                <div key={log.id} className="flex items-start gap-2 leading-tight">
                  <span className="text-[#525252] shrink-0 text-[10px]">
                    [{log.timestamp}]
                  </span>
                  <span className={`${levelColor} break-all flex-1`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
