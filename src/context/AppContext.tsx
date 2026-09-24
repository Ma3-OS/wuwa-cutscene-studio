import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SettingsAPI } from "../core/ipc";
import { translations, AppLanguage } from "../utils/i18n";
import { soundManager } from "../utils/sound";

export interface AppConfig {
  ffmpeg_path: string;
  vgmstream_path: string;
  export_dir: string;
  output_dir: string;
  render_resolution: string;
  char_selection: string;
  locale_selection: string;
  subtitle_lang: string;
  subtitle_mode: string;
  sub_font: string;
  sub_size: number;
  sub_outline: number;
  sub_shadow: number;
  sub_color: string;
  sub_margin_v: number;

  // Non-video app preferences
  app_language: AppLanguage;
  app_font: string;
  theme_accent: string;
  enable_glow: boolean;
  enable_ui_sounds: boolean;
  ui_sound_volume: number;
  auto_open_output: boolean;
  enable_notifications: boolean;
}

interface AppContextType {
  config: AppConfig;
  lang: AppLanguage;
  t: (key: keyof typeof translations["th"]) => string;
  updateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
  playSound: (type: "click" | "success" | "error") => void;
}

const defaultConfig: AppConfig = {
  ffmpeg_path: "",
  vgmstream_path: "",
  export_dir: "",
  output_dir: "",
  render_resolution: "original",
  char_selection: "Girl",
  locale_selection: "ja",
  subtitle_lang: "th",
  subtitle_mode: "Hard-sub",
  sub_font: "Kanit Medium",
  sub_size: 38,
  sub_outline: 3.0,
  sub_shadow: 1.5,
  sub_color: "#FFFFFF",
  sub_margin_v: 45,

  app_language: "th",
  app_font: "Kanit",
  theme_accent: "purple",
  enable_glow: true,
  enable_ui_sounds: true,
  ui_sound_volume: 0.7,
  auto_open_output: false,
  enable_notifications: true,
};

const AppContext = createContext<AppContextType | null>(null);

const ACCENT_MAP: Record<string, { main: string; bright: string; sec: string; glow: string }> = {
  purple: { main: "#6366F1", bright: "#818CF8", sec: "#C084FC", glow: "rgba(99, 102, 241, 0.35)" },
  cyan: { main: "#06B6D4", bright: "#22D3EE", sec: "#38BDF8", glow: "rgba(6, 182, 212, 0.35)" },
  emerald: { main: "#10B981", bright: "#34D399", sec: "#2DD4BF", glow: "rgba(16, 185, 129, 0.35)" },
  crimson: { main: "#E11D48", bright: "#F43F5E", sec: "#FB7185", glow: "rgba(225, 29, 72, 0.35)" },
  amber: { main: "#F59E0B", bright: "#FBBF24", sec: "#FDE047", glow: "rgba(245, 158, 11, 0.35)" },
};

const FONT_MAP: Record<string, string> = {
  Kanit: "'Kanit', 'Noto Sans Thai', sans-serif",
  Prompt: "'Prompt', 'Noto Sans Thai', sans-serif",
  Inter: "'Inter', system-ui, sans-serif",
  "Noto Sans Thai": "'Noto Sans Thai', system-ui, sans-serif",
};

function applyStylesToDOM(accentKey?: string, fontKey?: string) {
  const accentName = accentKey || "purple";
  const fontName = fontKey || "Kanit";
  const accent = ACCENT_MAP[accentName] || ACCENT_MAP.purple;
  const font = FONT_MAP[fontName] || FONT_MAP.Kanit;

  document.documentElement.setAttribute("data-accent", accentName);
  document.documentElement.setAttribute("data-font", fontName);
  document.body.setAttribute("data-accent", accentName);
  document.body.setAttribute("data-font", fontName);

  document.documentElement.style.setProperty("--color-accent", accent.main);
  document.documentElement.style.setProperty("--color-accent-bright", accent.bright);
  document.documentElement.style.setProperty("--color-accent-secondary", accent.sec);
  document.documentElement.style.setProperty("--color-accent-glow", accent.glow);
  document.documentElement.style.setProperty("--app-font-family", font);
  document.body.style.setProperty("--app-font-family", font);
  document.body.style.fontFamily = font;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await SettingsAPI.getConfig();
      setConfig((prev) => ({ ...prev, ...cfg }));
      
      // Update sound manager
      soundManager.setConfig(cfg.enable_ui_sounds ?? true, cfg.ui_sound_volume ?? 0.7);
      
      // Update root attributes and CSS variables for theme & font
      applyStylesToDOM(cfg.theme_accent, cfg.app_font);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const updateConfig = async (partial: Partial<AppConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    
    // Sync sound settings
    if (partial.enable_ui_sounds !== undefined || partial.ui_sound_volume !== undefined) {
      soundManager.setConfig(updated.enable_ui_sounds, updated.ui_sound_volume);
    }

    // Instantly update DOM CSS variables and attributes
    applyStylesToDOM(updated.theme_accent, updated.app_font);

    try {
      await SettingsAPI.updateConfig(updated);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  const lang: AppLanguage = config.app_language || "th";

  const t = useCallback(
    (key: keyof typeof translations["th"]): string => {
      const langDict = translations[lang] || translations.th;
      return (langDict as any)[key] || (translations.th as any)[key] || key;
    },
    [lang]
  );

  const playSound = useCallback(
    (type: "click" | "success" | "error") => {
      if (type === "click") soundManager.playClickSound();
      else if (type === "success") soundManager.playSuccessChime();
      else if (type === "error") soundManager.playErrorChime();
    },
    []
  );

  return (
    <AppContext.Provider value={{ config, lang, t, updateConfig, playSound }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
