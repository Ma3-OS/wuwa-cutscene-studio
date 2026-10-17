import { listen } from "@tauri-apps/api/event";
import { useTaskStore } from "../../features/task-monitor/stores/useTaskStore";
import { useExtractionStore } from "../../features/catalog/stores/useExtractionStore";

interface ProgressPayload {
  task: string;
  progress: number;
}

interface ExtractionProgressPayload {
  cg_name: string;
  stage: number;
  status_text: string;
  percent: number;
}

function classifyLogMessage(text: string): "info" | "warn" | "error" | "success" {
  const lower = text.toLowerCase();
  if (
    lower.startsWith("success") ||
    lower.startsWith("finished") ||
    lower.includes("successfully") ||
    lower.includes("completed")
  ) {
    return "success";
  }
  if (lower.includes("error:") || lower.startsWith("error") || lower.includes("failed")) {
    return "error";
  }
  if (lower.includes("warning") || lower.startsWith("⚠")) {
    return "warn";
  }
  return "info";
}

let logBatchBuffer: Array<{ message: string; level: "info" | "warn" | "error" | "success" }> = [];
let batchRafId: number | null = null;

function flushLogBatch() {
  if (logBatchBuffer.length === 0) return;
  const chunk = logBatchBuffer;
  logBatchBuffer = [];
  batchRafId = null;
  useTaskStore.getState().appendBackendLogsBatch(chunk);
}

function queueBackendLog(entry: { message: string; level: "info" | "warn" | "error" | "success" }) {
  logBatchBuffer.push(entry);
  if (batchRafId === null) {
    batchRafId = requestAnimationFrame(flushLogBatch);
  }
}

let setupPromise: Promise<() => void> | null = null;
let listenerRefCount = 0;

export function setupGlobalEventListeners(): Promise<() => void> {
  listenerRefCount++;
  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = (async () => {
    const updateTaskProgress = useTaskStore.getState().updateTaskProgress;

    const unlistenLog = await listen<string>("backend-log", (event) => {
      const message = typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
      queueBackendLog({
        message,
        level: classifyLogMessage(message),
      });
    });

    const unlistenProgress = await listen<ProgressPayload>("downloader-progress", (event) => {
      const payload = event.payload;
      if (payload && payload.task) {
        const isComplete = payload.progress >= 1.0;
        updateTaskProgress(
          payload.task,
          payload.task,
          payload.progress,
          isComplete ? "completed" : "running"
        );
      }
    });

    const unlistenExtraction = await listen<ExtractionProgressPayload>("extraction-progress", (event) => {
      const payload = event.payload;
      if (payload) {
        useExtractionStore.getState().updateProgress(
          payload.stage,
          payload.status_text,
          payload.percent
        );
        if (payload.status_text) {
          queueBackendLog({
            message: payload.status_text,
            level: "info",
          });
        }
      }
    });

    return () => {
      listenerRefCount--;
      if (listenerRefCount <= 0) {
        if (batchRafId !== null) {
          cancelAnimationFrame(batchRafId);
          flushLogBatch();
        }
        unlistenLog();
        unlistenProgress();
        unlistenExtraction();
        setupPromise = null;
        listenerRefCount = 0;
      }
    };
  })();

  return setupPromise;
}
