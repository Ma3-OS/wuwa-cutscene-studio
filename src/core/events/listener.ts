import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useTaskStore } from "../../features/task-monitor/stores/useTaskStore";

interface ProgressPayload {
  task: string;
  progress: number;
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

let unlistenLog: UnlistenFn | null = null;
let unlistenProgress: UnlistenFn | null = null;

export async function setupGlobalEventListeners(): Promise<() => void> {
  const appendLog = useTaskStore.getState().appendLog;
  const updateTaskProgress = useTaskStore.getState().updateTaskProgress;

  if (!unlistenLog) {
    unlistenLog = await listen<string>("backend-log", (event) => {
      const message = typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
      appendLog({
        message,
        level: classifyLogMessage(message),
      });
    });
  }

  if (!unlistenProgress) {
    unlistenProgress = await listen<ProgressPayload>("downloader-progress", (event) => {
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
  }

  return () => {
    if (unlistenLog) {
      unlistenLog();
      unlistenLog = null;
    }
    if (unlistenProgress) {
      unlistenProgress();
      unlistenProgress = null;
    }
  };
}
