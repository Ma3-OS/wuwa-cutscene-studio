import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  Download, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Settings2, 
  HardDrive, 
  RotateCcw,
  Palette,
  Languages,
  Volume2,
  Sparkles,
  Trash2,
  Bell,
  ExternalLink,
  Check,
  Key,
  ShieldAlert,
  Wand2,
  RefreshCw
} from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";
import { useApp } from "../context/AppContext";
import { AppLanguage } from "../utils/i18n";

interface ProgressPayload {
  task: string;
  progress: number;
}

import { ToolsAPI, ScannerAPI, DependencyStatusDto } from "../core/ipc";

export function SetupView() {
  const { config, t, updateConfig, playSound } = useApp();
  
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [deps, setDeps] = useState<DependencyStatusDto | null>(null);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [clearingCache, setClearingCache] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [syncingKeys, setSyncingKeys] = useState(false);

  const checkDeps = async () => {
    try {
      const status = await ToolsAPI.checkDependencies();
      setDeps(status);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCacheSize = async () => {
    try {
      const size = await ToolsAPI.getCacheSize();
      setCacheSize(size);
    } catch (e) {
      console.error(e);
    }
  };

  const checkGameRunning = async () => {
    try {
      const running = await ScannerAPI.isGameRunning();
      setIsGameRunning(running);
    } catch (e) {
      console.warn("Could not check game process status", e);
    }
  };

  const handleAutoDetect = async () => {
    playSound("click");
    try {
      const detected = await ScannerAPI.detectGamePath();
      if (detected) {
        await updateConfig({ export_dir: detected });
        playSound("success");
        toast.success("Detected Wuthering Waves install location!");
      } else {
        playSound("error");
        toast.error("Game path not found in Windows Registry. Please browse manually.");
      }
    } catch (e) {
      console.error(e);
      toast.error(String(e));
    }
  };

  const handleSyncKeys = async () => {
    playSound("click");
    setSyncingKeys(true);
    try {
      await ToolsAPI.downloadData(config.subtitle_lang || "th");
      await checkDeps();
      playSound("success");
      toast.success("AES Keys synchronized from yarik0chka/wuwa-keys!");
    } catch (e) {
      console.error(e);
      playSound("error");
      toast.error(String(e));
    } finally {
      setSyncingKeys(false);
    }
  };

  useEffect(() => {
    checkDeps();
    fetchCacheSize();
    checkGameRunning();

    const unlistenProgress = listen<ProgressPayload>("downloader-progress", (event) => {
      setCurrentTask(event.payload.task);
      setProgress(event.payload.progress * 100);
    });

    return () => {
      unlistenProgress.then((f) => f());
    };
  }, []);

  const selectDir = async (key: "export_dir" | "output_dir") => {
    playSound("click");
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      await updateConfig({ [key]: selected });
      toast.success(t("settingsDesc"));
    }
  };

  const handleResetOutputDir = async () => {
    playSound("click");
    await updateConfig({ output_dir: "" });
    toast.success(t("btnResetDefault"));
  };

  const handleOpenOutput = async () => {
    playSound("click");
    try {
      await ToolsAPI.openOutputDir();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCache = async () => {
    playSound("click");
    setClearingCache(true);
    try {
      const freed = await ToolsAPI.clearAppCache();
      await fetchCacheSize();
      playSound("success");
      toast.success(`${t("clearCacheSuccess")} (${(freed / (1024 * 1024)).toFixed(1)} MB)`);
    } catch (e) {
      toast.error(String(e));
      playSound("error");
    } finally {
      setClearingCache(false);
    }
  };

  const handleDownloadAll = async () => {
    playSound("click");
    setDownloading(true);
    setProgress(0);
    try {
      await ToolsAPI.downloadTools();
      await ToolsAPI.downloadData(config.subtitle_lang || "th");
      await checkDeps();
      playSound("success");
      toast.success("Synchronized successfully!");
    } catch (e) {
      console.error(e);
      playSound("error");
      toast.error(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const uiFonts = [
    { id: "Kanit", name: "Kanit", desc: t("fontKanitDesc"), sample: "กขค ABC 123" },
    { id: "Prompt", name: "Prompt", desc: t("fontPromptDesc"), sample: "กขค ABC 123" },
    { id: "Inter", name: "Inter", desc: t("fontInterDesc"), sample: "กขค ABC 123" },
    { id: "Noto Sans Thai", name: "Noto Sans Thai", desc: t("fontNotoDesc"), sample: "กขค ABC 123" },
  ];

  const accentColors = [
    { id: "purple", name: t("themePurple"), color: "#6366F1", glow: "rgba(99, 102, 241, 0.4)" },
    { id: "cyan", name: t("themeCyan"), color: "#06B6D4", glow: "rgba(6, 182, 212, 0.4)" },
    { id: "emerald", name: t("themeEmerald"), color: "#10B981", glow: "rgba(16, 185, 129, 0.4)" },
    { id: "crimson", name: t("themeCrimson"), color: "#E11D48", glow: "rgba(225, 29, 72, 0.4)" },
    { id: "amber", name: t("themeGold"), color: "#F59E0B", glow: "rgba(245, 158, 11, 0.4)" },
  ];

  const languages = [
    { id: "th", name: "ภาษาไทย", flag: "🇹🇭", desc: "เมนูและคำแนะนำภาษาไทย" },
    { id: "en", name: "English (US)", flag: "🇺🇸", desc: "Standard English interface" },
    { id: "ja", name: "日本語", flag: "🇯🇵", desc: "日本語ユーザーインターフェース" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-5xl w-full mx-auto space-y-7 pb-16">
        
        {/* Header */}
        <header className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner-glow shrink-0">
            <Settings2 className="w-5 h-5 text-accent-bright" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg">{t("settingsTitle")}</h1>
            <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
              {t("settingsDesc")}
            </p>
          </div>
        </header>

        {/* 1. Appearance & Typography Section */}
        <SpotlightCard className="p-6 border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              {t("secAppearance")}
            </h2>
            <span className="text-[10px] text-fg-subtle">{t("realtimePreview")}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UI Font Selector */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-fg block">{t("appFontLabel")}</label>
                <p className="text-[11px] text-fg-subtle">{t("appFontDesc")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {uiFonts.map((f) => {
                  const isSelected = config.app_font === f.id || (!config.app_font && f.id === "Kanit");
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        playSound("click");
                        updateConfig({ app_font: f.id });
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? "bg-accent/15 border-accent shadow-md shadow-accent/10 ring-1 ring-accent/30 text-white"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] text-fg-muted hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-fg">{f.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-bright" />}
                      </div>
                      <span className="text-[10px] opacity-70 leading-tight">{f.desc}</span>
                      <span className="text-[11px] font-medium opacity-90 mt-1 pt-1 border-t border-white/5 block font-mono">
                        {f.sample}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Accent Color */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-fg block">{t("themeAccentLabel")}</label>
                <p className="text-[11px] text-fg-subtle">{t("themeAccentDesc")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accentColors.map((c) => {
                  const isSelected = config.theme_accent === c.id || (!config.theme_accent && c.id === "purple");
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        playSound("click");
                        updateConfig({ theme_accent: c.id });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-white/[0.08] border-white/20 shadow-md ring-1 ring-white/20 text-white"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] text-fg-muted hover:text-fg"
                      }`}
                    >
                      <div 
                        className="w-5 h-5 rounded-full shadow-sm shrink-0 border border-white/20"
                        style={{ background: c.color, boxShadow: `0 0 10px ${c.glow}` }}
                      />
                      <span className="text-xs font-medium text-fg flex-1">{c.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-bright" />}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Glow Toggle */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-fg block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    {t("ambientGlowLabel")}
                  </label>
                  <p className="text-[10px] text-fg-subtle">{t("ambientGlowDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    updateConfig({ enable_glow: !config.enable_glow });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.enable_glow ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <motion.div 
                    animate={{ x: config.enable_glow ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* 2. Language & Regional Settings */}
        <SpotlightCard className="p-6 border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2">
              <Languages className="w-4 h-4 text-accent" />
              {t("secLanguage")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {languages.map((item) => {
              const isSelected = (config.app_language || "th") === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    playSound("click");
                    updateConfig({ app_language: item.id as AppLanguage });
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? "bg-accent/15 border-accent shadow-md shadow-accent/10 ring-1 ring-accent/30 text-white"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] text-fg-muted hover:text-fg"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold flex items-center gap-2 text-fg">
                      <span>{item.flag}</span>
                      <span>{item.name}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent-bright" />}
                  </div>
                  <span className="text-[10px] opacity-70 leading-relaxed">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </SpotlightCard>

        {/* 3. Audio Feedback & Workflow Automation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* UI Audio Feedback */}
          <SpotlightCard className="p-6 border-white/5 space-y-5">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2 border-b border-white/[0.06] pb-3">
              <Volume2 className="w-4 h-4 text-accent" />
              {t("secAudioFeedback")}
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-fg block">{t("uiSoundsLabel")}</label>
                  <p className="text-[10px] text-fg-subtle">{t("uiSoundsDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !config.enable_ui_sounds;
                    updateConfig({ enable_ui_sounds: next });
                    if (next) playSound("click");
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.enable_ui_sounds ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <motion.div 
                    animate={{ x: config.enable_ui_sounds ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>

              {config.enable_ui_sounds && (
                <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-fg-muted">{t("uiVolumeLabel")}</span>
                    <span className="font-mono text-accent font-bold">
                      {Math.round((config.ui_sound_volume ?? 0.7) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.ui_sound_volume ?? 0.7}
                      onChange={(e) => updateConfig({ ui_sound_volume: parseFloat(e.target.value) })}
                      className="flex-1 accent-accent"
                    />
                    <button
                      type="button"
                      onClick={() => playSound("success")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded text-fg-muted hover:text-white"
                      title={t("btnTestChime")}
                    >
                      {t("btnTestChime")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* Workflow Automation & Notifications */}
          <SpotlightCard className="p-6 border-white/5 space-y-5">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2 border-b border-white/[0.06] pb-3">
              <Bell className="w-4 h-4 text-accent" />
              {t("secAutomation")}
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-fg block">{t("autoOpenLabel")}</label>
                  <p className="text-[10px] text-fg-subtle">{t("autoOpenDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    updateConfig({ auto_open_output: !config.auto_open_output });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.auto_open_output ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <motion.div 
                    animate={{ x: config.auto_open_output ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                <div>
                  <label className="text-xs font-semibold text-fg block">{t("notificationsLabel")}</label>
                  <p className="text-[10px] text-fg-subtle">{t("notificationsDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    updateConfig({ enable_notifications: !config.enable_notifications });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    config.enable_notifications ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <motion.div 
                    animate={{ x: config.enable_notifications ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* 4. Storage & Cache Cleaner */}
        <SpotlightCard className="p-6 border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-accent" />
              {t("secStorage")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-fg-muted">{t("cacheSizeLabel")}:</span>
              <span className="text-xs font-mono font-bold text-accent">
                {(cacheSize / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-fg-subtle leading-relaxed max-w-xl">
              {t("cacheExplanation")}
            </p>
            <Button
              variant="secondary"
              onClick={handleClearCache}
              disabled={clearingCache || cacheSize === 0}
              className="px-4 py-2 text-xs shrink-0 hover:border-red-500/30 hover:text-red-300 transition-colors"
            >
              <Trash2 className={`w-3.5 h-3.5 mr-1.5 ${clearingCache ? 'animate-spin' : 'text-red-400'}`} />
              {t("btnClearCache")}
            </Button>
          </div>
        </SpotlightCard>

        {/* 5. Directory Paths & Game Database Sync Section */}
        <SpotlightCard className="p-6 border-white/5 space-y-5">
          <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <HardDrive className="w-4 h-4 text-accent" />
            {t("secPaths")}
          </h2>

          {/* Anti-Cheat Awareness Warning Banner */}
          {isGameRunning && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300">Wuthering Waves client is currently running.</span>
                <span className="opacity-80 ml-1">For safety against Anti-Cheat Expert (ACE) detection flags, avoid inspecting or extracting active game assets until the client is closed.</span>
              </div>
            </div>
          )}
          
          <div className="space-y-5">
            {/* FModel Export Dir */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-fg-muted">{t("fmodelExportDirLabel")}</label>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="text-[11px] text-accent hover:text-accent-bright font-medium flex items-center gap-1 transition-colors"
                  title="Auto-detect Wuthering Waves install location from Windows Registry"
                >
                  <Wand2 className="w-3 h-3 text-accent" />
                  Auto-Detect Registry
                </button>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={config.export_dir} 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-accent/50 transition-all text-fg font-mono" 
                  placeholder="e.g. D:\Datamine\FModel\Output\Exports\Client\Content\Aki" 
                  readOnly 
                />
                <Button variant="secondary" onClick={() => selectDir("export_dir")} className="px-3.5 py-2 text-xs">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                  {t("btnBrowse")}
                </Button>
              </div>
              <p className="text-[11px] text-fg-subtle">
                {t("fmodelExportDirDesc")}
              </p>
            </div>

            {/* Custom Output Dir */}
            <div className="space-y-1.5 pt-3 border-t border-white/[0.04]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-fg-muted">{t("outputDirLabel")}</label>
                {config.output_dir && (
                  <button
                    type="button"
                    onClick={handleResetOutputDir}
                    className="text-[11px] text-fg-subtle hover:text-accent flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t("btnResetDefault")}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={config.output_dir || "Default (App Data / Output Directory)"} 
                  className={`flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-accent/50 transition-all ${
                    config.output_dir ? "text-fg font-mono" : "text-fg-subtle italic"
                  }`} 
                  readOnly 
                />
                <Button variant="secondary" onClick={() => selectDir("output_dir")} className="px-3.5 py-2 text-xs">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                  {t("btnChange")}
                </Button>
                <Button variant="secondary" onClick={handleOpenOutput} className="px-3.5 py-2 text-xs">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  {t("btnOutputFolder")}
                </Button>
              </div>
              <p className="text-[11px] text-fg-subtle">
                {t("outputDirDesc")}
              </p>
            </div>

            {/* Sync Tools & Data Status */}
            <div className="pt-4 border-t border-white/[0.04] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-fg block">{t("toolsAndDataTitle")}</span>
                  <span className="text-[11px] text-fg-subtle">{t("toolsAndDataDesc")}</span>
                </div>
                <Button 
                  onClick={handleDownloadAll} 
                  disabled={downloading}
                  className="px-4 py-2 text-xs bg-accent hover:bg-accent-bright text-white shadow-btn-glow"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      {t("btnSyncing")}
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      {t("btnSyncAll")}
                    </>
                  )}
                </Button>
              </div>

              {/* Status Pills */}
              {deps && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: "FFmpeg", ok: deps.ffmpeg },
                    { label: "vgmstream", ok: deps.vgmstream },
                    { label: "wwiser", ok: deps.wwiser },
                    { label: "Game Data & Keys", ok: deps.json_data },
                  ].map((d) => (
                    <div 
                      key={d.label}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        d.ok ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-red-950/20 border-red-500/30 text-red-300"
                      }`}
                    >
                      <span className="font-medium">{d.label}</span>
                      {d.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Dedicated AES Keys Community Sync Card */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Key className="w-4 h-4 text-accent shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-fg block">Wuthering Waves AES Decryption Keys</span>
                    <span className="text-[10px] text-fg-subtle truncate block">
                      Community Upstream: <span className="text-accent font-mono">yarik0chka/wuwa-keys</span>
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleSyncKeys}
                  disabled={syncingKeys}
                  className="px-3 py-1.5 text-[11px] shrink-0 hover:border-accent/40 hover:text-accent-bright"
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${syncingKeys ? "animate-spin" : "text-accent"}`} />
                  Sync Keys
                </Button>
              </div>

              {/* Progress bar */}
              {downloading && (
                <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between text-[11px] text-fg-muted font-mono">
                    <span>{currentTask}</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-accent h-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </motion.div>
  );
}
