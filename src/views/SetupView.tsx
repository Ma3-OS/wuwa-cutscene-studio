import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Download, FolderOpen, CheckCircle2, AlertCircle, Loader2, Settings2, HardDrive, Cpu, RotateCcw } from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";

interface AppConfig {
  ffmpeg_path: string;
  vgmstream_path: string;
  export_dir: string;
  output_dir: string;
  render_resolution: string;
  char_selection: string;
  locale_selection: string;
  subtitle_lang: string;
  subtitle_mode: string;
}

interface ProgressPayload {
  task: string;
  progress: number;
}

interface DependencyStatus {
  ffmpeg: boolean;
  wwiser: boolean;
  vgmstream: boolean;
  json_data: boolean;
}

export function SetupView() {
  const [config, setConfig] = useState<AppConfig>({
    ffmpeg_path: "",
    vgmstream_path: "",
    export_dir: "",
    output_dir: "",
    render_resolution: "original",
    char_selection: "Girl",
    locale_selection: "ja",
    subtitle_lang: "th",
    subtitle_mode: "Hard-sub",
  });
  
  const [downloading, setDownloading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [deps, setDeps] = useState<DependencyStatus | null>(null);

  const checkDeps = async () => {
    try {
      const status = await invoke<DependencyStatus>("check_dependencies");
      setDeps(status);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).catch(console.error);
    checkDeps();

    const unlistenLog = listen<string>("backend-log", (event) => {
      const text = typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
      setLogs((prev) => [...prev.slice(-6), text]);
    });
    const unlistenProgress = listen<ProgressPayload>("downloader-progress", (event) => {
      setCurrentTask(event.payload.task);
      setProgress(event.payload.progress * 100);
    });

    return () => {
      unlistenLog.then((f) => f());
      unlistenProgress.then((f) => f());
    };
  }, []);

  const updateConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      await invoke("update_config", { newConfig });
    } catch (e) {
      console.error(e);
    }
  };

  const selectDir = async (key: keyof AppConfig) => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      updateConfig({ ...config, [key]: selected });
      toast.success("Folder path updated!");
    }
  };

  const handleResetOutputDir = () => {
    updateConfig({ ...config, output_dir: "" });
    toast.success("Reset output folder to application default");
  };

  const handleOpenOutput = async () => {
    try {
      await invoke("open_output_dir");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    setProgress(0);
    setLogs([]);
    try {
      await invoke("download_tools");
      await invoke("download_data");
      await checkDeps();
      toast.success("All dependencies and game databases synchronized!");
    } catch (e) {
      console.error(e);
      toast.error(String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-6xl w-full mx-auto space-y-8 pb-16">
        
        {/* Header */}
        <header className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner-glow shrink-0">
            <Settings2 className="w-5 h-5 text-accent-bright" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg">Paths & System Setup</h1>
            <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
              Manage FModel export directories, custom render output paths, and game databases.
            </p>
          </div>
        </header>

        {/* Directory Paths Section */}
        <SpotlightCard className="p-6 border-white/5 space-y-5">
          <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent" />
            Directory Configuration
          </h2>
          
          <div className="space-y-5">
            {/* FModel Export Dir */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-fg-muted">FModel Export Directory (Input Cutscenes & Audio)</label>
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
                  Browse Folder
                </Button>
              </div>
              <p className="text-[11px] text-fg-subtle">
                Path containing exported Movies and WwiseAudio_Generated folders.
              </p>
            </div>

            {/* Custom Output Dir */}
            <div className="space-y-1.5 pt-3 border-t border-white/[0.04]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-fg-muted">Rendered Video Output Directory</label>
                {config.output_dir && (
                  <button
                    type="button"
                    onClick={handleResetOutputDir}
                    className="text-[11px] text-fg-subtle hover:text-accent flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default
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
                  Change Location
                </Button>
                <Button variant="secondary" onClick={handleOpenOutput} className="px-3.5 py-2 text-xs">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  Open Folder
                </Button>
              </div>
              <p className="text-[11px] text-fg-subtle">
                Where finalized videos and mixed audio tracks are saved.
              </p>
            </div>
          </div>
        </SpotlightCard>

        {/* Required Dependencies Section */}
        <SpotlightCard className="p-6 border-white/5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-fg uppercase flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              Core Dependencies & Metadata
            </h2>
            <Button variant="secondary" onClick={checkDeps} className="text-xs py-1 px-2.5 h-7">
              Check Status
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DependencyItem name="FFmpeg (H.264 / Audio Mixer)" isReady={deps?.ffmpeg} />
            <DependencyItem name="Wwiser (Audio Bank Extractor)" isReady={deps?.wwiser} />
            <DependencyItem name="vgmstream (Opus Audio Decoder)" isReady={deps?.vgmstream} />
            <DependencyItem name="WutheringWaves Data (v3.5 JSON)" isReady={deps?.json_data} />
          </div>

          {downloading && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-fg">{currentTask || "Downloading dependencies..."}</h4>
                <span className="text-xs font-mono font-bold text-accent-bright">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-accent-bright"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-3 p-3 bg-black/40 rounded-xl font-mono text-[11px] text-fg-muted space-y-1 overflow-x-auto border border-white/5">
              {logs.map((log, i) => (
                <div key={i} className="truncate">{log}</div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Button 
              onClick={handleDownloadAll} 
              disabled={downloading}
              className="w-full py-2.5 text-xs font-bold"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing Tools & Databases...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Sync All Dependencies & Databases
                </>
              )}
            </Button>
          </div>
        </SpotlightCard>

      </div>
    </motion.div>
  );
}

function DependencyItem({ name, isReady }: { name: string; isReady?: boolean }) {
  return (
    <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-fg">{name}</span>
      {isReady === undefined ? (
        <Loader2 className="w-4 h-4 animate-spin text-fg-subtle" />
      ) : isReady ? (
        <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Ready
        </span>
      ) : (
        <span className="text-xs text-amber-400 flex items-center gap-1.5 font-semibold">
          <AlertCircle className="w-4 h-4" /> Missing
        </span>
      )}
    </div>
  );
}
