import { create } from "zustand";
import { ToolsAPI } from "../../../core/ipc/tools.api";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface TaskItem {
  id: string;
  name: string;
  progress: number;
  status: "idle" | "running" | "completed" | "failed";
}

interface TaskState {
  tasks: Record<string, TaskItem>;
  logs: LogEntry[];
  updateTaskProgress: (id: string, name: string, progress: number, status?: TaskItem["status"]) => void;
  appendLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  appendBackendLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  appendBackendLogsBatch: (entries: Array<Omit<LogEntry, "id" | "timestamp">>) => void;
  clearLogs: () => void;
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

let lastLogMessage = "";
let lastLogTime = 0;

let diskLogQueue: { level: string; component: string; message: string }[] = [];
let diskFlushTimer: ReturnType<typeof setTimeout> | null = null;

function queueDiskLog(level: string, component: string, message: string) {
  if (message.toLowerCase().includes("selected")) {
    return;
  }
  diskLogQueue.push({ level, component, message });
  if (!diskFlushTimer) {
    diskFlushTimer = setTimeout(() => {
      diskFlushTimer = null;
      const batch = diskLogQueue;
      diskLogQueue = [];
      for (const item of batch) {
        ToolsAPI.logClientEvent(item.level, item.component, item.message).catch(() => {});
      }
    }, 1000);
  }
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: {},
  logs: [],
  updateTaskProgress: (id, name, progress, status = "running") =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [id]: { id, name, progress, status },
      },
    })),
  // UI-originating events: record to disk with buffer and append to UI
  appendLog: (entry) => {
    queueDiskLog(entry.level, "UI", entry.message);

    set((state) => {
      const now = Date.now();
      if (entry.message === lastLogMessage && now - lastLogTime < 1500) {
        return state;
      }
      lastLogMessage = entry.message;
      lastLogTime = now;

      return {
        logs: [
          ...state.logs.slice(-499),
          {
            ...entry,
            id: safeUUID(),
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
    });
  },
  // Backend-originating events: already recorded to disk by Rust/C#, append directly to UI without echo IPC
  appendBackendLog: (entry) => {
    set((state) => {
      const now = Date.now();
      if (entry.message === lastLogMessage && now - lastLogTime < 1000) {
        return state;
      }
      lastLogMessage = entry.message;
      lastLogTime = now;

      return {
        logs: [
          ...state.logs.slice(-499),
          {
            ...entry,
            id: safeUUID(),
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
    });
  },
  appendBackendLogsBatch: (entries) => {
    if (!entries.length) return;
    set((state) => {
      const formatted: LogEntry[] = entries.map((entry) => ({
        ...entry,
        id: safeUUID(),
        timestamp: new Date().toLocaleTimeString(),
      }));
      return {
        logs: [...state.logs, ...formatted].slice(-500),
      };
    });
  },
  clearLogs: () => {
    ToolsAPI.clearLogFile().catch(() => {});
    set({ logs: [] });
  },
}));
