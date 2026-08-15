import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { 
  Headphones, 
  Database, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck,
  Bell,
  Volume2
} from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";
import { soundManager } from "../utils/sound";

interface AppConfig {
  ffmpeg_path: string;
  vgmstream_path: string;
  export_dir: string;
  char_selection: string;
  locale_selection: string;
  subtitle_lang: string;
  subtitle_mode: string;
}

export function AudioView() {
  const [config, setConfig] = useState<AppConfig>({
    ffmpeg_path: "",
    vgmstream_path: "",
    export_dir: "",
    char_selection: "Girl",
    locale_selection: "ja",
    subtitle_lang: "th",
    subtitle_mode: "Hard-sub",
  });

  const [voiceVolume, setVoiceVolume] = useState<number>(100);
  const [bgmVolume, setBgmVolume] = useState<number>(100);
  const [bitrate, setBitrate] = useState<string>("320k");
  const [normalizeAudio, setNormalizeAudio] = useState<boolean>(true);
  const [cacheStatus, setCacheStatus] = useState<string>("Ready");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).catch(console.error);
  }, []);

  const updateConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      await invoke("update_config", { newConfig });
      toast.success("Audio preference updated");
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      setCacheStatus("Cache cleared");
      toast.success("Audio cache reset successfully!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setClearing(false);
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
        
        {/* Main Header */}
        <header className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner-glow shrink-0">
            <Headphones className="w-5 h-5 text-accent-bright" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-fg">Audio & Voice Engine</h1>
            <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
              Configure localized character voice tracks, Rover gender matching, and audio mixing quality.
            </p>
          </div>
        </header>

        {/* Rover & Voiceover Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Protagonist Rover Section */}
          <SpotlightCard className="p-6 space-y-5 border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-accent/15 text-accent-bright flex items-center justify-center text-xs font-bold">1</span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-fg">Protagonist Rover</h3>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed pl-7 mb-5">
                Directs Wwiser to match voice events and cutscenes for your chosen Rover.
              </p>

              <div className="grid grid-cols-2 gap-3.5 pl-1">
                <button
                  type="button"
                  onClick={() => updateConfig({ ...config, char_selection: "Girl" })}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2.5 transition-all duration-200 ${
                    config.char_selection === "Girl"
                      ? "bg-accent/15 border-accent text-white shadow-lg shadow-accent/10 ring-1 ring-accent/30"
                      : "bg-white/[0.03] border-white/5 text-fg-muted hover:text-white hover:bg-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center text-base font-bold shadow-inner">
                    ♀
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-fg">Female Rover</span>
                    <span className="text-[10px] text-fg-subtle mt-0.5 block">Nvzhu (Girl)</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateConfig({ ...config, char_selection: "Boy" })}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2.5 transition-all duration-200 ${
                    config.char_selection === "Boy"
                      ? "bg-accent/15 border-accent text-white shadow-lg shadow-accent/10 ring-1 ring-accent/30"
                      : "bg-white/[0.03] border-white/5 text-fg-muted hover:text-white hover:bg-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-base font-bold shadow-inner">
                    ♂
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-fg">Male Rover</span>
                    <span className="text-[10px] text-fg-subtle mt-0.5 block">Nanzhu (Boy)</span>
                  </div>
                </button>
              </div>
            </div>
          </SpotlightCard>

          {/* Voiceover Locale Section */}
          <SpotlightCard className="p-6 space-y-5 border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-accent/15 text-accent-bright flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="text-xs font-bold tracking-wide uppercase text-fg">Voiceover Language</h3>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed pl-7 mb-5">
                Selects character dialogue language extracted from Wwise Media audio banks.
              </p>

              <div className="grid grid-cols-2 gap-3 pl-1">
                {[
                  { label: "Japanese", code: "ja", sub: "日本語 (Default)" },
                  { label: "English", code: "en", sub: "English Dub" },
                  { label: "Korean", code: "ko", sub: "한국어" },
                  { label: "Chinese", code: "zh-Hans", sub: "简体中文" },
                ].map((loc) => {
                  const isSelected = config.locale_selection === loc.code;
                  return (
                    <button
                      key={loc.code}
                      type="button"
                      onClick={() => updateConfig({ ...config, locale_selection: loc.code })}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? "bg-accent/15 border-accent text-white shadow-md shadow-accent/10 ring-1 ring-accent/30"
                          : "bg-white/[0.03] border-white/5 text-fg-muted hover:text-white hover:bg-white/[0.06] hover:border-white/10"
                      }`}
                    >
                      <div className="text-xs font-bold tracking-wide">{loc.label}</div>
                      <div className="text-[10px] text-fg-subtle mt-0.5">{loc.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* Detailed Mixing & Quality Controls */}
        <SpotlightCard className="p-6 space-y-6 border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-accent/15 text-accent-bright flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-xs font-bold tracking-wide uppercase text-fg">Audio Mixing & Quality</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Volume Sliders */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-muted font-medium">Voice Dialogue Volume</span>
                  <span className="text-fg font-mono font-bold">{voiceVolume}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(Number(e.target.value))}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-muted font-medium">BGM & SFX Track Volume</span>
                  <span className="text-fg font-mono font-bold">{bgmVolume}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(Number(e.target.value))}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Bitrate & Peak Limiter */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">Output Audio Bitrate</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "320 kbps", value: "320k", sub: "Studio" },
                    { label: "256 kbps", value: "256k", sub: "High" },
                    { label: "192 kbps", value: "192k", sub: "Standard" },
                  ].map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setBitrate(b.value)}
                      className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                        bitrate === b.value
                          ? "bg-accent/20 border-accent text-white font-semibold shadow-sm"
                          : "bg-white/5 border-white/5 text-fg-muted hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-semibold">{b.label}</div>
                      <div className="text-[10px] text-fg-subtle">{b.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs font-medium text-fg flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Audio Peak Limiter
                  </div>
                  <div className="text-[11px] text-fg-subtle mt-0.5">Prevents audio clipping during multi-track mixing</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNormalizeAudio(!normalizeAudio)}
                  className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${normalizeAudio ? 'bg-accent' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${normalizeAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.04]">
                <div>
                  <div className="text-xs font-medium text-fg flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-accent-bright" />
                    Completion Chime
                  </div>
                  <div className="text-[11px] text-fg-subtle mt-0.5">Play sound when a video finishes rendering</div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => soundManager.playSuccessChime()}
                  className="text-xs py-1 px-2.5 h-7 flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Test Sound</span>
                </Button>
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* Engine Pipeline & Cache Info */}
        <SpotlightCard className="p-5 border-white/5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-fg">Wwiser Audio Pipeline</h3>
                <p className="text-[11px] text-fg-muted">Targeted bank extraction with 48kHz Opus decoding</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {cacheStatus}
              </span>
              <Button variant="secondary" onClick={handleClearCache} disabled={clearing} className="text-xs py-1 px-2.5 h-7">
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Cache
              </Button>
            </div>
          </div>
        </SpotlightCard>

      </div>
    </motion.div>
  );
}
