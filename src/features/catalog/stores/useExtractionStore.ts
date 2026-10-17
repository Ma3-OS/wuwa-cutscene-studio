import { create } from "zustand";

export interface ExtractionProgressState {
  isOpen: boolean;
  isRunning: boolean;
  taskType: "extraction" | "render";
  cgName: string;
  stage: number;
  statusText: string;
  percent: number;
  isDone: boolean;
  isCancelled: boolean;
  error: string | null;
  cancelExtractionId: string | null;
  thumbnailUrl: string | null;
  logs: Array<{ time: string; text: string }>;
  startTime: number | null;

  startExtraction: (cgName: string, cancelId?: string, taskType?: "extraction" | "render") => void;
  updateProgress: (stage: number, statusText: string, percent: number) => void;
  setThumbnailUrl: (url: string | null) => void;
  addLog: (text: string) => void;
  finishExtraction: () => void;
  setError: (error: string) => void;
  cancel: () => void;
  close: () => void;
  open: () => void;
}

export const EXTRACTION_STAGES = [
  { stage: 1, label: "กำลังค้นหาตำแหน่งไฟล์ในแพ็กเกจเกม" },
  { stage: 2, label: "กำลังสกัดสตรีมวิดีโอความละเอียดสูง" },
  { stage: 3, label: "กำลังสกัดธนาคารเสียงและสตรีมเสียง Wwise" },
  { stage: 4, label: "กำลังประมวลผลโครงสร้างเสียงและดัชนี" },
  { stage: 5, label: "กำลังสร้างภาพตัวอย่างและเตรียมความพร้อม" },
] as const;

function getNowTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export const useExtractionStore = create<ExtractionProgressState>((set) => ({
  isOpen: false,
  isRunning: false,
  taskType: "extraction",
  cgName: "",
  stage: 1,
  statusText: EXTRACTION_STAGES[0].label,
  percent: 0,
  isDone: false,
  isCancelled: false,
  error: null,
  cancelExtractionId: null,
  thumbnailUrl: null,
  logs: [],
  startTime: null,

  startExtraction: (cgName, cancelId, taskType = "extraction") =>
    set({
      isOpen: true,
      isRunning: true,
      taskType,
      cgName,
      stage: 1,
      statusText: EXTRACTION_STAGES[0].label,
      percent: 5,
      isDone: false,
      isCancelled: false,
      error: null,
      cancelExtractionId: cancelId || null,
      thumbnailUrl: null,
      logs: [{ time: getNowTimeString(), text: `เริ่มต้นกระบวนการสกัดสำหรับ ${cgName}` }],
      startTime: Date.now(),
    }),

  updateProgress: (stage, statusText, percent) =>
    set((state) => {
      if (state.isCancelled) return state;
      const newLogs =
        statusText && statusText !== state.statusText
          ? [...state.logs, { time: getNowTimeString(), text: statusText }]
          : state.logs;
      return {
        stage: Math.max(state.stage, stage),
        statusText: statusText || state.statusText,
        percent: Math.min(100, Math.max(state.percent, percent)),
        isDone: percent >= 100,
        isRunning: percent < 100,
        logs: newLogs,
      };
    }),

  setThumbnailUrl: (url) => set({ thumbnailUrl: url }),

  addLog: (text) =>
    set((state) => {
      if (state.isCancelled) return state;
      return {
        logs: [...state.logs, { time: getNowTimeString(), text }],
      };
    }),

  finishExtraction: () =>
    set((state) => {
      if (state.isCancelled) return state;
      return {
        stage: 5,
        percent: 100,
        statusText: "กระบวนการสกัดเสร็จสมบูรณ์เรียบร้อยแล้ว",
        isDone: true,
        isRunning: false,
        logs: [
          ...state.logs,
          { time: getNowTimeString(), text: "กระบวนการสกัดเสร็จสมบูรณ์เรียบร้อยแล้ว" },
        ],
      };
    }),

  setError: (error) =>
    set((state) => {
      if (state.isCancelled) return state;
      if (
        error.toLowerCase().includes("cancel") ||
        error.includes("ยกเลิก")
      ) {
        return state;
      }
      return {
        error,
        isDone: false,
        isRunning: false,
        logs: [
          ...state.logs,
          { time: getNowTimeString(), text: `เกิดข้อผิดพลาด: ${error}` },
        ],
      };
    }),

  cancel: () =>
    set({
      isOpen: false,
      isRunning: false,
      isCancelled: true,
      error: null,
      stage: 1,
      percent: 0,
      isDone: false,
      thumbnailUrl: null,
      cancelExtractionId: null,
    }),

  close: () =>
    set({
      isOpen: false,
    }),

  open: () =>
    set({
      isOpen: true,
    }),
}));
