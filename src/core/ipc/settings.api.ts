import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "../../context/AppContext";

export const SettingsAPI = {
  getConfig: async (): Promise<AppConfig> => {
    return await invoke<AppConfig>("get_config");
  },

  updateConfig: async (newConfig: AppConfig): Promise<void> => {
    await invoke("update_config", { newConfig });
  },
};
