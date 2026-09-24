import { create } from "zustand";

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
  clearLogs: () => void;
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
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
  appendLog: (entry) =>
    set((state) => ({
      // Bound memory limit to last 1,000 logs to prevent LOH bloat
      logs: [
        ...state.logs.slice(-999),
        {
          ...entry,
          id: safeUUID(),
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
}));
