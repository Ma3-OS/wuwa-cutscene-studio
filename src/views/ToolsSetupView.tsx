import React, { useState, useEffect } from "react";
import {
  Wrench,
  Folder,
  RefreshCw,
  Loader2,
  Trash2,
  Compass,
  Archive,
  RotateCcw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { StudioButton } from "../components/ui/StudioButton";
import {
  ToolsAPI,
  DependencyStatusDto,
  ExtractorAPI,
  GameEnvironmentDto,
} from "../core/ipc";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";

function formatDisplayPath(rawPath?: string | null, projectRoot?: string | null): string {
  if (!rawPath) return "";
  let clean = rawPath.replace(/\\/g, "/");
  if (projectRoot) {
    const rootNorm = projectRoot.replace(/\\/g, "/").replace(/\/$/, "");
    if (clean.startsWith(rootNorm)) {
      clean = clean.slice(rootNorm.length).replace(/^\//, "");
      return clean || ".";
    }
  }
  if (/^[a-zA-Z]:\/Users\/[^/]+/i.test(clean)) {
    const match = clean.match(/(?:data\/vid\.json|data\/keys\.json|export|output)$/i);
    if (match) {
      return match[0];
    }
    clean = clean.replace(/^[a-zA-Z]:\/Users\/[^/]+/i, "~");
  }
  return clean;
}

export const ToolsSetupView: React.FC = () => {
  const { config, updateConfig, t, playSound } = useApp();

  const [deps, setDeps] = useState<DependencyStatusDto | null>(null);
  const [gameEnv, setGameEnv] = useState<GameEnvironmentDto | null>(null);
  const [defaultPaths, setDefaultPaths] = useState<{ project_root: string; export_dir: string; render_dir: string } | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [isSyncingTools, setIsSyncingTools] = useState(false);
  const [isDetectingGame, setIsDetectingGame] = useState(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const fetchStatus = async () => {
    setIsCheckingDeps(true);
    try {
      const [depStatus, size, env, paths] = await Promise.all([
        ToolsAPI.checkDependencies(),
        ToolsAPI.getCacheSize(),
        ExtractorAPI.detectGameEnvironment(),
        ToolsAPI.getDefaultPaths().catch(() => null),
      ]);
      setDeps(depStatus);
      setCacheSize(size);
      setGameEnv(env);
      if (paths) setDefaultPaths(paths);

      // If config doesn't have paks or keys set, but env detected them, save to config
      if (!config.game_paks_dir && env.game_paks_found) {
        await updateConfig({ game_paks_dir: env.paks_dir });
      }
      if (!config.keys_file_path && env.keys_found) {
        await updateConfig({ keys_file_path: env.keys_path });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingDeps(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleAutoDetectGameEnvironment = async () => {
    playSound("click");
    setIsDetectingGame(true);
    try {
      const env = await ExtractorAPI.detectGameEnvironment();
      setGameEnv(env);
      if (env.game_paks_found) {
        await updateConfig({
          game_paks_dir: env.paks_dir,
          keys_file_path: env.keys_path || config.keys_file_path,
        });
        playSound("success");
        toast.success(t("gameArchiveFound"), {
          description: `${env.paks_dir} (${env.paks_count} paks)`,
        });
      } else {
        playSound("error");
        toast.error(t("gameArchiveNotFound"));
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsDetectingGame(false);
    }
  };

  const handleBrowseGamePaksDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.game_paks_dir || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ game_paks_dir: selected });
        toast.success(t("gameFolderLabel"));
        fetchStatus();
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBrowseKeysFile = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "JSON Keys", extensions: ["json"] }],
        defaultPath: config.keys_file_path || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ keys_file_path: selected });
        toast.success(t("keysPathLabel"));
        fetchStatus();
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBrowseExportDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.export_dir || defaultPaths?.export_dir || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ export_dir: selected });
        toast.success(t("toastRawExportDirUpdated"));
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleResetExportDir = async () => {
    playSound("click");
    await updateConfig({ export_dir: "" });
    toast.success(t("toastRawExportDirReset"));
  };

  const handleBrowseOutputDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.output_dir || defaultPaths?.render_dir || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ output_dir: selected });
        toast.success(t("toastOutputDirUpdated"));
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleResetOutputDir = async () => {
    playSound("click");
    await updateConfig({ output_dir: "" });
    toast.success(t("toastOutputDirReset"));
  };

  const handleSyncAllTools = async () => {
    playSound("click");
    setIsSyncingTools(true);
    try {
      await ToolsAPI.downloadTools();
      await ToolsAPI.downloadData(config.subtitle_lang || "th");
      playSound("success");
      toast.success(t("toolsAndDataTitle") + " " + t("cacheReady"));
      await fetchStatus();
    } catch (err) {
      playSound("error");
      toast.error(String(err));
    } finally {
      setIsSyncingTools(false);
    }
  };

  const handleClearCache = async () => {
    playSound("click");
    setIsClearingCache(true);
    try {
      await ToolsAPI.clearAppCache();
      playSound("success");
      toast.success(t("clearCacheSuccess"));
      await fetchStatus();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsClearingCache(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="flex-1 h-full bg-[#111113] flex flex-col min-w-0 overflow-y-auto select-none p-6 pb-12">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-wide">
                {t("wsSetup")}
              </h1>
              <p className="text-xs text-[#737373] mt-0.5">
                {t("toolsAndDataDesc")}
              </p>
            </div>
          </div>

          <StudioButton
            variant="primary"
            size="sm"
            onClick={handleSyncAllTools}
            disabled={isSyncingTools}
          >
            {isSyncingTools ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("btnSyncing")}</span>
              </>
            ) : (
              <span>{t("btnSyncTools")}</span>
            )}
          </StudioButton>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Card 1: Project Directories & Output Separation */}
          <div className="rounded-2xl bg-[#161619] divide-y divide-white/[0.04] overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Folder className="w-4 h-4 text-[#A3A3A3]" />
                <span>{t("toolsSeparateDirs")}</span>
              </div>
            </div>

            {/* Export Dir (Raw Cutscene Bundles) */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-neutral-300 block">
                  {t("toolsRawExportDir")}
                </label>
                <span className="text-[10px] font-mono text-neutral-400">
                  {config.export_dir ? t("toolsCustom") : t("toolsProjectDefault")}
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed">
                {t("toolsRawExportDirDesc")}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="text"
                  readOnly
                  value={formatDisplayPath(config.export_dir || defaultPaths?.export_dir, defaultPaths?.project_root)}
                  placeholder="<project_root>/export"
                  className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
                />
                <StudioButton variant="secondary" size="sm" onClick={handleBrowseExportDir}>
                  <Folder className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                  <span>{t("btnBrowse")}</span>
                </StudioButton>
                {Boolean(config.export_dir) && (
                  <StudioButton
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 flex items-center justify-center shrink-0 text-[#71717A] hover:text-white"
                    onClick={handleResetExportDir}
                    title={t("toolsResetProjectBtn")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </StudioButton>
                )}
              </div>
            </div>

            {/* Output Dir (Master Render Outputs) */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-neutral-300 block">
                  {t("toolsOutputDir")}
                </label>
                <span className="text-[10px] font-mono text-neutral-400">
                  {config.output_dir ? t("toolsCustom") : t("toolsProjectDefault")}
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed">
                {t("toolsOutputDirDesc")}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="text"
                  readOnly
                  value={formatDisplayPath(config.output_dir || defaultPaths?.render_dir, defaultPaths?.project_root)}
                  placeholder="<project_root>/output"
                  className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
                />
                <StudioButton variant="secondary" size="sm" onClick={handleBrowseOutputDir}>
                  <Folder className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                  <span>{t("btnBrowse")}</span>
                </StudioButton>
                {Boolean(config.output_dir) && (
                  <StudioButton
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 flex items-center justify-center shrink-0 text-[#71717A] hover:text-white"
                    onClick={handleResetOutputDir}
                    title={t("toolsResetProjectBtn")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </StudioButton>
                )}
              </div>
            </div>

            {/* Storage Reclaim */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">
                  {t("cacheSizeLabel")}
                </div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {formatBytes(cacheSize)}
                </div>
              </div>
              <StudioButton
                variant="secondary"
                size="sm"
                onClick={handleClearCache}
                disabled={isClearingCache || cacheSize === 0}
              >
                <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t("btnClearCache")}</span>
              </StudioButton>
            </div>
          </div>

          {/* Card 2: Game Archives & Binary Engine Health */}
          <div className="space-y-5">
            {/* Game Archives Engine */}
            <div className="rounded-2xl bg-[#161619] divide-y divide-white/[0.04] overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Archive className="w-4 h-4 text-[#A3A3A3]" />
                  <span>{t("toolsGameArchivesTitle")}</span>
                </div>
                <StudioButton
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoDetectGameEnvironment}
                  disabled={isDetectingGame}
                >
                  <Compass className={`w-3.5 h-3.5 ${isDetectingGame ? "animate-spin" : ""}`} />
                  <span>{t("btnDetectGame")}</span>
                </StudioButton>
              </div>

              {/* Game Paks Directory */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-neutral-300 block">
                    {t("gameFolderLabel")}
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-neutral-400">
                    {gameEnv?.game_paks_found ? `${gameEnv.paks_count} ${t("toolsPaksFound")}` : t("toolsPaksNotFound")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={config.game_paks_dir || gameEnv?.paks_dir || ""}
                    placeholder=".../Client/Content/Paks"
                    className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
                  />
                  <StudioButton variant="secondary" size="sm" onClick={handleBrowseGamePaksDir}>
                    <Folder className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                    <span>{t("btnBrowse")}</span>
                  </StudioButton>
                </div>
              </div>

              {/* AES Keys File */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-neutral-300 block">
                    {t("keysPathLabel")}
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-neutral-400">
                    {gameEnv?.keys_found ? `${gameEnv.dynamic_keys_count} ${t("toolsKeysFound")}` : t("toolsKeysDefault")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={formatDisplayPath(config.keys_file_path || gameEnv?.keys_path, defaultPaths?.project_root)}
                    placeholder="data/vid.json"
                    className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
                  />
                  <StudioButton variant="secondary" size="sm" onClick={handleBrowseKeysFile}>
                    <Folder className="w-3.5 h-3.5 mr-1 text-neutral-400" />
                    <span>{t("btnBrowse")}</span>
                  </StudioButton>
                </div>
              </div>
            </div>

            {/* Binary Health & Components */}
            <div className="rounded-2xl bg-[#161619] divide-y divide-white/[0.04] overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Wrench className="w-4 h-4 text-[#A3A3A3]" />
                  <span>{t("secToolsTitle")}</span>
                </div>
                <StudioButton
                  variant="ghost"
                  size="sm"
                  onClick={fetchStatus}
                  disabled={isCheckingDeps}
                  className="w-7 h-7 p-0 flex items-center justify-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDeps ? "animate-spin text-white" : "text-[#737373]"}`} />
                </StudioButton>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {[
                  {
                    name: "CUE4Parse Worker Engine",
                    desc: t("toolsToolCue4Parse"),
                    ready: true,
                  },
                  {
                    name: "FFmpeg & ffprobe",
                    desc: t("toolsToolFfmpeg"),
                    ready: deps?.ffmpeg ?? false,
                  },
                  {
                    name: "Wwiser Engine",
                    desc: t("toolsToolWwiser"),
                    ready: deps?.wwiser ?? false,
                  },
                  {
                    name: "vgmstream-cli",
                    desc: t("toolsToolVgmstream"),
                    ready: deps?.vgmstream ?? false,
                  },
                  {
                    name: "Game Database",
                    desc: t("toolsToolGameDb"),
                    ready: deps?.json_data ?? false,
                  },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="p-3 px-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium text-white">{item.name}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        item.ready
                          ? "bg-white/[0.08] text-neutral-200 font-medium"
                          : "bg-white/[0.02] text-neutral-500"
                      }`}
                    >
                      {item.ready ? t("statusInstalled") : t("statusMissing")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
