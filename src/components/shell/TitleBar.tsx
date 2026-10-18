import React, { useState, useEffect, useCallback } from "react";
import { Minus, Square, Copy, X, Languages } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useExtractionStore } from "../../features/catalog/stores/useExtractionStore";
import { useApp } from "../../context/AppContext";

export function TitleBar() {
  const { t, lang, updateConfig, playSound } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);
  const { isOpen, isRunning, cgName, statusText, percent, open } = useExtractionStore();

  const checkMaximized = useCallback(async () => {
    try {
      const max = await invoke<boolean>("app_is_maximized");
      setIsMaximized(Boolean(max));
    } catch {}
  }, []);

  useEffect(() => {
    checkMaximized();

    try {
      const appWindow = getCurrentWindow();
      const unlisten = appWindow.onResized(() => {
        checkMaximized();
      });

      return () => {
        unlisten.then((f) => f()).catch(() => {});
      };
    } catch {}
  }, [checkMaximized]);

  const handleMinimize = async () => {
    try {
      await invoke("app_minimize");
    } catch (err) {
      console.error("Minimize error:", err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const nextMax = await invoke<boolean>("app_toggle_maximize");
      setIsMaximized(Boolean(nextMax));
    } catch (err) {
      console.error("Toggle maximize error:", err);
    }
  };

  const handleClose = async () => {
    try {
      await invoke("app_close");
    } catch (err) {
      console.error("Close error:", err);
    }
  };

  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.detail === 2) {
      handleToggleMaximize();
    } else if (e.detail === 1) {
      invoke("app_start_dragging").catch(() => {});
    }
  };

  return (
    <header className="h-9 w-full bg-[#151518] border-b border-white/[0.04] flex items-center justify-between px-3 select-none shrink-0 z-50 relative cursor-default">
      {/* Brand Identity */}
      <div
        onMouseDown={handleMouseDownDrag}
        className="flex items-center gap-2 select-none h-full py-1 pr-3 cursor-default"
      >
        <img
          src="/Logo.png"
          alt={t("appTitle")}
          className="w-4.5 h-4.5 rounded-md object-contain"
        />
        <span className="text-xs font-semibold text-white tracking-wide font-sans">
          WuWa Studio
        </span>
      </div>

      {/* Center Flexible Window Drag Area */}
      <div
        onMouseDown={handleMouseDownDrag}
        className="flex-1 h-full select-none cursor-default"
        title={t("titlebarDragHint")}
      />

      {/* Background Task Capsule Pill */}
      {!isOpen && isRunning && (
        <button
          type="button"
          onClick={open}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.10] text-neutral-200 text-[11px] transition-all cursor-pointer pointer-events-auto border-0 select-none mr-3"
          title={t("titlebarProgressOpen")}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="font-medium truncate max-w-[140px] text-white">
            {cgName || t("titlebarProcessing")}
          </span>
          <span className="text-white/60 truncate max-w-[120px]">
            {statusText}
          </span>
          <span className="font-mono text-white/90 font-medium">
            {Math.round(percent)}%
          </span>
        </button>
      )}

      {/* Instant Language Switcher (Non-Drag Zone) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center mr-2 shrink-0 z-50 relative pointer-events-auto cursor-default"
      >
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            playSound("click");
            updateConfig({ app_language: lang === "th" ? "en" : "th" });
          }}
          className="h-6 px-2 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium transition-colors flex items-center gap-1.5 border-0 cursor-pointer"
          title={lang === "th" ? t("titlebarSwitchToEn") : t("titlebarSwitchToTh")}
        >
          <Languages className="w-3 h-3 text-[#71717A]" />
          <span className={lang === "th" ? "text-white font-semibold" : "text-neutral-500"}>TH</span>
          <span className="text-neutral-600">|</span>
          <span className={lang === "en" ? "text-white font-semibold" : "text-neutral-500"}>EN</span>
        </button>
      </div>

      {/* Minimal Window Controls (Non-Drag Zone) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1 shrink-0 z-50 relative pointer-events-auto cursor-default"
      >
        <button
          type="button"
          onClick={handleMinimize}
          title={t("titlebarMinimize")}
          aria-label={t("titlebarMinimize")}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#737373] hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14] transition-all cursor-pointer"
        >
          <Minus className="w-3 h-3 stroke-[1.75]" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMaximized ? t("titlebarRestore") : t("titlebarMaximize")}
          aria-label={isMaximized ? t("titlebarRestore") : t("titlebarMaximize")}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#737373] hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14] transition-all cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-2.5 h-2.5 stroke-[1.75] rotate-90" />
          ) : (
            <Square className="w-2.5 h-2.5 stroke-[1.75]" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title={t("titlebarClose")}
          aria-label={t("titlebarClose")}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#737373] hover:text-white hover:bg-rose-500/80 active:bg-rose-600 transition-all cursor-pointer"
        >
          <X className="w-3 h-3 stroke-[1.75]" />
        </button>
      </div>
    </header>
  );
}

