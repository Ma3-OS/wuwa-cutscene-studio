import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderSearch,
  Video,
  Volume2,
  Cpu,
  Image,
  CheckCircle2,
  Loader2,
  X,
  Terminal,
  Clock,
  Film,
  FolderOpen,
} from "lucide-react";
import {
  useExtractionStore,
  EXTRACTION_STAGES,
} from "../../features/catalog/stores/useExtractionStore";
import { useApp } from "../../context/AppContext";
import { ExtractorAPI } from "../../core/ipc/extractor.api";
import { RendererAPI } from "../../core/ipc/renderer.api";
import { ToolsAPI } from "../../core/ipc/tools.api";
import { useTaskStore } from "../../features/task-monitor/stores/useTaskStore";

const STAGE_ICONS = [
  FolderSearch,
  Video,
  Volume2,
  Cpu,
  Image,
];

export const ExtractionProgressModal: React.FC = () => {
  const { t } = useApp();
  const {
    isOpen,
    cgName,
    taskType,
    stage,
    statusText,
    percent,
    isDone,
    error,
    cancelExtractionId,
    thumbnailUrl,
    logs,
    startTime,
    close,
    cancel,
  } = useExtractionStore();

  const [elapsedSecs, setElapsedSecs] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Timer counter
  useEffect(() => {
    if (!isOpen || isDone) return;
    const interval = setInterval(() => {
      if (startTime) {
        setElapsedSecs(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isDone, startTime]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Explicit user cancel
  const handleExplicitCancel = () => {
    useTaskStore.getState().appendLog({
      message: t("extractionCancelConfirm"),
      level: "warn",
    });
    const cancelId = cancelExtractionId;
    cancel();
    if (cancelId) {
      ExtractorAPI.cancelExtraction(cancelId).catch(() => {});
    }
    RendererAPI.cancelRender().catch(() => {});
  };

  // ESC key handler: minimizes to background without cancelling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              close();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[580px] bg-[#141417] text-white rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* 1. Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium tracking-wider uppercase text-white/40">
                    {t("extractionPreparing")}
                  </span>
                  <span className="text-[10px] font-mono text-white/30">•</span>
                  <span className="text-[10px] font-mono text-white/50">
                    {t("extractionStepStage")} {stage} {t("extractionOfTotal")} 5
                  </span>
                </div>
                <h3 className="text-base font-medium tracking-tight text-white truncate max-w-[380px]">
                  {cgName || t("titlebarProcessing")}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] text-[11px] font-mono text-white/60">
                  <Clock className="w-3 h-3 text-white/40" />
                  <span>{formatTimer(elapsedSecs)}</span>
                </div>
                <button
                  onClick={close}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none cursor-pointer"
                  title={t("extractionMinimize")}
                  aria-label={t("extractionMinimizeShort")}
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* 2. Scrollable Body Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Optional Live Thumbnail Preview */}
              {thumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden rounded-xl bg-black/50 border border-white/[0.06] relative aspect-video w-full shadow-inner"
                >
                  <img
                    src={thumbnailUrl}
                    alt={cgName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/80 flex items-center gap-1.5">
                    <Film className="w-2.5 h-2.5" />
                    <span>{t("extractionHighResPreview")}</span>
                  </div>
                </motion.div>
              )}

              {/* Stages List */}
              <div className="space-y-2.5 bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.03]">
                {EXTRACTION_STAGES.map((s, idx) => {
                  const IconComponent = STAGE_ICONS[idx] || FolderSearch;
                  const isCurrent = stage === s.stage && !isDone && !error;
                  const isPassed = stage > s.stage || isDone;

                  return (
                    <div
                      key={s.stage}
                      className={`flex items-center gap-3 transition-opacity duration-200 ${
                        isCurrent
                          ? "text-white opacity-100"
                          : isPassed
                          ? "text-white/80 opacity-80"
                          : "text-white/25 opacity-35"
                      }`}
                    >
                      <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                        {isPassed ? (
                          <CheckCircle2
                            className="w-4 h-4 text-white"
                            strokeWidth={1.5}
                          />
                        ) : isCurrent ? (
                          <Loader2
                            className="w-4 h-4 animate-spin text-white"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <IconComponent
                            className="w-3.5 h-3.5 text-white/30"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                      <span className="text-xs font-normal tracking-tight">
                        {t(s.labelKey)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Activity Logs Console */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-white/40" />
                    <span>{t("extractionLiveLogs")}</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/30">
                    {logs.length} {t("extractionLogItems")}
                  </span>
                </div>
                <div
                  ref={logContainerRef}
                  className="h-28 overflow-y-auto rounded-xl bg-[#0b0b0d] p-3 border border-white/[0.04] font-mono text-[11px] space-y-1 select-text scrollbar-thin scrollbar-thumb-white/10"
                >
                  {logs.length === 0 ? (
                    <div className="text-white/20 text-[10px]">
                      {t("extractionPreparingLogs")}
                    </div>
                  ) : (
                    logs.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-white/30 shrink-0 text-[10px]">
                          [{item.time}]
                        </span>
                        <span className="text-white/70 break-all">
                          {item.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 3. Footer with Progress Track & Bar */}
            <div className="px-6 pb-5 pt-3 border-t border-white/[0.04] space-y-3 shrink-0 bg-[#121214]">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span className="truncate pr-2 font-normal text-xs">
                  {statusText || (isDone ? t("extractionSuccessSaved") : t("extractionRunningBackground"))}
                </span>
                <span className="font-mono tabular-nums text-white/90 font-medium">
                  {Math.round(percent)}%
                </span>
              </div>

              {/* Progress Track & Bar */}
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>

              {error && (
                <div className="pt-1 text-xs text-rose-400 font-normal">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/40 font-mono truncate whitespace-nowrap">
                  {isDone
                    ? t("extractionSuccessSaved")
                    : t("extractionRunningBackground")}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {!isDone ? (
                    <button
                      onClick={handleExplicitCancel}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-normal text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {t("extractionCancelBtn")}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (taskType === "extraction") {
                            ToolsAPI.openSourceFolder(cgName).catch(() => {
                              ToolsAPI.openOutputDir().catch(console.error);
                            });
                          } else {
                            ToolsAPI.openOutputDir().catch(console.error);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-normal text-neutral-200 bg-white/[0.06] hover:bg-white/[0.12] transition-colors focus:outline-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>{t("btnOpenFileLocation")}</span>
                      </button>
                      <button
                        onClick={close}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-white/90 transition-colors focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {t("btnDone")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
