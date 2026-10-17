import React, { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import {
  X,
  Film,
  Layers,
  Volume2,
  FolderOpen,
  Copy,
  Check,
  Info,
  Sparkles,
  ExternalLink,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../context/AppContext";
import { ToolsAPI, RendererAPI } from "../../core/ipc";
import type { ProcessedVideoItem, VideoMetaInfo } from "../../features/catalog/stores/useCatalogStore";

interface QuickLookModalProps {
  isOpen: boolean;
  video: ProcessedVideoItem | null;
  videoPath: string | null;
  fileName: string;
  resolution?: string;
  duration?: string;
  meta?: VideoMetaInfo | null;
  partnerRoverItem?: ProcessedVideoItem | null;
  onSwitchRover?: (item: ProcessedVideoItem) => void;
  onClose: () => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  isOpen,
  video,
  videoPath,
  fileName,
  resolution = "1080p",
  meta,
  partnerRoverItem,
  onSwitchRover,
  onClose,
}) => {
  const { t } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [audioEvents, setAudioEvents] = useState<string[]>([]);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const isLevelSequence = video?.isLevelSequence && !video?.hasVideo;
  const effectiveThumb = meta?.thumbnail;

  useEffect(() => {
    setHasPlaybackError(false);
  }, [videoPath, isOpen]);

  const handleCaptureFrame = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.videoWidth === 0) return;
    setIsCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsCapturing(false);
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          toast.success("คัดลอกภาพเฟรมวิดีโอลงคลิปบอร์ดสำเร็จ");
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${fileName}_frame.png`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("บันทึกภาพเฟรมวิดีโอสำเร็จ");
        }
        setIsCapturing(false);
      }, "image/png");
    } catch {
      setIsCapturing(false);
      toast.error("ไม่สามารถจับภาพเฟรมวิดีโอได้");
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const videoEl = videoRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (videoEl) {
          if (videoEl.paused) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        } else {
          onClose();
        }
        return;
      }
      if (e.key === "j" || e.key === "J") {
        if (videoEl) videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
        return;
      }
      if (e.key === "l" || e.key === "L") {
        if (videoEl) videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
        return;
      }
      if (e.key === "k" || e.key === "K") {
        if (videoEl) {
          if (videoEl.paused) videoEl.play().catch(() => {});
          else videoEl.pause();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        if (videoEl) videoEl.currentTime = Math.max(0, videoEl.currentTime - 1 / 30);
        return;
      }
      if (e.key === "ArrowRight") {
        if (videoEl) videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 1 / 30);
        return;
      }
      if (e.key === "c" || e.key === "C") {
        handleCaptureFrame();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        if (videoEl) videoEl.muted = !videoEl.muted;
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load sound tracks if it's a level sequence or has sound events
  useEffect(() => {
    if (isOpen && video) {
      const searchKey = video.fullPath || video.cgFile || video.fileName;
      RendererAPI.getVideoAudioEvent(searchKey)
        .then(setAudioEvents)
        .catch(() => setAudioEvents([]));
    }
  }, [isOpen, video]);

  if (!isOpen) return null;

  const handleCopyPath = () => {
    const textToCopy = video?.cgFile || video?.fullPath || fileName;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("คัดลอกพาธ Unreal Engine สำเร็จ");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = () => {
    const target = videoPath || video?.fullPath;
    if (target) {
      ToolsAPI.showInFolder(target).catch(() => {});
    }
  };

  const normalizedVideoPath = videoPath ? videoPath.replace(/\\/g, "/") : null;
  const assetUrl = normalizedVideoPath && !isLevelSequence ? convertFileSrc(normalizedVideoPath) : null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md select-none"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 450, damping: 35, mass: 0.8 }}
        className="w-full max-w-4xl bg-[#141416] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/[0.06]"
      >
        {/* Header */}
        <div className="h-10 px-4 bg-[#121214] border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isLevelSequence ? (
              <Layers className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0" />
            ) : (
              <Film className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0" />
            )}
            <span className="text-xs font-medium text-white truncate max-w-md">
              {fileName}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#A3A3A3]">
              {isLevelSequence ? "3D Sequence" : resolution}
            </span>
            {video?.roverType && video.roverType !== "Neutral" && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-[#A1A1AA]">
                {video.roverType === "Girl" ? "โรเวอร์หญิง" : "โรเวอร์ชาย"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {partnerRoverItem && onSwitchRover && (
              <button
                type="button"
                onClick={() => onSwitchRover(partnerRoverItem)}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
                title="สลับเวอร์ชันโรเวอร์"
              >
                <span>{partnerRoverItem.roverType === "Girl" ? "สลับเป็นโรเวอร์หญิง" : "สลับเป็นโรเวอร์ชาย"}</span>
              </button>
            )}
            {videoPath && !isLevelSequence && (
              <button
                type="button"
                onClick={handleCaptureFrame}
                disabled={isCapturing}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
                title="จับภาพเฟรมวิดีโอนี้เพื่อทำภาพปก หรือกดปุ่ม C"
              >
                <Camera className="w-3 h-3" />
                <span>{isCapturing ? "กำลังจับภาพ" : "จับภาพเฟรม"}</span>
              </button>
            )}
            {videoPath && !isLevelSequence && (
              <button
                type="button"
                onClick={() => ToolsAPI.openMediaExternal(videoPath).catch(console.error)}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
                title="เปิดด้วยโปรแกรมเล่นภายนอก"
              >
                <ExternalLink className="w-3 h-3" />
                <span>เปิดภายนอก</span>
              </button>
            )}
            <span className="text-[10px] text-[#737373] hidden sm:inline">
              {t("quickLookHint")}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-md text-[#737373] hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer outline-none"
              title="ปิดหน้าต่าง Spacebar หรือ Esc"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body: Video vs 3D Level Sequence */}
        {isLevelSequence || !assetUrl ? (
          /* 3D LevelSequence Studio Canvas */
          <div className="relative aspect-video w-full bg-[#0A0A0D] flex flex-col items-center justify-center p-8 select-none">
            {effectiveThumb ? (
              <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
                <img
                  src={effectiveThumb}
                  alt={fileName}
                  className="w-full h-full object-cover blur-sm scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0D] via-[#0A0A0D]/70 to-[#0A0A0D]/90" />
              </div>
            ) : null}

            <div className="relative z-10 flex flex-col items-center text-center max-w-lg space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white shadow-xl">
                <Layers className="w-7 h-7 stroke-[1.25] text-neutral-300" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-[#A1A1AA] mb-2">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                  <span>Unreal Engine 4 Real-time Level Sequence</span>
                </div>
                <h3 className="text-base font-medium text-white tracking-tight">{fileName}</h3>
                {video?.cgFile && (
                  <p className="text-[11px] font-mono text-[#71717A] mt-1 break-all select-all">
                    {video.cgFile}
                  </p>
                )}
              </div>

              {/* Informative Note */}
              <div className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                  <Info className="w-3.5 h-3.5 text-[#A1A1AA]" />
                  <span>ข้อมูลคัตซีน 3D Sequence</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  คัตซีนนี้เป็น Level Sequence ที่เอนจินเกมเรนเดอร์กราฟิก 3D แบบเรียลไทม์ภายในเกม ไม่มีไฟล์วิดีโอ MP4 ในแพ็กเกจเกม ระบบรองรับการเล่นและส่งออกแทร็กเสียง Wwise ทั้งหมดที่เชื่อมโยงกับซีเควนซ์นี้
                </p>
              </div>

              {/* Associated Wwise Audio Banks */}
              {audioEvents.length > 0 && (
                <div className="w-full space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                    <span className="flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-[#A1A1AA]" />
                      <span>แทร็กเสียง Wwise ที่สกัดแล้ว</span>
                    </span>
                    <span className="font-mono">{audioEvents.length} แทร็ก</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {audioEvents.map((evt) => (
                      <div
                        key={evt}
                        className="px-2 py-1 rounded bg-white/[0.03] text-[10px] font-mono text-[#A1A1AA] truncate flex items-center justify-between"
                      >
                        <span className="truncate">{evt}</span>
                        <span className="text-[9px] text-[#71717A]">Wwise Bank</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "คัดลอกแล้ว" : "คัดลอกพาธ Unreal"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>เปิดโฟลเดอร์ไฟล์</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Real Video Cutscene Player */
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            {hasPlaybackError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3.5 select-none">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white">
                  <Film className="w-6 h-6 text-neutral-400 stroke-[1.25]" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">ไม่สามารถเปิดเล่นในตัวโปรแกรมได้</h4>
                  <p className="text-[11px] text-[#71717A] mt-1 max-w-sm">
                    ไฟล์วิดีโอนี้อาจใช้การเข้ารหัสที่ต้องการโปรแกรมเล่นสื่อภายนอกในการถอดรหัส
                  </p>
                </div>
                {videoPath && (
                  <button
                    type="button"
                    onClick={() => ToolsAPI.openMediaExternal(videoPath)}
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-2 cursor-pointer outline-none"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดด้วยโปรแกรมเล่นภายนอก</span>
                  </button>
                )}
              </div>
            ) : (
              <video
                ref={videoRef}
                src={assetUrl}
                controls
                autoPlay
                className="w-full h-full object-contain focus:outline-none"
                onError={() => {
                  console.warn("Video failed to play via asset protocol:", assetUrl);
                  setHasPlaybackError(true);
                }}
              />
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
