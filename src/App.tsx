import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { Sidebar, TabId } from "./components/layout/Sidebar";
import { BlobBackground } from "./components/ui/BlobBackground";

import { GalleryView } from "./views/GalleryView";
import { SubtitleView } from "./views/SubtitleView";
import { AudioView } from "./views/AudioView";
import { SetupView } from "./views/SetupView";
import { LogView } from "./views/LogView";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("cutscenes");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const appWindow = getCurrentWindow();

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    appWindow.minimize().catch(console.error);
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appWindow.toggleMaximize();
    } catch {
      try {
        const isMax = await appWindow.isMaximized();
        if (isMax) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
      } catch (err) {
        console.error("Window maximize error:", err);
      }
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    appWindow.close().catch(console.error);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-deep text-fg overflow-hidden relative">
      {/* Custom Titlebar */}
      <header className="h-9 shrink-0 flex items-center justify-between px-3 z-50 bg-[#0c0d12]/95 border-b border-white/[0.04] select-none">
        {/* Draggable Title Area (Double click to toggle maximize) */}
        <div 
          data-tauri-drag-region 
          onPointerDown={() => appWindow.startDragging()}
          onDoubleClick={handleMaximize}
          className="flex-1 h-full flex items-center text-[11px] font-medium text-fg-muted pl-2 cursor-move"
        >
          <span className="font-semibold text-fg tracking-wide mr-2">WuWa Cutscene Studio</span>
          <span className="text-[10px] text-fg-subtle font-mono opacity-60">Pro Edition v1.0.0</span>
        </div>

        {/* Window Controls (No Drag Region) */}
        <div className="flex items-center gap-1 z-10">
          <button 
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleMinimize} 
            className="w-7 h-6 flex items-center justify-center hover:bg-white/10 rounded text-fg-subtle hover:text-fg transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          <button 
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleMaximize} 
            className="w-7 h-6 flex items-center justify-center hover:bg-white/10 rounded text-fg-subtle hover:text-fg transition-colors"
            title="Maximize / Restore"
          >
            <Square className="w-3 h-3" />
          </button>

          <button 
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose} 
            className="w-7 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-fg-subtle transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden relative">
        <BlobBackground />
        
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

export default App;
