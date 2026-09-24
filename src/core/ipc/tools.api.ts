import { invoke } from "@tauri-apps/api/core";

export interface DependencyStatusDto {
  ffmpeg: boolean;
  wwiser: boolean;
  vgmstream: boolean;
  json_data: boolean;
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

  openFile: async (path: string): Promise<void> => {
    await invoke("open_file", { path });
  },

  openOutputDir: async (): Promise<void> => {
    await invoke("open_output_dir");
  },

  getCacheSize: async (): Promise<number> => {
    return await invoke<number>("get_cache_size");
  },

  clearAppCache: async (): Promise<number> => {
    return await invoke<number>("clear_app_cache");
  },
};
