import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  List
} from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";
import { soundManager } from "../utils/sound";

type ProcessStatus = "idle" | "extracting" | "generating" | "rendering" | "done" | "error";

interface ProcessedVideoItem {
  fullPath: string;
  fileName: string;
  folderName: string; // The leaf folder directly containing the video
  categoryPath: string;
  roverType: "Girl" | "Boy" | "Neutral";
}

export function GalleryView() {
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
  
  // Processing State
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [audioEvents, setAudioEvents] = useState<string[]>([]);

  const handleGenderChange = (newGender: "Girl" | "Boy") => {
    setGender(newGender);
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

  useEffect(() => {
    if (selectedFile) {
      invoke<string[]>("get_video_audio_event", { videoName: selectedFile })
        .then(setAudioEvents)
        .catch(console.error);
    } else {
      setAudioEvents([]);
    }
  }, [selectedFile]);
  
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const config: any = await invoke("get_config");
      if (!config.export_dir) {
        toast.error("Please set the FModel Export Directory in Paths & System first.");
        setLoading(false);
        return;
      }
      if (config.char_selection) setGender(config.char_selection);
      if (config.locale_selection) setLocale(config.locale_selection);
      if (config.subtitle_mode) setSubtitleMode(config.subtitle_mode);

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

  const handleProcess = async () => {
    if (!selectedFile) return;

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
      await invoke("render_video", {
        videoInfo,
        subtitleMode,
      });

      setStatus("done");
      soundManager.playSuccessChime();
      toast.success("Render completed successfully!");
    } catch (e) {
      console.error(e);
      setStatus("error");
      soundManager.playErrorChime();
      toast.error(String(e));
    }
  };

  const handleOpenOutput = async () => {
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
              Cutscene Studio
              <span className="text-xs font-medium text-fg-muted bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                {parsedVideos.length} Video Clips
              </span>
            </h1>
            <p className="text-xs text-fg-muted mt-0.5">Filter by containing folders, rover gender, and render high-fidelity cutscenes.</p>
          </div>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder="Search by clip or folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-fg-muted hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-white' : 'text-fg-muted hover:text-white'}`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button variant="secondary" onClick={fetchFiles} disabled={loading} className="px-3.5 py-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="secondary" onClick={handleOpenOutput} className="px-3.5 py-2 text-xs">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-accent" />
            Output Folder
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
                Folder Filters (Showing folders with clips)
              </div>
              {(selectedFolders.length > 0 || roverFilter !== "All") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-accent hover:underline"
                >
                  Clear All Filters
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
                onClick={() => setSelectedFolders([])}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedFolders.length === 0
                    ? "bg-accent text-white shadow-sm font-semibold"
                    : "bg-white/5 text-fg-muted hover:text-fg hover:bg-white/10 border border-white/5"
                }`}
              >
                <span>All Folders</span>
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
                    onClick={() => toggleFolderFilter(folder.name)}
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
                <SlidersHorizontal className="w-3 h-3" /> Rover:
              </span>
              {(["All", "Girl", "Boy"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoverFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roverFilter === r
                      ? "bg-white/15 text-white font-semibold border border-white/20"
                      : "text-fg-muted hover:text-white bg-white/5 border border-white/5"
                  }`}
                >
                  {r === "All" ? "All Rover Variants" : r === "Girl" ? "Female (Nvzhu)" : "Male (Nanzhu)"}
                </button>
              ))}
            </div>
          </div>

          {/* Video List / Grid Display */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-fg-muted gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs">Scanning exported cutscenes...</span>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-fg-muted gap-2 opacity-60">
                <FileVideo className="w-10 h-10 stroke-[1.2]" />
                <span className="text-xs">No cutscenes match your selected filters</span>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredVideos.map((video) => {
                  const isSelected = selectedFile === video.fullPath;
                  return (
                    <motion.div
                      key={video.fullPath}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedFile(video.fullPath)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                        isSelected
                          ? "bg-accent/15 border-accent shadow-lg shadow-accent/10 ring-1 ring-accent/30"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? 'bg-accent text-white' : 'bg-white/5 text-fg-muted'}`}>
                          <FileVideo className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-fg truncate" title={video.fileName}>
                            {video.fileName.replace(/\.mp4$/i, '')}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] bg-accent/10 text-accent-bright font-medium px-2 py-0.5 rounded-md border border-accent/20 flex items-center gap-1">
                              <Folder className="w-2.5 h-2.5" />
                              {video.folderName}
                            </span>
                            {video.roverType !== "Neutral" && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                                video.roverType === "Girl" 
                                  ? "bg-pink-500/10 text-pink-400 border-pink-500/20" 
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              }`}>
                                {video.roverType === "Girl" ? "♀ Female" : "♂ Male"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] text-fg-subtle">
                        <span>MP4 1080P 60FPS</span>
                        {isSelected && (
                          <span className="text-accent-bright font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
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
                  return (
                    <div
                      key={video.fullPath}
                      onClick={() => setSelectedFile(video.fullPath)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                        isSelected
                          ? "bg-accent/15 border-accent text-white"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileVideo className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent-bright' : 'text-fg-muted'}`} />
                        <span className="text-xs font-medium truncate">{video.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-fg-subtle">{video.folderName}</span>
                        {isSelected && <span className="text-accent-bright font-bold">Selected</span>}
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                Render Configuration
              </h3>

              {/* Selected Cutscene Overview */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2.5">
                <div className="text-[10px] uppercase font-semibold text-fg-muted tracking-wider">Target Cutscene</div>
                <div className="text-xs font-bold text-fg break-all">
                  {selectedFile ? selectedFile.split('/').pop() : "No cutscene selected"}
                </div>
                {audioEvents.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono pt-1">
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{audioEvents[0]}</span>
                  </div>
                )}
              </div>

              {/* Rover Gender Toggle */}
              {/* Rover Gender Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-fg-muted block">Rover Protagonist</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleGenderChange("Girl")}
                    className={`py-2.5 text-xs rounded-xl font-medium border transition-all ${
                      gender === "Girl"
                        ? "bg-accent/20 border-accent/60 text-white shadow-sm font-semibold"
                        : "bg-white/5 border-white/5 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Female (Girl)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenderChange("Boy")}
                    className={`py-2.5 text-xs rounded-xl font-medium border transition-all ${
                      gender === "Boy"
                        ? "bg-accent/20 border-accent/60 text-white shadow-sm font-semibold"
                        : "bg-white/5 border-white/5 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Male (Boy)
                  </button>
                </div>
              </div>

              {/* Subtitle Mode Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-fg-muted block">Subtitle Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Hard-sub", "Soft-sub", "None"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSubtitleModeChange(mode)}
                      className={`py-2.5 text-xs rounded-xl font-medium border transition-all ${
                        subtitleMode === mode
                          ? "bg-accent/20 border-accent/60 text-white shadow-sm font-bold"
                          : "bg-white/5 border-white/5 text-fg-muted hover:text-fg"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Locale */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-fg-muted block">Voice Language</label>
                <select
                  value={locale}
                  onChange={(e) => handleLocaleChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-fg outline-none focus:border-accent/50 appearance-none"
                >
                  <option value="ja" className="bg-bg-deep text-fg">Japanese (ja)</option>
                  <option value="en" className="bg-bg-deep text-fg">English (en)</option>
                  <option value="ko" className="bg-bg-deep text-fg">Korean (ko)</option>
                  <option value="zh-Hans" className="bg-bg-deep text-fg">Chinese (zh-Hans)</option>
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
                      {status === "extracting" ? "Extracting Audio Banks..." :
                       status === "generating" ? "Generating SRT Subtitles..." :
                       status === "rendering" ? "Rendering with FFmpeg..." :
                       status === "done" ? "Rendering Completed!" : "Failed"}
                    </span>
                  </div>

                  {processLogs.length > 0 && (
                    <div className="text-[10px] font-mono text-fg-subtle truncate">
                      {processLogs[processLogs.length - 1]}
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
                    Processing Cutscene...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Start Processing
                  </>
                )}
              </Button>
            </div>

          </SpotlightCard>
        </div>

      </div>
    </div>
  );
}
