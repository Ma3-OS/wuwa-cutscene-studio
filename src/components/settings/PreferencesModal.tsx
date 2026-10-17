import React, { useState, useEffect } from "react";
import { Folder, Wrench, Globe, HardDrive, X } from "lucide-react";
import { motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { ToolsAPI, DependencyStatusDto, StorageStatsDto } from "@/core/ipc";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { PathsTab } from "./tabs/PathsTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { StorageTab } from "./tabs/StorageTab";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshLibrary?: () => void;
}

type SettingsTab = "paths" | "tools" | "general" | "storage";

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  onRefreshLibrary,
}) => {
  const { config, updateConfig, t, playSound } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>("paths");

  // Tools & Dep Status
  const [deps, setDeps] = useState<DependencyStatusDto | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [isSyncingTools, setIsSyncingTools] = useState(false);

  // Storage
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [storageStats, setStorageStats] = useState<StorageStatsDto | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchDepsAndCache = async () => {
    setIsCheckingDeps(true);
    try {
      const [depStatus, size, storage] = await Promise.all([
        ToolsAPI.checkDependencies(),
        ToolsAPI.getCacheSize(),
        ToolsAPI.getStorageBreakdown().catch(() => null),
      ]);
      setDeps(depStatus);
      setCacheSize(size);
      if (storage) setStorageStats(storage);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingDeps(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDepsAndCache();
    }
  }, [isOpen]);

  const handleBrowseExportDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.export_dir || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ export_dir: selected });
        toast.success(t("settingsDesc"));
        onRefreshLibrary?.();
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBrowseOutputDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config.output_dir || undefined,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ output_dir: selected });
        toast.success(t("settingsDesc"));
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleSyncAllTools = async () => {
    playSound("click");
    setIsSyncingTools(true);
    try {
      await ToolsAPI.downloadTools();
      await ToolsAPI.downloadData(config.subtitle_lang || "th");
      playSound("success");
      toast.success(t("toolsAndDataTitle") + " " + t("cacheReady"));
      await fetchDepsAndCache();
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
      await ToolsAPI.clearProjectCache().catch(() => {});
      await ToolsAPI.clearAppCache().catch(() => {});
      playSound("success");
      toast.success(t("toastCacheCleared"));
      await fetchDepsAndCache();
    } catch (err) {
      playSound("error");
      toast.error(String(err));
    } finally {
      setIsClearingCache(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  if (!isOpen) return null;

  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 450, damping: 35, mass: 0.8 }}
        className="w-full max-w-3xl h-[520px] bg-[#161619] border border-white/[0.06] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="h-11 px-5 bg-[#141416] border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tracking-wide">
              {t("settingsTitle")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md text-[#737373] hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer outline-none"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body: Left Navigation */}
        <div className="flex-1 flex min-h-0">
          <div className="w-48 bg-[#121214] border-r border-white/[0.04] p-2 space-y-1 shrink-0">
            {[
              { id: "paths" as SettingsTab, label: t("secPathsTitle"), icon: Folder },
              { id: "tools" as SettingsTab, label: t("secToolsTitle"), icon: Wrench },
              { id: "general" as SettingsTab, label: t("secAppearanceTitle"), icon: Globe },
              { id: "storage" as SettingsTab, label: t("secStorageTitle"), icon: HardDrive },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full h-8 px-3 rounded-lg flex items-center gap-2.5 text-xs font-medium transition-all cursor-pointer outline-none text-left ${
                    isActive
                      ? "bg-white/[0.08] text-white font-semibold"
                      : "text-[#A3A3A3] hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-[#737373]"}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "paths" && (
              <PathsTab
                exportDir={config.export_dir || ""}
                outputDir={config.output_dir || ""}
                onBrowseExportDir={handleBrowseExportDir}
                onBrowseOutputDir={handleBrowseOutputDir}
                t={t}
              />
            )}

            {activeTab === "tools" && (
              <ToolsTab
                deps={deps}
                isSyncingTools={isSyncingTools}
                onSyncAllTools={handleSyncAllTools}
                t={t}
              />
            )}

            {activeTab === "general" && (
              <AppearanceTab
                config={config}
                updateConfig={updateConfig}
                t={t}
              />
            )}

            {activeTab === "storage" && (
              <StorageTab
                storageStats={storageStats}
                cacheSize={cacheSize}
                isCheckingDeps={isCheckingDeps}
                isClearingCache={isClearingCache}
                onRefreshStorage={fetchDepsAndCache}
                onClearCache={handleClearCache}
                formatBytes={formatBytes}
                t={t}
              />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
