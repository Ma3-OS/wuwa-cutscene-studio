import { useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { Sidebar, TabId } from "./components/layout/Sidebar";
import { BlobBackground } from "./components/ui/BlobBackground";
import { setupGlobalEventListeners } from "./core/events/listener";

import { GalleryView } from "./views/GalleryView";
import { SubtitleView } from "./views/SubtitleView";
import { AudioView } from "./views/AudioView";
import { SetupView } from "./views/SetupView";
import { LogView } from "./views/LogView";
import { AppProvider, useApp } from "./context/AppContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import "./index.css";

function getFontClass(font: string) {
  switch (font) {
    case "Prompt":
      return "font-prompt";
    case "Inter":
      return "font-inter";
    case "Noto Sans Thai":
      return "font-noto";
    case "Kanit":
    default:
      return "font-kanit";
  }
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("cutscenes");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { config } = useApp();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setupGlobalEventListeners().then((fn) => {
      cleanup = fn;
    });

    // In production release, protect UI against casual inspection
    let cleanupProtection: (() => void) | undefined;
    if (import.meta.env.PROD) {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) ||
          (e.ctrlKey && (e.key === "U" || e.key === "u"))
        ) {
          e.preventDefault();
        }
      };
      window.addEventListener("contextmenu", handleContextMenu);
      window.addEventListener("keydown", handleKeyDown);
      cleanupProtection = () => {
        window.removeEventListener("contextmenu", handleContextMenu);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

    return () => {
      if (cleanup) cleanup();
      if (cleanupProtection) cleanupProtection();
    };
  }, []);

  const fontClass = getFontClass(config.app_font);

  return (
    <div className={`flex h-screen w-screen bg-bg-deep text-fg overflow-hidden relative select-none ${fontClass}`}>
      <div className="flex flex-1 overflow-hidden relative">
        <BlobBackground enabled={config.enable_glow} />
        
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        
        <main className="flex-1 relative z-10 overflow-hidden flex flex-col h-full p-6 pb-4">
          <div className="flex-1 relative overflow-hidden">
            {/* Modular Views preserved in DOM */}
            <div className={activeTab === "cutscenes" ? "block h-full" : "hidden"}>
              <GalleryView />
            </div>
            <div className={activeTab === "subtitles" ? "block h-full" : "hidden"}>
              <SubtitleView />
            </div>
            <div className={activeTab === "audio" ? "block h-full" : "hidden"}>
              <AudioView />
            </div>
            <div className={activeTab === "setup" ? "block h-full" : "hidden"}>
              <SetupView />
            </div>
            <div className={activeTab === "logs" ? "block h-full" : "hidden"}>
              <LogView />
            </div>
          </div>
        </main>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0c0d12',
            color: '#EDEDEF',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '13px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#0c0d12' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#0c0d12' },
          },
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
