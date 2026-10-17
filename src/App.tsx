import { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
import { TitleBar } from "./components/shell/TitleBar";
import { Sidebar, WorkspaceMode } from "./components/shell/Sidebar";
import { GalleryView } from "./views/GalleryView";
import { Inspector } from "./components/shell/Inspector";
import { SubtitleLabView } from "./views/SubtitleLabView";
import { AudioEngineView } from "./views/AudioEngineView";
import { BatchQueueView } from "./views/BatchQueueView";
import { ToolsSetupView } from "./views/ToolsSetupView";
import { TerminalDrawer } from "./components/shell/TerminalDrawer";
import { PreferencesModal } from "./components/settings/PreferencesModal";
import { QuickLookModal } from "./components/studio/QuickLookModal";
import { FloatingActionBar } from "./components/studio/FloatingActionBar";
import { ExtractionProgressModal } from "./components/ui/ExtractionProgressModal";
import { useExtractionStore } from "./features/catalog/stores/useExtractionStore";
import { setupGlobalEventListeners } from "./core/events/listener";
import { ScannerAPI, RendererAPI, ToolsAPI, ExtractorAPI } from "./core/ipc";
import { AppProvider, useApp } from "./context/AppContext";
import { useQueueStore } from "./features/queue/stores/useQueueStore";
import { useTaskStore } from "./features/task-monitor/stores/useTaskStore";
import {
  useCatalogStore,
  type ProcessedVideoItem,
  type VideoMetaInfo,
} from "./features/catalog/stores/useCatalogStore";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import "./index.css";

function AppContent() {
  const { config, updateConfig, t, playSound } = useApp();
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const isExtracting = useExtractionStore((s) => s.isRunning && s.taskType === "extraction");

  // Active Workspace Mode
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>("studio");

  // Refresh Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cutscene Selection State
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("");
  const [selectedMeta, setSelectedMeta] = useState<VideoMetaInfo | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProcessedVideoItem | null>(null);
  const [audioEventCount, setAudioEventCount] = useState<number>(0);

  // Quick Look State
  const [quickLookVideo, setQuickLookVideo] = useState<ProcessedVideoItem | null>(null);
  const [quickLookMeta, setQuickLookMeta] = useState<VideoMetaInfo | null>(null);
  const catalogItems = useCatalogStore((state) => state.items);

  const partnerRoverItem = useMemo(() => {
    if (!quickLookVideo || !quickLookVideo.baseCgName) return null;
    const targetGender = quickLookVideo.roverType === "Girl" ? "Boy" : "Girl";
    return (
      catalogItems.find(
        (v) => v.baseCgName === quickLookVideo.baseCgName && v.roverType === targetGender
      ) || null
    );
  }, [quickLookVideo, catalogItems]);

  // Panels & Overlays
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Anti-Cheat Daemon Status
  const [isGameRunning, setIsGameRunning] = useState(false);

  // Rendering State
  const [isRendering, setIsRendering] = useState(false);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);

  // Options from config
  const gender = (config.char_selection as "Girl" | "Boy") || "Girl";
  const locale = config.locale_selection || "ja";
  const subtitleMode = (config.subtitle_mode as "None" | "Soft-sub" | "Hard-sub") || "Hard-sub";
  const renderResolution = config.render_resolution || "1920x1080";

  // Global Listeners & Game Detection
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setupGlobalEventListeners().then((fn) => {
      cleanup = fn;
    });

    ScannerAPI.isGameRunning().then(setIsGameRunning).catch(console.error);
    const gameTimer = setInterval(() => {
      ScannerAPI.isGameRunning().then(setIsGameRunning).catch(console.error);
    }, 10000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setIsPreferencesOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (cleanup) cleanup();
      clearInterval(gameTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Pre-warm CUE4Parse Worker daemon in background
  useEffect(() => {
    ExtractorAPI.detectGameEnvironment().then(async (env) => {
      if (env.game_paks_found) {
        try {
          await ExtractorAPI.startExtractorDaemon(
            config.game_paks_dir || env.paks_dir,
            env.keys_path || config.keys_file_path
          );
        } catch (e) {
          console.warn("Daemon startup notice:", e);
        }
      }
    }).catch(console.error);
  }, [config.game_paks_dir, config.keys_file_path]);
  useEffect(() => {
    if (selectedFile) {
      RendererAPI.getVideoAudioEvent(selectedFile)
        .then((events) => setAudioEventCount(events.length))
        .catch(() => setAudioEventCount(0));
    } else {
      setAudioEventCount(0);
      setRenderedVideoPath(null);
    }
  }, [selectedFile]);

  // Video Selection Handler (Single or Multi-select)
  const handleSelectVideo = useCallback(
    (
      video: ProcessedVideoItem | null,
      meta?: VideoMetaInfo | null,
      isMultiSelect: boolean = false
    ) => {
      if (!video) {
        setSelectedFile(null);
        setSelectedFiles(new Set());
        setSelectedFileName("");
        setSelectedFolderPath("");
        setSelectedMeta(null);
        setSelectedItem(null);
        return;
      }

      setSelectedItem(video);
      const selKey = video.uniqueId || video.fullPath;

      if (isMultiSelect) {
        setSelectedFiles((prev) => {
          const next = new Set(prev);
          if (next.has(selKey)) {
            next.delete(selKey);
          } else {
            next.add(selKey);
          }
          return next;
        });
        setSelectedFile(selKey);
        setSelectedFileName(video.fileName);
        setSelectedFolderPath(video.folderName);
        setSelectedMeta(meta || null);
      } else {
        setSelectedFiles(new Set([selKey]));
        setSelectedFile(selKey);
        setSelectedFileName(video.fileName);
        setSelectedFolderPath(video.folderName);
        setSelectedMeta(meta || null);
        setIsInspectorOpen(true);
      }
    },
    []
  );

  // Quick Look Trigger with auto-extraction for un-cached game archives
  const handleOpenQuickLook = useCallback(
    async (video: ProcessedVideoItem, meta?: VideoMetaInfo | null) => {
      useTaskStore.getState().appendLog({
        message: `เปิดพรีวิวคัตซีน ${video.fileName} เพศ ${
          video.roverType === "Girl" ? "โรเวอร์หญิง" : video.roverType === "Boy" ? "โรเวอร์ชาย" : "ทั่วไป"
        }`,
        level: "info",
      });

      // 3D Level Sequences render in-engine and do not have an MP4 file in the PAKs
      if (video.isLevelSequence && !video.hasVideo) {
        setQuickLookVideo(video);
        setQuickLookMeta(meta || null);
        return;
      }

      const isPathPlayable =
        Boolean(video.fullPath) &&
        (video.fullPath.toLowerCase().endsWith(".mp4") ||
          video.fullPath.toLowerCase().endsWith(".bk2") ||
          video.fullPath.toLowerCase().endsWith(".mkv") ||
          video.fullPath.toLowerCase().endsWith(".webm")) &&
        !video.fullPath.startsWith("Client/") &&
        !video.fullPath.startsWith("/Game/") &&
        !video.fullPath.startsWith("Game/");

      const needsExtraction =
        (!video.isCached || !video.audio_ready || !isPathPlayable) &&
        Boolean(video.cgName && video.cgFile);

      if (needsExtraction) {
        toast.info(`กำลังสกัดไฟล์คัตซีน ${video.fileName} จากคลังเกม`, { id: "studio-op" });
        useTaskStore.getState().appendLog({
          message: `เริ่มการสกัดไฟล์คัตซีน ${video.fileName} เพื่อเปิดพรีวิว`,
          level: "info",
        });

        const reqId = crypto.randomUUID();
        useExtractionStore.getState().startExtraction(video.fileName || video.cgName || "cutscene", reqId);

        try {
          const soundEvents = await RendererAPI.getVideoAudioEvent(video.cgName || video.fileName || "").catch(() => []);
          const res = await ExtractorAPI.extractCutsceneOnDemand(
            video.cgName!,
            video.cgFile!,
            soundEvents,
            reqId
          );
          useExtractionStore.getState().finishExtraction();
          useExtractionStore.getState().close();

          const updated: ProcessedVideoItem = {
            ...video,
            fullPath: res.video_file,
            isCached: true,
            audio_ready: true,
            folderName: "คลังในเครื่อง",
          };
          useCatalogStore.getState().updateItem(video.uniqueId || video.cgFile || video.fullPath, updated);

          const thumbMeta = res.thumbnail_base64
            ? {
                thumbnail: res.thumbnail_base64,
                duration_secs: meta?.duration_secs || 0,
                duration_formatted: meta?.duration_formatted || "",
                resolution: meta?.resolution || "1080p",
              }
            : meta || null;

          setQuickLookVideo(updated);
          setQuickLookMeta(thumbMeta);
          useTaskStore.getState().appendLog({
            message: `เปิดพรีวิวคัตซีน ${video.fileName} สำเร็จ`,
            level: "success",
          });
          return;
        } catch (err) {
          if (
            String(err).includes("CANCELLED") ||
            String(err).includes("ยกเลิก") ||
            useExtractionStore.getState().isCancelled
          ) {
            return;
          }
          useExtractionStore.getState().setError(String(err));
          const errMsg = "ไม่สามารถเปิดวิดีโอได้: " + String(err);
          useTaskStore.getState().appendLog({
            message: errMsg,
            level: "error",
          });
          toast.error(errMsg, { id: "studio-op" });
          return;
        }
      }
      setQuickLookVideo(video);
      setQuickLookMeta(meta || null);
    },
    []
  );

  // Extract Raw Cutscene Assets to Project Folder
  const handleExtractRaw = async () => {
    if (!selectedFile) return;

    const currentItem =
      selectedItem ||
      useCatalogStore
        .getState()
        .items.find(
          (x) =>
            x.uniqueId === selectedFile ||
            x.fullPath === selectedFile ||
            x.cgFile === selectedFile ||
            x.cgName === selectedFile
        );

    if (!currentItem || !currentItem.cgName || !currentItem.cgFile) return;

    useTaskStore.getState().appendLog({
      message: `เริ่มคำขอสกัดไฟล์ต้นฉบับ ${currentItem.fileName || currentItem.cgName} ลงโฟลเดอร์โปรเจกต์`,
      level: "info",
    });

    try {
      const reqId = crypto.randomUUID();
      useExtractionStore.getState().startExtraction(currentItem.fileName || currentItem.cgName, reqId, "extraction");
      const soundEvents = await RendererAPI.getVideoAudioEvent(currentItem.cgName || currentItem.fileName).catch(() => []);
      const res = await ExtractorAPI.extractCutsceneOnDemand(
        currentItem.cgName,
        currentItem.cgFile,
        soundEvents,
        reqId
      );
      useExtractionStore.getState().finishExtraction();

      if (res.video_file) {
        const updated: ProcessedVideoItem = {
          ...currentItem,
          fullPath: res.video_file,
          isCached: true,
          hasVideo: true,
          isLevelSequence: false,
          audio_ready: true,
          folderName: "คลังในเครื่อง",
        };
        setSelectedItem(updated);
        setSelectedFile(res.video_file);
        useCatalogStore.getState().updateItem(currentItem.uniqueId || currentItem.cgFile || currentItem.fullPath, updated);
        useTaskStore.getState().appendLog({
          message: `สกัดไฟล์ต้นฉบับสำเร็จ ${res.video_file}`,
          level: "success",
        });
        toast.success("สกัดไฟล์ต้นฉบับลงโฟลเดอร์โปรเจกต์สำเร็จ", { id: "studio-op" });
      } else if (res.audio_files && res.audio_files.length > 0) {
        const updated: ProcessedVideoItem = {
          ...currentItem,
          audio_ready: true,
        };
        setSelectedItem(updated);
        useCatalogStore.getState().updateItem(currentItem.uniqueId || currentItem.cgFile || currentItem.fullPath, updated);
        useTaskStore.getState().appendLog({
          message: `สกัดไฟล์เสียงสำหรับ 3D Sequence ${currentItem.fileName || currentItem.cgName} สำเร็จ ${res.audio_files.length} รายการ`,
          level: "success",
        });
        toast.success("สกัดไฟล์เสียงสำหรับ 3D Sequence ลงโฟลเดอร์โปรเจกต์สำเร็จ", { id: "studio-op" });
      }
    } catch (err) {
      if (
        String(err).includes("CANCELLED") ||
        String(err).includes("ยกเลิก")
      ) {
        useTaskStore.getState().appendLog({
          message: "การสกัดไฟล์ต้นฉบับถูกยกเลิกโดยผู้ใช้",
          level: "warn",
        });
        return;
      }
      console.error(err);
      playSound("error");
      const errMsg = "การสกัดขัดข้อง: " + String(err);
      useTaskStore.getState().appendLog({
        message: errMsg,
        level: "error",
      });
      toast.error(errMsg, { id: "studio-op" });
    }
  };

  // Single Render Execution
  const handleRender = async () => {
    if (!selectedFile) return;
    useExtractionStore.setState({ isCancelled: false });

    const currentItem =
      selectedItem ||
      useCatalogStore
        .getState()
        .items.find(
          (x) =>
            x.uniqueId === selectedFile ||
            x.fullPath === selectedFile ||
            x.cgFile === selectedFile ||
            x.cgName === selectedFile
        );

    if (!currentItem) return;

    useTaskStore.getState().appendLog({
      message: `เริ่มคำขอเรนเดอร์คัตซีน ${currentItem.fileName || currentItem.cgName}`,
      level: "info",
    });

    // 1. Video Dependencies Check
    try {
      useTaskStore.getState().appendLog({
        message: "กำลังตรวจสอบเครื่องมือระบบ FFmpeg Wwiser และ vgmstream",
        level: "info",
      });
      const deps = await ToolsAPI.checkDependencies();
      if (!deps.ffmpeg || !deps.wwiser || !deps.vgmstream) {
        useTaskStore.getState().appendLog({
          message: "ไม่พบเครื่องมือระบบที่จำเป็นสำหรับการเรนเดอร์ กรุณาตรวจสอบในหน้าต่าง Preferences",
          level: "error",
        });
        toast.error(t("guideMissingToolsTitle"), {
          description: t("guideMissingToolsDesc"),
          action: {
            label: t("guideMissingToolsAction"),
            onClick: () => setIsPreferencesOpen(true),
          },
        });
        return;
      }
    } catch (depErr) {
      console.warn("Dependency check warning:", depErr);
    }

    setIsRendering(true);
    setIsTerminalOpen(true);
    playSound("click");

    try {
      // 2. Resolve or extract cutscene video asset
      let targetDiskPath = currentItem.fullPath || "";
      if (!targetDiskPath && selectedFile) {
        const colonIdx = Math.max(selectedFile.lastIndexOf(":\\"), selectedFile.lastIndexOf(":/"));
        targetDiskPath = colonIdx >= 1 ? selectedFile.slice(colonIdx - 1) : selectedFile;
      }

      const isPathValidDisk = Boolean(
        targetDiskPath &&
          !targetDiskPath.startsWith("http") &&
          !targetDiskPath.startsWith("data:") &&
          (targetDiskPath.includes("/") ||
            targetDiskPath.includes("\\") ||
            targetDiskPath.endsWith(".mp4") ||
            targetDiskPath.endsWith(".bk2") ||
            targetDiskPath.endsWith(".mkv"))
      );

      const needsExtraction =
        !currentItem.isCached ||
        !isPathValidDisk ||
        (currentItem.hasVideo && !targetDiskPath);

      if (needsExtraction && currentItem.cgName && currentItem.cgFile) {
        useTaskStore.getState().appendLog({
          message: `กำลังเริ่มสกัดไฟล์สำหรับ ${currentItem.fileName || currentItem.cgName} จากแพ็กเกจเกม`,
          level: "info",
        });
        toast.info(`กำลังสกัดไฟล์คัตซีน ${currentItem.fileName || currentItem.cgName} จากคลังเกม`, { id: "studio-op" });
        const reqId = crypto.randomUUID();
        useExtractionStore.getState().startExtraction(currentItem.fileName || currentItem.cgName, reqId);
        const soundEvents = await RendererAPI.getVideoAudioEvent(currentItem.cgName || currentItem.fileName).catch(() => []);
        const res = await ExtractorAPI.extractCutsceneOnDemand(
          currentItem.cgName,
          currentItem.cgFile,
          soundEvents,
          reqId
        );
        useExtractionStore.getState().finishExtraction();

        if (res.video_file) {
          targetDiskPath = res.video_file;
          const updated: ProcessedVideoItem = {
            ...currentItem,
            fullPath: res.video_file,
            isCached: true,
            hasVideo: true,
            isLevelSequence: false,
            audio_ready: true,
            folderName: "คลังในเครื่อง",
          };
          setSelectedItem(updated);
          setSelectedFile(res.video_file);
          useCatalogStore.getState().updateItem(currentItem.uniqueId || currentItem.cgFile || currentItem.fullPath, updated);
          useTaskStore.getState().appendLog({
            message: `สกัดไฟล์วิดีโอสำเร็จ ${res.video_file}`,
            level: "success",
          });
        } else if (res.audio_files && res.audio_files.length > 0) {
          const updated: ProcessedVideoItem = {
            ...currentItem,
            audio_ready: true,
          };
          setSelectedItem(updated);
          useCatalogStore.getState().updateItem(currentItem.uniqueId || currentItem.cgFile || currentItem.fullPath, updated);
          useTaskStore.getState().appendLog({
            message: `คัตซีน ${currentItem.fileName || currentItem.cgName} เป็น 3D In Engine Sequence ที่ไม่มีไฟล์วิดีโอ MP4 ในเกม สกัดเฉพาะไฟล์เสียงสำเร็จ ${res.audio_files.length} รายการ`,
            level: "info",
          });
          toast.info("คัตซีนนี้เป็น 3D Sequence ในเอนจินเกม ไม่มีไฟล์วิดีโอ MP4 ในแพ็กเกจเกม สกัดไฟล์เสียงเรียบร้อยแล้ว", { id: "studio-op" });
          setIsRendering(false);
          return;
        }
      }

      const isValidFinal = Boolean(
        targetDiskPath &&
          !targetDiskPath.startsWith("http") &&
          !targetDiskPath.startsWith("data:") &&
          (targetDiskPath.includes("/") ||
            targetDiskPath.includes("\\") ||
            targetDiskPath.endsWith(".mp4") ||
            targetDiskPath.endsWith(".bk2") ||
            targetDiskPath.endsWith(".mkv"))
      );

      if (!targetDiskPath || !isValidFinal) {
        const notFoundMsg = `ไม่พบไฟล์วิดีโอบนดิสก์สำหรับ ${currentItem.fileName || currentItem.cgName}`;
        useTaskStore.getState().appendLog({
          message: notFoundMsg,
          level: "error",
        });
        toast.error(notFoundMsg, { id: "studio-op" });
        setIsRendering(false);
        return;
      }

      useTaskStore.getState().appendLog({
        message: `เตรียมไฟล์วิดีโอต้นฉบับสำเร็จ ${targetDiskPath}`,
        level: "info",
      });

      // 3. Generate single video info (audio probing and subtitle alignment)
      const renderGender = currentItem.roverType === "Girl" ? "Girl" : currentItem.roverType === "Boy" ? "Boy" : gender;
      useTaskStore.getState().appendLog({
        message: `กำลังวิเคราะห์แทร็กเสียงและซับไตเติลภาษา ${locale} ตัวละคร ${renderGender}`,
        level: "info",
      });

      const payload = await RendererAPI.generateSingleVideoInfo(
        targetDiskPath,
        locale,
        renderGender
      );

      useTaskStore.getState().appendLog({
        message: `จัดเตรียมข้อมูลเรนเดอร์สำเร็จ แทร็กเสียง ${payload.sounds.length} แทร็ก ส่งต่อไปยัง FFmpeg`,
        level: "info",
      });

      // 4. Invoke FFmpeg rendering
      useTaskStore.getState().appendLog({
        message: `กำลังประมวลผลเรนเดอร์ด้วย FFmpeg โหมดซับไตเติล ${subtitleMode} ความละเอียด ${renderResolution}`,
        level: "info",
      });

      const outputPath = await RendererAPI.renderVideo(payload, subtitleMode);
      setRenderedVideoPath(outputPath);
      playSound("success");

      useTaskStore.getState().appendLog({
        message: `เรนเดอร์คัตซีนสำเร็จ บันทึกไฟล์ที่ ${outputPath}`,
        level: "success",
      });

      toast.success(t("toastRenderSuccessTitle"), {
        id: "studio-op",
        description: t("toastRenderSuccessDesc"),
      });

      // Reveal rendered file in explorer without opening media player
      ToolsAPI.showInFolder(outputPath).catch(() => {});
    } catch (err) {
      if (
        String(err).includes("CANCELLED") ||
        String(err).includes("ยกเลิก")
      ) {
        useTaskStore.getState().appendLog({
          message: "การเรนเดอร์ถูกยกเลิกโดยผู้ใช้",
          level: "warn",
        });
        return;
      }
      console.error(err);
      playSound("error");
      const errMsg = "การเรนเดอร์ขัดข้อง: " + String(err);
      useTaskStore.getState().appendLog({
        message: errMsg,
        level: "error",
      });
      toast.error(t("renderingFailed"), {
        id: "studio-op",
        description: String(err),
      });
    } finally {
      setIsRendering(false);
    }
  };

  const handleCancelRender = async () => {
    try {
      useTaskStore.getState().appendLog({
        message: "ส่งคำขอยกเลิกการเรนเดอร์ไปยังระบบ",
        level: "warn",
      });
      useExtractionStore.getState().cancel();
      await RendererAPI.cancelRender();
      toast.info("ยกเลิกการเรนเดอร์เรียบร้อยแล้ว");
    } catch (err) {
      console.error("Cancel render error:", err);
    } finally {
      setIsRendering(false);
    }
  };

  // Batch Queue Submission
  const handleAddSelectedToQueue = () => {
    if (selectedFiles.size === 0) return;
    playSound("click");

    const catalogItems = useCatalogStore.getState().items;
    const newQueueItems = Array.from(selectedFiles).map((fileKey) => {
      const matched = catalogItems.find(
        (x) =>
          x.uniqueId === fileKey ||
          x.fullPath === fileKey ||
          x.cgFile === fileKey
      );
      let targetPath = matched?.fullPath || matched?.cgFile || fileKey;
      if (targetPath.includes(":\\") || targetPath.includes(":/")) {
        const colonIdx = Math.max(targetPath.lastIndexOf(":\\"), targetPath.lastIndexOf(":/"));
        if (colonIdx >= 1) {
          targetPath = targetPath.slice(colonIdx - 1);
        }
      }

      const name = matched?.fileName || targetPath.split("/").pop()?.split("\\").pop() || "cutscene.mp4";
      const folder = matched?.folderName || targetPath.split("/").slice(-2, -1)[0] || "Root";
      return {
        cutscenePath: targetPath,
        fileName: name,
        folderName: folder,
        locale,
        gender: matched?.roverType === "Girl" ? "Girl" : matched?.roverType === "Boy" ? "Boy" : gender,
        subtitleMode,
        renderResolution,
      };
    });

    addToQueue(newQueueItems);
    setSelectedFiles(new Set());
    useTaskStore.getState().appendLog({
      message: `เพิ่ม ${newQueueItems.length} รายการเข้าสู่คิวเรนเดอร์เรียบร้อยแล้ว`,
      level: "info",
    });
    const queueActionLabel = t("btnAddAllToQueue");
    toast.success(queueActionLabel + " " + newQueueItems.length + " คลิป");
    setActiveWorkspace("queue");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#111113] text-white overflow-hidden select-none font-sans">
      {/* 1. macOS Borderless TitleBar */}
      <TitleBar />

      {/* 2. Main Workspace Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Sidebar with Pro Workspaces Switcher */}
        <Sidebar
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={setActiveWorkspace}
          isGameRunning={isGameRunning}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
          isTerminalOpen={isTerminalOpen}
          onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Dynamic Workspace Container */}
        <main className="flex-1 min-w-0 h-full flex overflow-hidden relative">
          <div className={`flex-1 min-w-0 h-full flex overflow-hidden ${activeWorkspace === "studio" ? "relative" : "hidden"}`}>
            {/* Center Virtualized Cutscene Gallery */}
              <GalleryView
                selectedFile={selectedFile}
                selectedFiles={selectedFiles}
                onSelectVideo={handleSelectVideo}
                onOpenQuickLook={handleOpenQuickLook}
                refreshTrigger={refreshTrigger}
                isInspectorOpen={isInspectorOpen}
                onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
              />

              {/* Right Inspector Panel (w-[320px]) */}
              <Inspector
                selectedFile={selectedFile}
                selectedCount={selectedFiles.size}
                fileName={selectedFileName}
                folderPath={selectedFolderPath}
                meta={selectedMeta}
                thumbnailUrl={selectedMeta?.thumbnail || undefined}
                audioEventCount={audioEventCount}
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
                isLevelSequence={selectedItem?.isLevelSequence}
                hasVideo={selectedItem?.hasVideo}
                isCached={selectedItem?.isCached}
                gender={gender}
                onGenderChange={(val) => {
                  useTaskStore.getState().appendLog({
                    message: `เปลี่ยนการเลือกเพศโรเวอร์เป็น ${val === "Girl" ? "โรเวอร์หญิง" : "โรเวอร์ชาย"}`,
                    level: "info",
                  });
                  updateConfig({ char_selection: val });
                  useCatalogStore.getState().setRoverFilter(val);
                  if (selectedItem?.baseCgName) {
                    const allItems = useCatalogStore.getState().items;
                    const match = allItems.find(
                      (it: ProcessedVideoItem) => it.baseCgName === selectedItem.baseCgName && it.roverType === val
                    );
                    if (match) {
                      handleSelectVideo(match, null, false);
                    }
                  }
                }}
                locale={locale}
                onLocaleChange={(val) => {
                  useTaskStore.getState().appendLog({
                    message: `เปลี่ยนภาษาเสียงเป็น ${val}`,
                    level: "info",
                  });
                  updateConfig({ locale_selection: val });
                }}
                subtitleMode={subtitleMode}
                onSubtitleModeChange={(val) => {
                  useTaskStore.getState().appendLog({
                    message: `เปลี่ยนรูปแบบซับไตเติลเป็น ${val}`,
                    level: "info",
                  });
                  updateConfig({ subtitle_mode: val });
                }}
                renderResolution={renderResolution}
                onResolutionChange={(val) => {
                  useTaskStore.getState().appendLog({
                    message: `เปลี่ยนความละเอียดการเรนเดอร์เป็น ${val}`,
                    level: "info",
                  });
                  updateConfig({ render_resolution: val });
                }}
                onExtractRaw={handleExtractRaw}
                isExtracting={isExtracting}
                onRender={handleRender}
                onCancelRender={handleCancelRender}
                onBatchQueue={handleAddSelectedToQueue}
                onNavigateToSubtitleLab={() => setActiveWorkspace("subtitles")}
                isRendering={isRendering}
                renderedVideoPath={renderedVideoPath}
                onOpenRawVideo={() => {
                  if (selectedItem) {
                    handleOpenQuickLook(selectedItem, selectedMeta);
                  } else if (selectedFile) {
                    ToolsAPI.openMediaExternal(selectedFile).catch(() => {});
                  }
                }}
                onOpenExternal={() => {
                  if (selectedFile) {
                    ToolsAPI.openMediaExternal(selectedFile).catch(() => {});
                  }
                }}
                onOpenClipFolder={() => {
                  if (selectedFile) {
                    ToolsAPI.showInFolder(selectedFile).catch(() => {});
                  } else if (config.export_dir) {
                    ToolsAPI.openFolder(config.export_dir).catch(() => {});
                  }
                }}
                onOpenRenderedVideo={() => {
                  if (renderedVideoPath) {
                    ToolsAPI.openMediaExternal(renderedVideoPath).catch(() => {});
                  }
                }}
                onOpenSourceFolder={() => {
                  const targetDiskPath = selectedItem?.fullPath || selectedFile || "";
                  if (targetDiskPath && (targetDiskPath.includes("/") || targetDiskPath.includes("\\"))) {
                    ToolsAPI.showInFolder(targetDiskPath).catch(() => {});
                  } else {
                    const targetCg = selectedItem?.cgName || selectedItem?.baseCgName;
                    ToolsAPI.openSourceFolder(targetCg).catch(() => {});
                  }
                }}
                onOpenOutputDir={() => {
                  if (renderedVideoPath) {
                    ToolsAPI.showInFolder(renderedVideoPath).catch(() => {});
                  } else {
                    ToolsAPI.openOutputDir().catch(() => {});
                  }
                }}
              />
          </div>

          {activeWorkspace === "subtitles" && <SubtitleLabView />}
          {activeWorkspace === "audio" && <AudioEngineView />}
          {activeWorkspace === "queue" && <BatchQueueView />}
          {activeWorkspace === "setup" && <ToolsSetupView />}
        </main>
      </div>

      {/* 3. Floating Action Bar for Studio Multi-select */}
      {activeWorkspace === "studio" && (
        <FloatingActionBar
          selectedCount={selectedFiles.size}
          onAddAllToQueue={handleAddSelectedToQueue}
          onDeselectAll={() => setSelectedFiles(new Set())}
        />
      )}

      {/* 4. macOS Spacebar Quick Look Modal */}
      <QuickLookModal
        isOpen={Boolean(quickLookVideo)}
        video={quickLookVideo}
        videoPath={quickLookVideo?.fullPath || null}
        fileName={quickLookVideo?.fileName || ""}
        resolution={quickLookMeta?.resolution}
        duration={quickLookMeta?.duration_formatted}
        meta={quickLookMeta}
        partnerRoverItem={partnerRoverItem}
        onSwitchRover={(next) => {
          setQuickLookVideo(next);
        }}
        onClose={() => {
          setQuickLookVideo(null);
          setQuickLookMeta(null);
        }}
      />

      {/* 5. Slide-up Activity Console / Terminal Drawer */}
      <TerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />

      {/* 6. Native Preferences Sheet Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onRefreshLibrary={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* 7. Apple macOS Pure Neutral Extraction Progress Modal */}
      <ExtractionProgressModal />

      {/* 8. Minimal Dark Sonner Toaster */}
      <Toaster
        theme="dark"
        position="bottom-right"
        visibleToasts={2}
        toastOptions={{
          className:
            "bg-[#161619] text-white text-xs shadow-2xl shadow-black/80 rounded-xl p-3 border-none ring-1 ring-white/[0.06] font-sans",
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
