import { invoke } from "@tauri-apps/api/core";

export interface DependencyStatusDto {
  ffmpeg: boolean;
  wwiser: boolean;
  vgmstream: boolean;
  json_data: boolean;
}

export interface StorageStatsDto {
  cache_size: number;
  export_size: number;
  render_size: number;
  total_size: number;
  cache_formatted: string;
  export_formatted: string;
  render_formatted: string;
  total_formatted: string;
}

export const ToolsAPI = {
  checkDependencies: async (): Promise<DependencyStatusDto> => {
    return await invoke<DependencyStatusDto>("check_dependencies");
  },

  downloadTools: async (): Promise<void> => {
    await invoke("download_tools");
  },

  downloadData: async (textmapLang?: string): Promise<void> => {
    await invoke("download_data", { textmapLang });
  },

  openFolder: async (path: string): Promise<void> => {
    await invoke("open_folder", { path });
  },

  showInFolder: async (path: string): Promise<void> => {
    await invoke("show_in_folder", { path });
  },

  openMediaExternal: async (path: string): Promise<void> => {
    await invoke("open_media_external", { path });
  },

  getDefaultPaths: async (): Promise<{ project_root: string; export_dir: string; render_dir: string }> => {
    return await invoke("get_default_paths");
  },

  openFile: async (path: string): Promise<void> => {
    await invoke("open_file", { path });
  },

  openOutputDir: async (): Promise<void> => {
    await invoke("open_output_dir");
  },

  openSourceFolder: async (cgName?: string): Promise<void> => {
    await invoke("open_source_folder", { cgName });
  },

  getCacheSize: async (): Promise<number> => {
    return await invoke<number>("get_cache_size");
  },

  clearAppCache: async (): Promise<number> => {
    return await invoke<number>("clear_app_cache");
  },

  getStorageBreakdown: async (): Promise<StorageStatsDto> => {
    return await invoke<StorageStatsDto>("get_storage_breakdown");
  },

  clearProjectCache: async (): Promise<number> => {
    return await invoke<number>("clear_project_cache");
  },

  systemPowerAction: async (action: "sleep" | "shutdown"): Promise<void> => {
    await invoke("system_power_action", { action });
  },

  logClientEvent: async (level: string, component: string, message: string): Promise<void> => {
    await invoke("log_client_event", { level, component, message });
  },

  getLogFilePath: async (): Promise<string> => {
    return await invoke<string>("get_log_file_path");
  },

  readLogFile: async (maxLines?: number): Promise<string> => {
    return await invoke<string>("read_log_file", { maxLines });
  },

  clearLogFile: async (): Promise<void> => {
    await invoke("clear_log_file");
  },
};
