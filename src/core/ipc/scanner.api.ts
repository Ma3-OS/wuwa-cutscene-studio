import { invoke } from "@tauri-apps/api/core";

export interface VideoMetaDto {
  thumbnail: string;
  duration_secs: number;
  duration_formatted: string;
  resolution: string;
}

export const ScannerAPI = {
  getExportedVideos: async (exportDir: string): Promise<string[]> => {
    return await invoke<string[]>("get_exported_videos", { exportDir });
  },

  scanAudioBanks: async (exportDir: string): Promise<string[]> => {
    return await invoke<string[]>("scan_audio_banks", { exportDir });
  },

  getVideoThumbnail: async (videoPath: string): Promise<string> => {
    return await invoke<string>("get_video_thumbnail", { videoPath });
  },

  getVideoMeta: async (videoPath: string): Promise<VideoMetaDto> => {
    return await invoke<VideoMetaDto>("get_video_meta", { videoPath });
  },

  isGameRunning: async (): Promise<boolean> => {
    return await invoke<boolean>("is_game_running");
  },

  detectGamePath: async (): Promise<string | null> => {
    return await invoke<string | null>("detect_game_path");
  },
};
