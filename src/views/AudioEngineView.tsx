import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Play,
  RotateCcw,
  Sliders,
  CheckCheck,
  Disc3,
  Waves,
} from "lucide-react";
import { StudioButton } from "../components/ui/StudioButton";
import { StudioSelect } from "../components/ui/StudioSelect";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";

export const AudioEngineView: React.FC = () => {
  const { config, updateConfig, t, playSound } = useApp();

  const [voiceVol, setVoiceVol] = useState<number>(config.voice_volume ?? 100);
  const [bgmVol, setBgmVol] = useState<number>(config.bgm_volume ?? 100);
  const [bitrate, setBitrate] = useState<string>(config.audio_bitrate || "320k");
  const [normalize, setNormalize] = useState<boolean>(config.normalize_audio ?? true);

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("");

  // Reactive Auto-Save Debounce
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await updateConfig({
          voice_volume: voiceVol,
          bgm_volume: bgmVol,
          audio_bitrate: bitrate,
          normalize_audio: normalize,
        });
        setLastSaved(t("subAutoSavedDone"));
      } catch (e) {
        console.error("Auto-save audio config failed:", e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [voiceVol, bgmVol, bitrate, normalize, updateConfig]);

  // Live audio preview using Web Audio API
  const handlePlayPreview = () => {
    playSound("click");
    if (isPlayingPreview) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      setIsPlayingPreview(true);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime((voiceVol / 100) * 0.4, ctx.currentTime);
      gainNode.connect(ctx.destination);

      // Play warm acoustic chime (C5 - E5 - G5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        osc.connect(gainNode);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + 1.2 + idx * 0.15);
      });

      setTimeout(() => {
        setIsPlayingPreview(false);
        ctx.close().catch(() => {});
      }, 2000);

      toast.success(t("btnPreviewSound"));
    } catch {
      setIsPlayingPreview(false);
    }
  };

  const handleReset = () => {
    playSound("click");
    setVoiceVol(100);
    setBgmVol(100);
    setBitrate("320k");
    setNormalize(true);
    toast.success(t("btnResetDefault"));
  };

  return (
    <div className="flex-1 h-full bg-[#111113] flex flex-col min-w-0 overflow-y-auto select-none p-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-semibold text-white tracking-wide">
                  {t("wsAudio")}
                </h1>
                {lastSaved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-neutral-400 border border-white/[0.04]">
                    <CheckCheck className="w-3 h-3 text-neutral-400" /> {lastSaved}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#737373] mt-0.5">
                {t("audioEngineDesc")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StudioButton variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("btnResetDefault")}</span>
            </StudioButton>
          </div>
        </div>

        {/* 2-Column Audio Mixing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left: Mixing Levels & Normalization */}
          <div className="p-5 rounded-2xl bg-[#141416] space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white pb-1 border-b border-white/[0.04]">
              <Sliders className="w-4 h-4 text-neutral-400" />
              <span>{t("audioLevelMixing")}</span>
            </div>

            {/* Voice Volume */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#A3A3A3]">{t("voiceVolLabel")}</span>
                <span className="text-white font-mono">{voiceVol}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                value={voiceVol}
                onChange={(e) => setVoiceVol(Number(e.target.value))}
                className="w-full accent-white h-1 bg-white/[0.08] rounded-lg cursor-pointer"
              />
            </div>

            {/* BGM Volume */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#A3A3A3]">{t("bgmVolLabel")}</span>
                <span className="text-white font-mono">{bgmVol}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                value={bgmVol}
                onChange={(e) => setBgmVol(Number(e.target.value))}
                className="w-full accent-white h-1 bg-white/[0.08] rounded-lg cursor-pointer"
              />
            </div>

            {/* EBU R128 Normalization */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
              <div>
                <div className="text-xs font-medium text-white">
                  {t("normalizeAudioLabel")}
                </div>
                <div className="text-[10px] text-[#737373] mt-0.5">
                  {t("audioLoudnessNorm")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNormalize(!normalize)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer outline-none ${
                  normalize ? "bg-white" : "bg-white/[0.12]"
                }`}
                title={t("audioLoudnessNormToggle")}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-0.75 ${
                    normalize ? "right-0.75 bg-[#111113]" : "left-0.75 bg-[#737373]"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Right: Master Output Bitrate & Acoustic Test */}
          <div className="p-5 rounded-2xl bg-[#141416] space-y-5">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Disc3 className="w-4 h-4 text-neutral-400" />
                <span>{t("audioExportQuality")}</span>
              </div>

              <StudioButton
                variant="secondary"
                size="sm"
                onClick={handlePlayPreview}
                disabled={isPlayingPreview}
              >
                <Play className={`w-3 h-3 ${isPlayingPreview ? "text-white" : ""}`} />
                <span>{t("btnPreviewSound")}</span>
              </StudioButton>
            </div>

            {/* Bitrate Selector without Parentheses */}
            <StudioSelect
              label={t("bitrateLabel")}
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value)}
              options={[
                { value: "192k", label: t("bitrate192k") },
                { value: "256k", label: t("bitrate256k") },
                { value: "320k", label: t("bitrate320k") },
                { value: "flac", label: t("bitrateFlac") },
              ]}
            />

            {/* Wwise Pipeline Details Note */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Waves className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t("audioWwiseArchTitle")}</span>
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed">
                {t("audioWwiseArchDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
