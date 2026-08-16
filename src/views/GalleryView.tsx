import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  RefreshCw, 
  FileVideo, 
  Film, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  FolderOpen, 
  Volume2, 
  Sparkles, 
  Check, 
  Folder, 
  SlidersHorizontal, 
  LayoutGrid, 
  List, 
  Clock, 
  Download, 
  HelpCircle,
  HardDrive
} from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";
import { useApp } from "../context/AppContext";

type ProcessStatus = "idle" | "extracting" | "generating" | "rendering" | "done" | "error";

interface DependencyStatus {
  ffmpeg: boolean;
  wwiser: boolean;
  vgmstream: boolean;
  json_data: boolean;
}

interface VideoMetaInfo {
  thumbnail: string;
  duration_secs: number;
  duration_formatted: string;
  resolution: string;
}

interface ProcessedVideoItem {
  fullPath: string;
  fileName: string;
  folderName: string; // The leaf folder directly containing the video
  categoryPath: string;
  roverType: "Girl" | "Boy" | "Neutral";
}

export function GalleryView() {
  const { config: globalConfig, playSound, t, updateConfig } = useApp();

  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Multi-Filter State
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [roverFilter, setRoverFilter] = useState<"All" | "Girl" | "Boy">("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Selection & Config
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [gender, setGender] = useState<"Girl" | "Boy">("Girl");
  const [locale, setLocale] = useState("ja");
  const [subtitleMode, setSubtitleMode] = useState<"None" | "Soft-sub" | "Hard-sub">("Hard-sub");
  const [renderResolution, setRenderResolution] = useState<string>("1920x1080");
  
  // Processing State
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [audioEvents, setAudioEvents] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [videoMetas, setVideoMetas] = useState<Record<string, VideoMetaInfo>>({});
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);
  const [showMissingToolsModal, setShowMissingToolsModal] = useState(false);
  const [syncingTools, setSyncingTools] = useState(false);

  const handleGenderChange = (newGender: "Girl" | "Boy") => {
    setGender(newGender);
    setRoverFilter(newGender); // Automatically filter gallery list to match selected Rover
    invoke("get_config").then((cfg: any) => {
      invoke("update_config", { newConfig: { ...cfg, char_selection: newGender } }).catch(console.error);
    }).catch(console.error);
  };

  const handleSubtitleModeChange = (newMode: "None" | "Soft-sub" | "Hard-sub") => {
    setSubtitleMode(newMode);
    invoke("get_config").then((cfg: any) => {
      invoke("update_config", { newConfig: { ...cfg, subtitle_mode: newMode } }).catch(console.error);
    }).catch(console.error);
  };

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    invoke("get_config").then((cfg: any) => {
      invoke("update_config", { newConfig: { ...cfg, locale_selection: newLocale } }).catch(console.error);
    }).catch(console.error);
  };

  const handleResolutionChange = (newRes: string) => {
    setRenderResolution(newRes);
    invoke("get_config").then((cfg: any) => {
      invoke("update_config", { newConfig: { ...cfg, render_resolution: newRes } }).catch(console.error);
    }).catch(console.error);
  };

  const handleQuickSelectExportDir = async () => {
    playSound("click");
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        await updateConfig({ export_dir: selected });
        toast.success(t("settingsDesc"));
        await fetchFiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncToolsDirectly = async () => {
    playSound("click");
    setSyncingTools(true);
    try {
      await invoke("download_tools");
      await invoke("download_data", { textmapLang: globalConfig.subtitle_lang || "th" });
      playSound("success");
      toast.success("Synchronized successfully!");
      setShowMissingToolsModal(false);
    } catch (err) {
      playSound("error");
      toast.error(String(err));
    } finally {
      setSyncingTools(false);
    }
  };

  useEffect(() => {
    if (selectedFile) {
      invoke<string[]>("get_video_audio_event", { videoName: selectedFile })
        .then(setAudioEvents)
        .catch(console.error);
    } else {
      setAudioEvents([]);
    }
  }, [selectedFile]);

  const handleOpenRawVideo = async () => {
    if (!selectedFile) return;
    try {
      await invoke("open_file", { path: selectedFile });
    } catch (e) {
      toast.error("Could not open raw video file");
    }
  };

  const handleOpenRenderedVideo = async () => {
    if (!renderedVideoPath) return;
    try {
      await invoke("open_file", { path: renderedVideoPath });
    } catch (e) {
      toast.error("Could not open rendered video file");
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const config: any = await invoke("get_config");
      if (!config.export_dir) {
        toast.error("Please set the FModel Export Directory in Paths & System first.");
        setLoading(false);
        return;
      }
      if (config.char_selection) {
        setGender(config.char_selection);
        setRoverFilter(config.char_selection);
      }
      if (config.locale_selection) setLocale(config.locale_selection);
      if (config.subtitle_mode) setSubtitleMode(config.subtitle_mode);
      if (config.render_resolution) setRenderResolution(config.render_resolution);

      const result = await invoke<string[]>("get_exported_videos", { exportDir: config.export_dir });
      setFiles(result);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load video list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    listen<string>("backend-log", (event) => {
      if (isMounted) {
        setProcessLogs(prev => [...prev.slice(-40), event.payload]);
      }
    }).then(unlisten => {
      if (isMounted) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    }).catch(console.error);
    
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Parse videos and extract the direct containing folder
  const parsedVideos = useMemo<ProcessedVideoItem[]>(() => {
    return files.map((raw) => {
      const norm = raw.replace(/\\/g, '/');
      const parts = norm.split('/');
      const fileName = parts[parts.length - 1];
      
      // Immediate parent folder containing this video file
      const folderName = parts.length > 1 ? parts[parts.length - 2] : "Root";
      
      // Determine rover gender tag
      const lower = fileName.toLowerCase();
      let roverType: "Girl" | "Boy" | "Neutral" = "Neutral";
      if (lower.includes("nvzhu") || lower.includes("girl")) {
        roverType = "Girl";
      } else if (lower.includes("nanzhu") || lower.includes("boy")) {
        roverType = "Boy";
      }

      return {
        fullPath: norm,
        fileName,
        folderName,
        categoryPath: parts.slice(0, -1).join('/'),
        roverType,
      };
    });
  }, [files]);

  // Unique direct folders containing videos
  const availableFolders = useMemo(() => {
    const map = new Map<string, number>();
    parsedVideos.forEach(v => {
      map.set(v.folderName, (map.get(v.folderName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [parsedVideos]);

  // Toggle folder selection in multi-filter
  const toggleFolderFilter = (folderName: string) => {
    setSelectedFolders(prev => 
      prev.includes(folderName) ? prev.filter(f => f !== folderName) : [...prev, folderName]
    );
  };

  const clearFilters = () => {
    setSelectedFolders([]);
    setRoverFilter("All");
    setSearchQuery("");
  };

  // Filtered videos based on multi-criteria
  const filteredVideos = useMemo(() => {
    return parsedVideos.filter((v) => {
      // Folder filter
      const matchesFolder = selectedFolders.length === 0 || selectedFolders.includes(v.folderName);
      
      // Rover filter
      const matchesRover = roverFilter === "All" || v.roverType === roverFilter || v.roverType === "Neutral";
      
      // Search text
      const matchesSearch = searchQuery === "" || 
        v.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.folderName.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesFolder && matchesRover && matchesSearch;
    });
  }, [parsedVideos, selectedFolders, roverFilter, searchQuery]);

  // High-performance parallel thumbnail loader for currently filtered/visible videos
  useEffect(() => {
    let active = true;
    
    // Priority 1: selected video, Priority 2: current visible videos in view
    const targetVideos = Array.from(new Set([
      ...(selectedFile ? [selectedFile] : []),
      ...filteredVideos.map(v => v.fullPath)
    ])).filter(path => !thumbnails[path]);

    if (targetVideos.length === 0) return;

    const BATCH_SIZE = 4;
    let idx = 0;

    const loadBatch = async () => {
      while (active && idx < targetVideos.length) {
        const batch = targetVideos.slice(idx, idx + BATCH_SIZE);
        idx += BATCH_SIZE;

        const results = await Promise.all(
          batch.map(async (path) => {
            try {
              const meta = await invoke<VideoMetaInfo>("get_video_meta", { videoPath: path });
              return { path, meta };
            } catch {
              return { path, meta: null };
            }
          })
        );

        if (!active) break;

        const newThumbs: Record<string, string> = {};
        const newMetas: Record<string, VideoMetaInfo> = {};
        for (const res of results) {
          if (res.meta) {
            newMetas[res.path] = res.meta;
            if (res.meta.thumbnail) newThumbs[res.path] = res.meta.thumbnail;
          }
        }

        if (Object.keys(newThumbs).length > 0) {
          setThumbnails(prev => ({ ...prev, ...newThumbs }));
          setVideoMetas(prev => ({ ...prev, ...newMetas }));
        }
      }
    };

    loadBatch();

    return () => {
      active = false;
    };
  }, [filteredVideos, selectedFile]);

  const handleProcess = async () => {
    if (!selectedFile) return;

    // Check if tools exist before starting to prevent dead ends
    try {
      const deps = await invoke<DependencyStatus>("check_dependencies");
      if (!deps.ffmpeg || !deps.wwiser || !deps.vgmstream || !deps.json_data) {
        setShowMissingToolsModal(true);
        playSound("error");
        toast.error(t("guideMissingToolsTitle"));
        return;
      }
    } catch (e) {
      console.warn("Could not pre-check dependencies:", e);
    }

    setStatus("extracting");
    setProcessLogs([]);

    try {
      setStatus("generating");
      const videoInfo: any = await invoke("generate_single_video_info", {
        mp4Path: selectedFile,
        girlOrBoy: gender,
        locale,
      });

      setStatus("rendering");
      const outPath: string = await invoke("render_video", {
        videoInfo,
        subtitleMode,
      });
      setRenderedVideoPath(outPath);

      setStatus("done");
      playSound("success");
      toast.success(t("toastRenderSuccessTitle"));
      if (globalConfig.auto_open_output) {
        invoke("open_output_dir").catch(console.error);
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
      playSound("error");
      toast.error(String(e));
    }
  };

  const handleOpenOutput = async () => {
    playSound("click");
    try {
      await invoke("open_output_dir");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      
      {/* Top Header & Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner-glow shrink-0">
            <Film className="w-6 h-6 text-accent-bright" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg flex items-center gap-2.5">
              {t("galleryTitle")}
              <span className="text-xs font-medium text-fg-muted bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5 font-mono">
                {parsedVideos.length} {t("videoClipsCount")}
              </span>
            </h1>
            <p className="text-xs text-fg-muted mt-0.5">{t("galleryDesc")}</p>
          </div>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                playSound("click");
                setViewMode("grid");
              }}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-fg-muted hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                playSound("click");
                setViewMode("list");
              }}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white' : 'text-fg-muted hover:text-white'}`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button variant="secondary" onClick={fetchFiles} disabled={loading} className="px-3.5 py-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {t("btnRefresh")}
          </Button>

          <Button variant="secondary" onClick={handleOpenOutput} className="px-3.5 py-2 text-xs">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-accent" />
            {t("btnOutputFolder")}
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        
        {/* Left Column: Multi-Filter Folders & Video List */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 min-h-0 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          
          {/* Multi-Filter Bar: Direct Folder Chips & Rover Tags */}
          <div className="space-y-3 pb-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                <Folder className="w-4 h-4 text-accent" />
                {t("folderFilterTitle")}
              </div>
              {(selectedFolders.length > 0 || roverFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    clearFilters();
                  }}
                  className="text-[11px] text-accent hover:underline"
                >
                  {t("btnClearFilters")}
                </button>
              )}
            </div>

            {/* Folder Filter Chips (Multi-Select with Mouse Wheel Scroll) */}
            <div 
              onWheel={(e) => {
                e.currentTarget.scrollLeft += e.deltaY;
              }}
              className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setSelectedFolders([]);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedFolders.length === 0
                    ? "bg-accent text-white shadow-sm font-semibold"
                    : "bg-white/5 text-fg-muted hover:text-fg hover:bg-white/10 border border-white/5"
                }`}
              >
                <span>{t("allFolders")}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white">
                  {parsedVideos.length}
                </span>
              </button>

              {availableFolders.map((folder) => {
                const isSelected = selectedFolders.includes(folder.name);
                return (
                  <button
                    key={folder.name}
                    type="button"
                    onClick={() => {
                      playSound("click");
                      toggleFolderFilter(folder.name);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-accent/20 border-accent text-white font-semibold shadow-sm"
                        : "bg-white/5 border-white/5 text-fg-muted hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span>{folder.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-accent text-white' : 'bg-white/10 text-fg-subtle'}`}>
                      {folder.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Rover Gender Filter Chips */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-fg-subtle mr-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" /> {t("roverFilter")}
              </span>
              {(["All", "Girl", "Boy"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    playSound("click");
                    setRoverFilter(r);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roverFilter === r
                      ? "bg-white/15 text-white font-semibold border border-white/20"
                      : "text-fg-muted hover:text-white bg-white/5 border border-white/5"
                  }`}
                >
                  {r === "All" ? t("roverAll") : r === "Girl" ? t("roverGirl") : t("roverBoy")}
                </button>
              ))}
            </div>
          </div>

          {/* Video List / Grid Display */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-fg-muted gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs">{t("scanningCutscenes")}</span>
              </div>
            ) : !globalConfig.export_dir ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/[0.02] border border-white/5 rounded-2xl gap-4">
                <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-lg shadow-accent/10">
                  <HardDrive className="w-7 h-7 text-accent-bright" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-bold text-fg">{t("guideMissingExportDirTitle")}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">{t("guideMissingExportDirDesc")}</p>
                </div>
                <Button onClick={handleQuickSelectExportDir} className="px-5 py-2.5 text-xs font-bold bg-accent hover:bg-accent-bright text-white shadow-btn-glow flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  <span>{t("guideMissingExportDirAction")}</span>
                </Button>
              </div>
            ) : files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/[0.02] border border-white/5 rounded-2xl gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <HelpCircle className="w-7 h-7 text-amber-400" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-bold text-fg">{t("guideNoVideosFoundTitle")}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">{t("guideNoVideosFoundDesc")}</p>
                  <div className="pt-2">
                    <span className="text-[11px] font-mono bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-fg-subtle block truncate max-w-sm mx-auto">
                      {globalConfig.export_dir}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={handleQuickSelectExportDir} className="px-4 py-2 text-xs">
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                    {t("guideNoVideosFoundAction")}
                  </Button>
                  <Button variant="secondary" onClick={fetchFiles} className="px-4 py-2 text-xs">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    {t("btnRefresh")}
                  </Button>
                </div>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-fg-muted gap-3 opacity-80">
                <FileVideo className="w-10 h-10 stroke-[1.2]" />
                <span className="text-xs">{t("noMatchingVideos")}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedFolders([]);
                    setRoverFilter("All");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-accent-bright border border-white/10 transition-colors"
                >
                  {t("btnClearFilters")}
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredVideos.map((video) => {
                  const isSelected = selectedFile === video.fullPath;
                  const thumb = thumbnails[video.fullPath];
                  return (
                    <motion.div
                      key={video.fullPath}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        playSound("click");
                        setSelectedFile(video.fullPath);
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 overflow-hidden ${
                        isSelected
                          ? "bg-accent/15 border-accent shadow-lg shadow-accent/15 ring-1 ring-accent/40"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      {/* Video Thumbnail Preview Header */}
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/50 border border-white/10 group">
                        {thumb ? (
                          <img 
                            src={thumb} 
                            alt={video.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] text-fg-subtle">
                            <Film className="w-6 h-6 opacity-30 animate-pulse" />
                          </div>
                        )}
                        
                        {/* Overlaid Badges */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="text-[10px] bg-black/70 backdrop-blur-md text-white font-medium px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                            <Folder className="w-2.5 h-2.5 text-accent" />
                            {video.folderName}
                          </span>
                        </div>
                        {video.roverType !== "Neutral" && (
                          <div className="absolute top-2 right-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border backdrop-blur-md ${
                              video.roverType === "Girl" 
                                ? "bg-pink-950/80 text-pink-300 border-pink-500/30" 
                                : "bg-blue-950/80 text-blue-300 border-blue-500/30"
                            }`}>
                              {video.roverType === "Girl" ? t("roverGirl") : t("roverBoy")}
                            </span>
                          </div>
                        )}

                        {/* Duration Badge Bottom Right */}
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                          {videoMetas[video.fullPath]?.duration_formatted && (
                            <span className="text-[10px] bg-black/85 backdrop-blur-md text-white font-mono font-bold px-1.5 py-0.5 rounded border border-white/15 flex items-center gap-1 shadow-md">
                              <Clock className="w-2.5 h-2.5 text-accent" />
                              {videoMetas[video.fullPath].duration_formatted}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Video Info Details */}
                      <div className="flex items-start gap-2.5 px-0.5">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-fg truncate" title={video.fileName}>
                            {video.fileName.replace(/\.mp4$/i, '')}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] text-fg-subtle px-0.5">
                        <span className="font-mono">
                          {videoMetas[video.fullPath]?.resolution || "1080P"}
                          {videoMetas[video.fullPath]?.duration_secs ? ` • ${Math.round(videoMetas[video.fullPath].duration_secs)}s` : ""}
                        </span>
                        {isSelected ? (
                          <span className="text-accent-bright font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {t("selected")}
                          </span>
                        ) : (
                          <span className="text-fg-subtle/60">{t("clickToSelect")}</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVideos.map((video) => {
                  const isSelected = selectedFile === video.fullPath;
                  const thumb = thumbnails[video.fullPath];
                  const meta = videoMetas[video.fullPath];
                  return (
                    <div
                      key={video.fullPath}
                      onClick={() => setSelectedFile(video.fullPath)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3.5 ${
                        isSelected
                          ? "bg-accent/15 border-accent text-white"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Mini Thumbnail */}
                        <div className="w-16 h-10 aspect-video rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/10 relative">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Film className="w-4 h-4 opacity-40" />
                            </div>
                          )}
                          {meta?.duration_formatted && (
                            <div className="absolute bottom-0.5 right-0.5 bg-black/85 text-[8px] font-mono px-1 rounded text-white/90">
                              {meta.duration_formatted}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium truncate block">{video.fileName}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
                            <span>{video.folderName}</span>
                            {meta?.duration_formatted && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-fg-muted flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5 text-accent" />
                                  {meta.duration_formatted} ({Math.round(meta.duration_secs)}s)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        {video.roverType !== "Neutral" && (
                          <span className={`px-1.5 py-0.5 rounded border ${
                            video.roverType === "Girl" ? "bg-pink-500/10 text-pink-400 border-pink-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>
                            {video.roverType === "Girl" ? t("roverGirl") : t("roverBoy")}
                          </span>
                        )}
                        {isSelected && <span className="text-accent-bright font-bold">{t("selected")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Processing Studio Control Panel */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 min-h-0">
          <SpotlightCard className="p-6 flex-1 flex flex-col justify-between border-white/5 overflow-y-auto custom-scrollbar">
            
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-fg flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  {t("studioControls")}
                </h3>
                <span className="text-[10px] text-fg-subtle bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                  {t("globallySynced")}
                </span>
              </div>

              {/* Selected Cutscene Overview & Thumbnail Preview */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase font-semibold text-fg-muted tracking-wider">{t("targetCutscene")}</div>
                  {selectedFile && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenRawVideo}
                        className="text-[11px] text-accent hover:text-accent-bright font-medium flex items-center gap-1 transition-colors"
                        title="Open and preview raw video in system media player"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {t("btnPlayRaw")}
                      </button>
                      <span className="text-white/20">•</span>
                      <button
                        type="button"
                        onClick={() => invoke("open_folder", { path: selectedFile })}
                        className="text-[11px] text-fg-muted hover:text-white font-medium flex items-center gap-1 transition-colors"
                        title="Open folder containing this raw video in Windows Explorer"
                      >
                        <Folder className="w-3 h-3 text-accent" />
                        {t("btnClipFolder")}
                      </button>
                    </div>
                  )}
                </div>
                
                {selectedFile && (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-inner group">
                    {thumbnails[selectedFile] ? (
                      <img 
                        src={thumbnails[selectedFile]} 
                        alt="Target Preview" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-fg-subtle gap-2">
                        <Film className="w-7 h-7 opacity-40 animate-pulse" />
                        <span className="text-[10px]">{t("loadingPreviewFrame")}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs text-white">
                      <span className="text-[11px] font-semibold truncate drop-shadow">{selectedFile.split('/').pop()}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {videoMetas[selectedFile]?.duration_formatted && (
                          <span className="text-[9px] bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded font-mono font-bold border border-white/15 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-accent" />
                            {videoMetas[selectedFile].duration_formatted}
                          </span>
                        )}
                        <span className="text-[9px] bg-accent/80 backdrop-blur-md px-1.5 py-0.5 rounded font-mono font-bold">
                          {videoMetas[selectedFile]?.resolution || "1080P"}
                        </span>
                      </div>
                    </div>

                    {/* Quick Hover Play Action */}
                    <button
                      type="button"
                      onClick={handleOpenRawVideo}
                      className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black/70 hover:bg-accent text-white flex items-center justify-center backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-xl"
                      title={t("btnPlayRaw")}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                  </div>
                )}

                {audioEvents.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono pt-1">
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{audioEvents[0]}</span>
                  </div>
                )}

                {/* Rover Protagonist Option */}
                <div className="pt-2 flex items-center justify-between border-t border-white/5 text-xs">
                  <span className="text-fg-muted font-medium">{t("roverProtagonist")}</span>
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => handleGenderChange("Girl")}
                      className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                        gender === "Girl" ? "bg-accent text-white shadow-sm font-semibold" : "text-fg-muted hover:text-white"
                      }`}
                    >
                      {t("roverGirl")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenderChange("Boy")}
                      className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                        gender === "Boy" ? "bg-accent text-white shadow-sm font-semibold" : "text-fg-muted hover:text-white"
                      }`}
                    >
                      {t("roverBoy")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Aspect Ratio Framing Modes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-fg block flex items-center justify-between">
                  <span>{t("aspectRatioTitle")}</span>
                  <span className="text-[10px] text-accent font-mono font-normal">
                    {renderResolution === "1920x1080" ? "16:9 Zoom Fill" : renderResolution === "2560x1080" ? "21:9 Letterbox" : "Native Match"}
                  </span>
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "1920x1080", label: t("aspect16_9"), desc: t("aspect16_9_desc"), hint: t("aspect16_9_hint") },
                    { id: "2560x1080", label: t("aspect21_9"), desc: t("aspect21_9_desc"), hint: t("aspect21_9_hint") },
                    { id: "original", label: t("aspectNative"), desc: t("aspectNative_desc"), hint: t("aspectNative_hint") },
                  ].map((res) => {
                    const isSelected = renderResolution === res.id || (!renderResolution && res.id === "1920x1080");
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => handleResolutionChange(res.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-accent/20 border-accent text-white shadow-md shadow-accent/15 ring-1 ring-accent/30"
                            : "bg-white/5 border-white/5 text-fg-muted hover:text-fg hover:bg-white/10"
                        }`}
                        title={res.hint}
                      >
                        <span className="text-xs font-bold leading-none block">{res.label}</span>
                        <span className="text-[9px] opacity-70 mt-1 block">{res.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subtitle Mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-fg block">{t("subtitleModeTitle")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["None", "Soft-sub", "Hard-sub"] as const).map((mode) => {
                    const isSelected = subtitleMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleSubtitleModeChange(mode)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "bg-accent/20 border-accent text-white shadow-md shadow-accent/15 font-semibold"
                            : "bg-white/5 border-white/5 text-fg-muted hover:text-fg hover:bg-white/10 text-xs"
                        }`}
                      >
                        <span className="text-xs">{mode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice Locale */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-fg block">{t("voiceLanguageTitle")}</label>
                <select
                  value={locale}
                  onChange={(e) => handleLocaleChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-fg outline-none focus:border-accent/50 appearance-none"
                >
                  <option value="ja" className="bg-bg-deep text-fg">{t("langJa")}</option>
                  <option value="en" className="bg-bg-deep text-fg">{t("langEn")}</option>
                  <option value="ko" className="bg-bg-deep text-fg">{t("langKo")}</option>
                  <option value="zh-Hans" className="bg-bg-deep text-fg">{t("langZh")}</option>
                </select>
              </div>
            </div>

            {/* Render Action & Status */}
            <div className="pt-5 border-t border-white/5 space-y-3.5">
              {status !== "idle" && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-fg-muted capitalize flex items-center gap-2">
                      {status === "extracting" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                      {status === "generating" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                      {status === "rendering" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                      {status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {status === "extracting" ? t("extractingAudioBanks") :
                       status === "generating" ? t("generatingSrtSubtitles") :
                       status === "rendering" ? t("renderingWithFfmpeg") :
                       status === "done" ? t("renderingCompleted") : t("renderingFailed")}
                    </span>
                  </div>

                  {processLogs.length > 0 && (
                    <div className="text-[10px] font-mono text-fg-subtle truncate">
                      {processLogs[processLogs.length - 1]}
                    </div>
                  )}

                  {/* Finished Action Buttons */}
                  {status === "done" && (
                    <div className="pt-2 flex items-center gap-2">
                      {renderedVideoPath && (
                        <Button
                          onClick={handleOpenRenderedVideo}
                          className="flex-1 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {t("playRenderedVideo")}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenOutput}
                        className="py-2 px-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                        title={t("btnOutputFolder")}
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-accent-bright" />
                        {t("btnOutputFolder")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleProcess}
                disabled={!selectedFile || (status !== "idle" && status !== "done" && status !== "error")}
                className="w-full py-3.5 text-xs font-bold shadow-lg shadow-accent/20"
              >
                {status === "extracting" || status === "generating" || status === "rendering" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("processingCutscene")}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    {t("startProcessing")}
                  </>
                )}
              </Button>
            </div>

          </SpotlightCard>
        </div>

      </div>

      {/* Missing Tools & Dependencies Smart Helper Modal */}
      {showMissingToolsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0f1015] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-fg">{t("guideMissingToolsTitle")}</h3>
                <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">{t("guideMissingToolsDesc")}</p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 text-xs text-fg-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  FFmpeg (Video & Audio Mixer)
                </span>
                <span className="text-[10px] text-fg-subtle">v7.x / CLI</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  vgmstream (Opus / Wwise Audio)
                </span>
                <span className="text-[10px] text-fg-subtle">Latest</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Wwiser (Soundbank Analyzer)
                </span>
                <span className="text-[10px] text-fg-subtle">Python Engine</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Game Subtitle Textmap
                </span>
                <span className="text-[10px] text-fg-subtle">Kuro MultiText</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowMissingToolsModal(false)}
                className="px-4 py-2 text-xs"
              >
                {t("btnCancel")}
              </Button>
              <Button
                onClick={handleSyncToolsDirectly}
                disabled={syncingTools}
                className="px-4 py-2 text-xs bg-accent hover:bg-accent-bright text-white shadow-btn-glow flex items-center gap-1.5"
              >
                {syncingTools ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("btnSyncing")}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("guideMissingToolsAction")}</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
