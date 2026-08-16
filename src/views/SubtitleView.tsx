import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { 
  Type, 
  Sliders, 
  Eye, 
  RotateCcw, 
  Check, 
  Maximize2, 
  Minimize2,
  Sparkles,
  Tv,
  Monitor,
  Grid,
  SlidersHorizontal,
  ZoomIn,
  CheckCheck
} from "lucide-react";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Button } from "../components/ui/Button";
import { useApp } from "../context/AppContext";

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
  sub_font: string;
  sub_size: number;
  sub_outline: number;
  sub_shadow: number;
  sub_color: string;
  sub_margin_v: number;
}

const FONT_PRESETS = [
  { label: "Kanit Medium (Game Thai Standard)", value: "Kanit Medium" },
  { label: "Segoe UI (Clean Windows/English)", value: "Segoe UI" },
  { label: "Noto Sans Thai (Google)", value: "Noto Sans Thai" },
  { label: "Prompt (Modern Geometric)", value: "Prompt" },
  { label: "Tahoma (Classic Game)", value: "Tahoma" },
  { label: "Arial (Universal)", value: "Arial" },
];

const COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Amber", value: "#FFFBEB" },
  { label: "Gold", value: "#FEF08A" },
  { label: "Cyan", value: "#E0F2FE" },
  { label: "Neon", value: "#CCFBF1" },
];

const BG_THEMES = [
  { id: "black", label: "Pure Black", class: "bg-[#050505]" },
  { id: "purple", label: "Space Purple", class: "bg-gradient-to-br from-purple-950 via-[#181126] to-[#0d0a14]" },
  { id: "white", label: "Daylight", class: "bg-slate-100 text-black" },
  { id: "crimson", label: "Crimson", class: "bg-gradient-to-br from-red-950 via-[#1c0a0a] to-[#0a0505]" },
  { id: "forest", label: "Deep Forest", class: "bg-gradient-to-br from-emerald-950 via-[#06241a] to-[#040f0b]" },
  { id: "night", label: "Midnight", class: "bg-gradient-to-br from-slate-900 via-blue-950 to-[#050b14]" },
];

export function SubtitleView() {
  const { t, playSound } = useApp();
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
    sub_font: "Kanit Medium",
    sub_size: 42,
    sub_outline: 2.2,
    sub_shadow: 1.5,
    sub_color: "#FFFFFF",
    sub_margin_v: 50,
  });

  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [enableRuby, setEnableRuby] = useState(false);
  const [rubyText, setRubyText] = useState("ฉันกับ Exostrider");
  const [baseText, setBaseText] = useState("ประกายแสงแห่งจุดกำเนิด พวกเราจะค้ำจุนไว้เอง");
  const [bgTheme, setBgTheme] = useState(BG_THEMES[0]);
  const [previewZoomMode, setPreviewZoomMode] = useState<"fit" | "actual">("fit");
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [showFullscreenHUD, setShowFullscreenHUD] = useState(true);
  const [showScreenGuides, setShowScreenGuides] = useState(true);
  const [previewAspect, setPreviewAspect] = useState<"16/9" | "21/9">("16/9");
  const [fontWeight, setFontWeight] = useState("500");

  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const fullscreenCanvasRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const [previewHeight, setPreviewHeight] = useState(280);
  const [fullscreenHeight, setFullscreenHeight] = useState(window.innerHeight || 1080);

  // Measure rendered frame height for exact proportional scale
  useEffect(() => {
    const updateHeights = () => {
      if (previewCanvasRef.current) {
        const h = previewCanvasRef.current.clientHeight;
        if (h > 0) setPreviewHeight(h);
      }
      if (fullscreenCanvasRef.current) {
        const fh = fullscreenCanvasRef.current.clientHeight;
        if (fh > 0) setFullscreenHeight(fh);
      } else {
        setFullscreenHeight(window.innerHeight || 1080);
      }
    };

    updateHeights();
    const observer = new ResizeObserver(updateHeights);
    if (previewCanvasRef.current) observer.observe(previewCanvasRef.current);
    if (fullscreenCanvasRef.current) observer.observe(fullscreenCanvasRef.current);

    window.addEventListener("resize", updateHeights);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeights);
    };
  }, [isFullscreenPreview, previewAspect, previewZoomMode]);

  const loadConfigFromDisk = () => {
    invoke<AppConfig>("get_config")
      .then((cfg) => {
        setConfig({
          ...cfg,
          output_dir: cfg.output_dir || "",
          render_resolution: cfg.render_resolution || "original",
          sub_font: cfg.sub_font || "Kanit Medium",
          sub_size: cfg.sub_size || 42,
          sub_outline: cfg.sub_outline ?? 2.2,
          sub_shadow: cfg.sub_shadow ?? 1.5,
          sub_color: cfg.sub_color || "#FFFFFF",
          sub_margin_v: cfg.sub_margin_v || 50,
        });
        setLastSavedTime(new Date().toLocaleTimeString());
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadConfigFromDisk();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreenPreview(false);
        getCurrentWindow().setFullscreen(false).catch(console.error);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const updateConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      await invoke("update_config", { newConfig });
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTrueFullscreen = async () => {
    try {
      const next = !isFullscreenPreview;
      setIsFullscreenPreview(next);
      const win = getCurrentWindow();
      await win.setFullscreen(next);
      if (next && fullscreenContainerRef.current) {
        fullscreenContainerRef.current.requestFullscreen().catch(console.warn);
      } else if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(console.warn);
      }
    } catch (e) {
      console.warn("Fullscreen toggle:", e);
      setIsFullscreenPreview(!isFullscreenPreview);
    }
  };

  const handleResetDefaults = () => {
    playSound("click");
    setConfig({
      ...config,
      sub_font: "Kanit Medium",
      sub_size: 42,
      sub_outline: 2.2,
      sub_shadow: 1.5,
      sub_color: "#FFFFFF",
      sub_margin_v: 50,
    });
    setFontWeight("500");
    setEnableRuby(false);
    setBaseText("ประกายแสงแห่งจุดกำเนิด พวกเราจะค้ำจุนไว้เอง");
    toast.success("Reset to game default styling");
  };

  const applyPreset = (preset: "exact_game" | "thai_game" | "fansub" | "minimal" | "bold") => {
    playSound("click");
    let updated = { ...config };
    if (preset === "exact_game") {
      updated = { ...updated, sub_font: "Kanit Medium", sub_size: 42, sub_outline: 2.2, sub_shadow: 1.5, sub_color: "#FFFFFF", sub_margin_v: 50 };
      setFontWeight("500");
      setEnableRuby(false);
      setBaseText("ประกายแสงแห่งจุดกำเนิด พวกเราจะค้ำจุนไว้เอง");
    } else if (preset === "thai_game") {
      updated = { ...updated, sub_font: "Kanit Medium", sub_size: 44, sub_outline: 2.4, sub_shadow: 1.6, sub_color: "#FFFFFF", sub_margin_v: 52 };
      setFontWeight("500");
      setEnableRuby(true);
      setRubyText("ฉันกับ Exostrider");
      setBaseText("ประกายแสงแห่งจุดกำเนิด พวกเราจะค้ำจุนไว้เอง");
    } else if (preset === "fansub") {
      updated = { ...updated, sub_font: "Tahoma", sub_size: 42, sub_outline: 3.2, sub_shadow: 2.2, sub_color: "#FEF08A", sub_margin_v: 54 };
      setFontWeight("700");
    } else if (preset === "minimal") {
      updated = { ...updated, sub_font: "Segoe UI", sub_size: 34, sub_outline: 1.2, sub_shadow: 0.8, sub_color: "#FFFFFF", sub_margin_v: 46 };
      setFontWeight("400");
    } else if (preset === "bold") {
      updated = { ...updated, sub_font: "Prompt", sub_size: 48, sub_outline: 4.0, sub_shadow: 2.8, sub_color: "#FFFFFF", sub_margin_v: 56 };
      setFontWeight("800");
    }
    updateConfig(updated);
    toast.success(`Applied ${preset.toUpperCase().replace('_', ' ')} preset`);
  };

  const handleSave = async () => {
    playSound("click");
    setSaving(true);
    try {
      await invoke("update_config", { newConfig: config });
      setLastSavedTime(new Date().toLocaleTimeString());
      toast.success("Subtitle settings saved & synced!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const previewScale = previewZoomMode === "actual" ? 1.0 : Math.max(0.1, previewHeight / 1080);
  const fullscreenScale = Math.max(0.1, fullscreenHeight / 1080);

  const getSubtitleCSS = (scale: number) => {
    const fontSize = config.sub_size * scale;
    const strokePx = config.sub_outline * scale;
    const shadowPx = config.sub_shadow * scale;

    return {
      fontFamily: config.sub_font,
      fontSize: `${fontSize}px`,
      fontWeight,
      color: config.sub_color,
      WebkitTextStroke: strokePx > 0 ? `${strokePx}px #000000` : "0px transparent",
      paintOrder: "stroke fill",
      textShadow: shadowPx > 0 
        ? `${shadowPx}px ${shadowPx}px 0px rgba(0,0,0,0.9)` 
        : "none",
      letterSpacing: "0.015em",
      whiteSpace: "nowrap" as const,
      lineHeight: "1.25",
    };
  };

  const getRubyCSS = (scale: number) => {
    const rubySize = Math.max(10, config.sub_size * 0.65 * scale);
    const strokePx = config.sub_outline * 0.8 * scale;
    const shadowPx = config.sub_shadow * 0.8 * scale;

    return {
      fontFamily: config.sub_font,
      fontSize: `${rubySize}px`,
      fontWeight: "500",
      color: config.sub_color,
      WebkitTextStroke: strokePx > 0 ? `${strokePx}px #000000` : "0px transparent",
      paintOrder: "stroke fill",
      textShadow: shadowPx > 0 
        ? `${shadowPx}px ${shadowPx}px 0px rgba(0,0,0,0.9)` 
        : "none",
      marginBottom: `${2 * scale}px`,
      opacity: 0.95,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap" as const,
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-6xl w-full mx-auto space-y-7 pb-16">
        
        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner-glow shrink-0">
              <Type className="w-5 h-5 text-accent-bright" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-fg">{t("subStudioTitle")}</h1>
                {lastSavedTime && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCheck className="w-3 h-3" /> Synced {lastSavedTime}
                  </span>
                )}
              </div>
              <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                {t("subStudioDesc")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleResetDefaults} className="text-xs px-3 py-1.5 h-8">
              <RotateCcw className="w-3 h-3 mr-1.5" />
              {t("btnResetDefault")}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="text-xs px-3.5 py-1.5 h-8">
              <Check className="w-3 h-3 mr-1.5" />
              {t("btnSaveSubtitleStyle")}
            </Button>
          </div>
        </header>

        {/* Quick Style Presets Bar with Mouse Wheel Horizontal Scrolling */}
        <div className="space-y-1.5">
          <div 
            onWheel={(e) => {
              if (e.currentTarget) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar cursor-grab active:cursor-grabbing select-none"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mr-1 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> {t("presetStyles")}:
            </span>
            {[
              { id: "exact_game", label: t("presetExactGame") },
              { id: "thai_game", label: t("presetThaiGame") },
              { id: "fansub", label: t("presetAnimeFansub") },
              { id: "minimal", label: t("presetCleanMinimal") },
              { id: "bold", label: t("presetBoldImpact") },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-fg-muted hover:text-white hover:bg-white/[0.08] transition-all whitespace-nowrap shrink-0"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Visual Preview Card */}
        <SpotlightCard className="p-6 border-white/5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-fg">
                {t("livePreviewTitle")} ({previewZoomMode === "actual" ? t("previewActual") : t("previewFitFrame")})
              </h3>
            </div>

            {/* Controls: Zoom Mode + Screen Guides + Background Theme + Aspect Ratio + Fullscreen */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1:1 Actual Size Zoom Toggle */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewZoomMode("fit")}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs font-semibold ${
                    previewZoomMode === "fit" ? "bg-accent text-white" : "text-fg-muted hover:text-white"
                  }`}
                  title="Fit whole frame to preview box"
                >
                  {t("previewFitFrame")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoomMode("actual")}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold ${
                    previewZoomMode === "actual" ? "bg-accent text-white" : "text-fg-muted hover:text-white"
                  }`}
                  title="100% 1:1 Pixel-Perfect Native 1080p Size (No Shrinking)"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>{t("previewActual")}</span>
                </button>
              </div>

              {/* Screen Guides Toggle */}
              <button
                type="button"
                onClick={() => setShowScreenGuides(!showScreenGuides)}
                className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 border transition-all ${
                  showScreenGuides 
                    ? "bg-accent/20 border-accent text-accent-bright font-semibold" 
                    : "bg-white/5 border-white/5 text-fg-muted hover:text-white"
                }`}
                title="Toggle Safe Area Guides"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{t("previewGuides")}</span>
              </button>

              {/* Aspect Ratio Toggle (16:9 vs 21:9) */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewAspect("16/9")}
                  className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold ${
                    previewAspect === "16/9" ? "bg-accent text-white" : "text-fg-muted hover:text-white"
                  }`}
                  title="Standard 1920x1080 (16:9 FHD)"
                >
                  <Tv className="w-3 h-3" />
                  <span>16:9</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAspect("21/9")}
                  className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold ${
                    previewAspect === "21/9" ? "bg-accent text-white" : "text-fg-muted hover:text-white"
                  }`}
                  title="Ultrawide 2560x1080 (21:9)"
                >
                  <Monitor className="w-3 h-3" />
                  <span>21:9</span>
                </button>
              </div>

              {/* Background Theme Switcher */}
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/5">
                {BG_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setBgTheme(theme)}
                    title={theme.label}
                    className={`w-5 h-5 rounded-lg transition-all border ${
                      bgTheme.id === theme.id ? 'ring-2 ring-accent border-white scale-110' : 'border-white/20 opacity-70 hover:opacity-100'
                    } ${theme.id === 'white' ? 'bg-slate-100' : theme.id === 'purple' ? 'bg-purple-900' : theme.id === 'black' ? 'bg-black' : theme.id === 'crimson' ? 'bg-red-900' : theme.id === 'forest' ? 'bg-emerald-900' : 'bg-blue-900'}`}
                  />
                ))}
              </div>

              {/* Fullscreen Button */}
              <Button
                variant="secondary"
                onClick={toggleTrueFullscreen}
                className="px-2.5 py-1 text-xs h-7 flex items-center gap-1"
                title="Enter Real OS Fullscreen Preview"
              >
                <Maximize2 className="w-3 h-3" />
                <span>{t("btnFullscreen")}</span>
              </Button>
            </div>
          </div>

          {/* Cinematic Canvas Frame */}
          <div className="w-full flex justify-center bg-black/40 rounded-2xl p-2 border border-white/5">
            <div 
              ref={previewCanvasRef}
              className={`relative w-full rounded-xl overflow-hidden border border-white/10 flex flex-col justify-end shadow-2xl transition-all duration-300 ${bgTheme.class} ${
                previewZoomMode === "actual"
                  ? "h-48"
                  : previewAspect === "21/9" ? "aspect-[21/9] max-h-72" : "aspect-[16/9] max-h-80"
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-black/40 pointer-events-none" />
              
              {/* Screen Boundary & Safe Area Overlay */}
              {showScreenGuides && previewZoomMode === "fit" && (
                <div className="absolute inset-0 pointer-events-none z-0">
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

                  <div className="absolute inset-[5%] border border-dashed border-cyan-400/25 rounded flex flex-col justify-between p-1">
                    <span className="text-[9px] font-mono text-cyan-400/40 uppercase tracking-widest">90% Title Safe</span>
                    <span className="text-[9px] font-mono text-cyan-400/40 uppercase tracking-widest text-right">Lower Third</span>
                  </div>

                  <div className="absolute inset-[2.5%] border border-dotted border-accent/30 rounded pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-cyan-400/15" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-cyan-400/15" />
                </div>
              )}

              {/* Status Header Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest opacity-75 z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="bg-black/50 px-2 py-0.5 rounded border border-white/10">
                  {previewAspect === "21/9" ? "2560 × 1080 (21:9)" : "1920 × 1080 (16:9)"} • {previewZoomMode === "actual" ? "1:1 Native 100% Zoom" : `Scale ${(previewScale * 100).toFixed(0)}%`}
                </span>
              </div>

              {/* Subtitle Render Text */}
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pointer-events-none select-none z-10 transition-all duration-75 px-4"
                style={{
                  paddingBottom: `${config.sub_margin_v * previewScale}px`,
                }}
              >
                {/* Ruby / Annotation upper text */}
                {enableRuby && rubyText && (
                  <div style={getRubyCSS(previewScale)}>
                    {rubyText}
                  </div>
                )}

                {/* Base dialogue text */}
                <div style={getSubtitleCSS(previewScale)}>
                  {baseText}
                </div>
              </div>
            </div>
          </div>

          {/* Editable Preview Inputs */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{t("previewCustomization")}</span>
              <button
                type="button"
                onClick={() => setEnableRuby(!enableRuby)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  enableRuby ? "bg-accent/20 border-accent text-accent-bright" : "bg-white/5 border-white/10 text-fg-muted"
                }`}
              >
                {enableRuby ? t("rubyActive") : t("rubyEnable")}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {enableRuby && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-fg-subtle">{t("rubyTopLabel")}</label>
                  <input
                    type="text"
                    value={rubyText}
                    onChange={(e) => setRubyText(e.target.value)}
                    placeholder="Top ruby annotation..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-accent/50"
                  />
                </div>
              )}
              <div className={`space-y-1.5 ${!enableRuby ? "md:col-span-2" : ""}`}>
                <label className="text-[10px] uppercase font-semibold text-fg-subtle">{t("dialogueMainLabel")}</label>
                <input
                  type="text"
                  value={baseText}
                  onChange={(e) => setBaseText(e.target.value)}
                  placeholder="Dialogue sentence..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-accent/50 font-medium"
                />
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* Detailed Controls Grid with Balanced Vertical & Horizontal Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* General & Resolution & Font Family */}
          <SpotlightCard className="p-6 space-y-5 border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg flex items-center gap-2">
              <Type className="w-4 h-4 text-accent" />
              {t("resAndFontTitle")}
            </h3>

            <div className="space-y-4">
              {/* Output Resolution Selector without stretching */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">{t("renderResLabel")}</label>
                <select
                  value={config.render_resolution}
                  onChange={(e) => updateConfig({ ...config, render_resolution: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-fg outline-none focus:border-accent/50 appearance-none"
                >
                  <option value="original" className="bg-bg-deep text-fg">Original Native (Source Resolution)</option>
                  <option value="1920x1080" className="bg-bg-deep text-fg">1920x1080 (Full HD 16:9)</option>
                  <option value="2560x1080" className="bg-bg-deep text-fg">2560x1080 (Ultrawide 21:9)</option>
                  <option value="3840x2160" className="bg-bg-deep text-fg">3840x2160 (4K UHD)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">{t("subLangLabel")}</label>
                <select
                  value={config.subtitle_lang}
                  onChange={(e) => updateConfig({ ...config, subtitle_lang: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-fg outline-none focus:border-accent/50 appearance-none"
                >
                  <option value="th" className="bg-bg-deep text-fg">{t("langTh")}</option>
                  <option value="en" className="bg-bg-deep text-fg">{t("langEn")}</option>
                  <option value="ja" className="bg-bg-deep text-fg">{t("langJa")}</option>
                  <option value="ko" className="bg-bg-deep text-fg">{t("langKo")}</option>
                  <option value="zh" className="bg-bg-deep text-fg">{t("langZh")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">{t("subtitleModeTitle")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Hard-sub", "Soft-sub", "None"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateConfig({ ...config, subtitle_mode: mode })}
                      className={`py-1.5 text-xs rounded-xl font-semibold border transition-all ${
                        config.subtitle_mode === mode
                          ? "bg-accent/20 border-accent/60 text-white shadow-sm"
                          : "bg-white/5 border-white/5 text-fg-muted hover:text-fg hover:bg-white/[0.08]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">{t("fontFamilyLabel")}</label>
                <select
                  value={config.sub_font}
                  onChange={(e) => updateConfig({ ...config, sub_font: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-fg outline-none focus:border-accent/50 appearance-none"
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.value} value={f.value} className="bg-bg-deep text-fg">
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-muted block">{t("textColorLabel")}</label>
                <div className="flex items-center gap-1.5">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => updateConfig({ ...config, sub_color: col.value })}
                      className={`flex-1 py-1.5 px-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                        config.sub_color === col.value
                          ? "border-accent bg-accent/15 text-white shadow-sm"
                          : "border-white/10 bg-white/5 text-fg-muted hover:text-white"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: col.value }} />
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Stroke, Shadows & Margin Controls with Clean Inputs */}
          <SpotlightCard className="p-6 space-y-5 border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              {t("strokeAndShadowTitle")}
            </h3>

            <div className="space-y-4">
              {/* Font Size with Number Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fg-muted font-medium">{t("fontSizeLabel")} (px @ 1080p)</span>
                  <input
                    type="number"
                    min="16"
                    max="72"
                    step="0.5"
                    value={config.sub_size}
                    onChange={(e) => updateConfig({ ...config, sub_size: Number(e.target.value) })}
                    className="w-16 bg-white/10 border border-white/15 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-fg focus:outline-none focus:border-accent"
                  />
                </div>
                <input
                  type="range"
                  min="16"
                  max="72"
                  step="0.5"
                  value={config.sub_size}
                  onChange={(e) => updateConfig({ ...config, sub_size: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Outline Stroke with Number Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fg-muted font-medium">{t("outlineWidthLabel")} (px)</span>
                  <input
                    type="number"
                    min="0"
                    max="6.0"
                    step="0.05"
                    value={config.sub_outline}
                    onChange={(e) => updateConfig({ ...config, sub_outline: Number(e.target.value) })}
                    className="w-16 bg-white/10 border border-white/15 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-fg focus:outline-none focus:border-accent"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="6.0"
                  step="0.05"
                  value={config.sub_outline}
                  onChange={(e) => updateConfig({ ...config, sub_outline: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Shadow Depth with Number Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fg-muted font-medium">{t("shadowDepthLabel")} (px)</span>
                  <input
                    type="number"
                    min="0"
                    max="6.0"
                    step="0.05"
                    value={config.sub_shadow}
                    onChange={(e) => updateConfig({ ...config, sub_shadow: Number(e.target.value) })}
                    className="w-16 bg-white/10 border border-white/15 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-fg focus:outline-none focus:border-accent"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="6.0"
                  step="0.05"
                  value={config.sub_shadow}
                  onChange={(e) => updateConfig({ ...config, sub_shadow: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Vertical Margin with Number Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fg-muted font-medium">{t("verticalMarginLabel")} (px @ 1080p)</span>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    step="1"
                    value={config.sub_margin_v}
                    onChange={(e) => updateConfig({ ...config, sub_margin_v: Number(e.target.value) })}
                    className="w-16 bg-white/10 border border-white/15 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-fg focus:outline-none focus:border-accent"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="1"
                  value={config.sub_margin_v}
                  onChange={(e) => updateConfig({ ...config, sub_margin_v: Number(e.target.value) })}
                  className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </SpotlightCard>
        </div>

      </div>

      {/* True OS Fullscreen Immersive Preview with In-Place Settings HUD */}
      {isFullscreenPreview && createPortal(
        <div
          ref={fullscreenContainerRef}
          className="fixed inset-0 w-screen h-screen z-[999999] bg-black flex items-center justify-center select-none overflow-hidden"
        >
          {/* Fullscreen Video Canvas: Fills 100% of the display without artificial letterboxing */}
          <div
            ref={fullscreenCanvasRef}
            className={`absolute inset-0 w-full h-full flex flex-col justify-end select-none transition-all duration-300 ${bgTheme.class}`}
          >
            {/* Screen Boundary & Safe Area Overlay in Fullscreen */}
            {showScreenGuides && (
              <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60" />

                <div className="absolute inset-[5%] border border-dashed border-cyan-400/30 rounded flex flex-col justify-between p-3">
                  <span className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest">90% Title Safe Area</span>
                  <span className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest text-right">Lower Third Horizon</span>
                </div>

                <div className="absolute inset-[2.5%] border border-dotted border-purple-400/25 rounded pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-cyan-400/20" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-cyan-400/20" />
              </div>
            )}

            {/* Subtitle Render Text in Fullscreen */}
            <div
              className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pointer-events-none select-none z-10 transition-all duration-75 px-6"
              style={{
                paddingBottom: `${config.sub_margin_v * fullscreenScale}px`,
              }}
            >
              {enableRuby && rubyText && (
                <div style={getRubyCSS(fullscreenScale)}>
                  {rubyText}
                </div>
              )}

              <div style={getSubtitleCSS(fullscreenScale)}>
                {baseText}
              </div>
            </div>
          </div>

          {/* Top Fullscreen Controls Bar */}
          <div className="absolute top-4 left-6 right-6 z-30 flex items-center justify-between text-white/90 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono tracking-widest uppercase bg-black/70 px-3 py-1 rounded-xl border border-white/10 backdrop-blur-md">
                Cinema View • {window.innerWidth} × {window.innerHeight} Fullscreen
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Screen Guides Toggle in Fullscreen */}
              <button
                type="button"
                onClick={() => setShowScreenGuides(!showScreenGuides)}
                className={`px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 backdrop-blur-md border transition-all ${
                  showScreenGuides ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-medium" : "bg-black/60 border-white/10 text-white/70 hover:text-white"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Guides</span>
              </button>

              {/* Theme Switcher */}
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-0.5 rounded-xl border border-white/10">
                {BG_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setBgTheme(theme)}
                    title={theme.label}
                    className={`w-5 h-5 rounded-lg transition-all border ${
                      bgTheme.id === theme.id ? 'ring-2 ring-accent border-white scale-110' : 'border-white/20 opacity-60 hover:opacity-100'
                    } ${theme.id === 'white' ? 'bg-slate-100' : theme.id === 'purple' ? 'bg-purple-900' : theme.id === 'black' ? 'bg-black' : theme.id === 'crimson' ? 'bg-red-900' : theme.id === 'forest' ? 'bg-emerald-900' : 'bg-blue-900'}`}
                  />
                ))}
              </div>

              {/* Toggle Quick Settings HUD Button */}
              <button
                type="button"
                onClick={() => setShowFullscreenHUD(!showFullscreenHUD)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border transition-all ${
                  showFullscreenHUD ? "bg-accent text-white border-accent" : "bg-black/60 text-white/80 border-white/10 hover:text-white"
                }`}
                title="Toggle In-Place Settings Menu"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Settings HUD</span>
              </button>

              {/* Exit Fullscreen Button */}
              <button
                type="button"
                onClick={toggleTrueFullscreen}
                className="w-7 h-7 rounded-xl bg-black/60 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition-colors backdrop-blur-md"
                title="Exit Fullscreen (ESC)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Floating In-Place Settings HUD Drawer */}
          <AnimatePresence>
            {showFullscreenHUD && (
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-6 top-16 w-80 max-h-[82vh] overflow-y-auto custom-scrollbar bg-black/85 backdrop-blur-2xl p-5 rounded-3xl border border-white/15 shadow-2xl z-40 space-y-4 select-none"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <Sliders className="w-4 h-4 text-accent-bright" />
                    Live Typography HUD
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFullscreenHUD(false)}
                    className="text-white/40 hover:text-white text-xs p-1"
                  >
                    Hide
                  </button>
                </div>

                {/* Preset Pills */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-fg-subtle">Presets</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "exact_game", label: "🎮 In-Game" },
                      { id: "thai_game", label: "🇹🇭 Thai Sub" },
                      { id: "fansub", label: "🟡 Fansub" },
                      { id: "minimal", label: "⚪ Minimal" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id as any)}
                        className="px-2 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-white/15 text-white/80 border border-white/5 font-semibold"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white">
                    <span>Font Size</span>
                    <span className="font-mono font-bold text-accent-bright">{config.sub_size} px</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="72"
                    step="0.5"
                    value={config.sub_size}
                    onChange={(e) => updateConfig({ ...config, sub_size: Number(e.target.value) })}
                    className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Outline Thickness */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white">
                    <span>Outline Stroke</span>
                    <span className="font-mono font-bold text-accent-bright">{config.sub_outline.toFixed(2)} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6.0"
                    step="0.05"
                    value={config.sub_outline}
                    onChange={(e) => updateConfig({ ...config, sub_outline: Number(e.target.value) })}
                    className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Shadow Depth */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white">
                    <span>Drop Shadow</span>
                    <span className="font-mono font-bold text-accent-bright">{config.sub_shadow.toFixed(2)} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6.0"
                    step="0.05"
                    value={config.sub_shadow}
                    onChange={(e) => updateConfig({ ...config, sub_shadow: Number(e.target.value) })}
                    className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Bottom Margin Offset */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white">
                    <span>Margin Offset</span>
                    <span className="font-mono font-bold text-accent-bright">{config.sub_margin_v} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="1"
                    value={config.sub_margin_v}
                    onChange={(e) => updateConfig({ ...config, sub_margin_v: Number(e.target.value) })}
                    className="w-full accent-accent h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Font Family Dropdown */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] uppercase font-semibold text-fg-subtle">Font Family</label>
                  <select
                    value={config.sub_font}
                    onChange={(e) => updateConfig({ ...config, sub_font: e.target.value })}
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    {FONT_PRESETS.map((f) => (
                      <option key={f.value} value={f.value} className="bg-bg-deep text-white">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color Chips */}
                <div className="flex gap-1.5 pt-1">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => updateConfig({ ...config, sub_color: col.value })}
                      className={`flex-1 h-5 rounded-lg border transition-all ${
                        config.sub_color === col.value ? "ring-2 ring-accent border-white scale-105" : "border-white/20 opacity-70"
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.label}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Footer hint */}
          <div className="absolute bottom-2 inset-x-0 text-center text-[11px] text-white/40 font-mono z-30 pointer-events-none">
            Press Escape to exit Fullscreen • Click "Settings HUD" to toggle live settings menu
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
