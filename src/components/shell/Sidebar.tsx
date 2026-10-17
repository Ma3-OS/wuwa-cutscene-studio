import React from "react";
import {
  Terminal,
  Search,
  Subtitles,
  Volume2,
  ListPlus,
  Wrench,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  FolderArchive,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useQueueStore } from "../../features/queue/stores/useQueueStore";
import { useCatalogStore } from "../../features/catalog/stores/useCatalogStore";
import { useTaskStore } from "../../features/task-monitor/stores/useTaskStore";
import { DynamicFolderTree } from "./DynamicFolderTree";

export type WorkspaceMode = "studio" | "subtitles" | "audio" | "queue" | "setup";

interface SidebarProps {
  activeWorkspace: WorkspaceMode;
  onSelectWorkspace: (mode: WorkspaceMode) => void;
  isGameRunning?: boolean;
  onOpenPreferences?: () => void;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  onSelectWorkspace,
  isGameRunning: _isGameRunning,
  onOpenPreferences: _onOpenPreferences,
  isTerminalOpen,
  onToggleTerminal,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { t } = useApp();
  const queueCount = useQueueStore((state) => state.items.length);

  const items = useCatalogStore((state) => state.items);
  const selectedFolder = useCatalogStore((state) => state.selectedFolder);
  const setSelectedFolder = useCatalogStore((state) => state.setSelectedFolder);
  const searchQuery = useCatalogStore((state) => state.searchQuery);
  const setSearchQuery = useCatalogStore((state) => state.setSearchQuery);

  const handleSelectFolder = (path: string) => {
    setSelectedFolder(path);
    const label = !path || path === "all" ? "คัตซีนทั้งหมด" : path === "cached" || path === "คลังในเครื่อง" ? "คลังในเครื่อง" : path;
    useTaskStore.getState().appendLog({
      message: `เลือกโฟลเดอร์ ${label}`,
      level: "info",
    });
  };

  const treeItems = items;

  const workspaces: {
    id: WorkspaceMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: "studio", label: t("wsStudio"), icon: Layers },
    { id: "subtitles", label: t("wsSubtitles"), icon: Subtitles },
    { id: "audio", label: t("wsAudio"), icon: Volume2 },
    { id: "queue", label: t("wsQueue"), icon: ListPlus, badge: queueCount },
    { id: "setup", label: t("wsSetup"), icon: Wrench },
  ];

  return (
    <aside
      className={`h-full bg-[#131316] border-r border-white/[0.04] flex flex-col justify-between shrink-0 select-none z-40 transition-all duration-200 ${
        isCollapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-4">
        {/* Workspace Mode Switcher with Collapse/Expand Toggle */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-1 py-1">
            {!isCollapsed && (
              <span className="px-1.5 text-[10px] font-semibold text-[#52525B] tracking-wider uppercase">
                พื้นที่ทำงาน
              </span>
            )}

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className={`w-7 h-7 rounded-md text-[#71717A] hover:text-white hover:bg-white/[0.04] flex items-center justify-center transition-colors cursor-pointer outline-none ${
                  isCollapsed ? "mx-auto" : ""
                }`}
                title={isCollapsed ? "กางแถบข้าง" : "พับแถบข้าง"}
                aria-label={isCollapsed ? "กางแถบข้าง" : "พับแถบข้าง"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {workspaces.map((ws) => {
            const isActive = activeWorkspace === ws.id;
            const Icon = ws.icon;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelectWorkspace(ws.id)}
                title={ws.label}
                className={`transition-colors cursor-pointer outline-none ${
                  isCollapsed
                    ? `w-10 h-10 mx-auto rounded-lg flex items-center justify-center relative ${
                        isActive
                          ? "bg-white/[0.12] text-white"
                          : "text-[#8E8E93] hover:text-white hover:bg-white/[0.03]"
                      }`
                    : `w-full h-8 px-2.5 rounded-lg flex items-center justify-between text-xs font-medium ${
                        isActive
                          ? "bg-white/[0.10] text-white font-semibold"
                          : "text-[#8E8E93] hover:text-white hover:bg-white/[0.03]"
                      }`
                }`}
              >
                {isCollapsed ? (
                  <>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-white" : "text-[#71717A]"
                      }`}
                    />
                    {ws.badge !== undefined && ws.badge > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white absolute top-1.5 right-1.5 shadow-sm" />
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? "text-white" : "text-[#71717A]"
                        }`}
                      />
                      <span className="truncate">{ws.label}</span>
                    </div>
                    {ws.badge !== undefined && ws.badge > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/[0.12] text-white">
                        {ws.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Studio Sub-Navigation: Search & Dynamic FModel Tree */}
        {activeWorkspace === "studio" && (
          <div className="space-y-3 pt-2 border-t border-white/[0.04]">
            {isCollapsed ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="ค้นหาคัตซีน"
                  className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4 text-[#71717A]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFolder("")}
                  title="คัตซีนทั้งหมด"
                  className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    !selectedFolder
                      ? "bg-white/[0.10] text-white"
                      : "text-[#8E8E93] hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Layers className="w-4 h-4 text-[#71717A]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFolder("คลังในเครื่อง")}
                  title="คลังในเครื่อง"
                  className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    selectedFolder === "คลังในเครื่อง"
                      ? "bg-white/[0.10] text-white"
                      : "text-[#8E8E93] hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <FolderArchive className="w-4 h-4 text-[#71717A]" />
                </button>
              </div>
            ) : (
              <>
                {/* Minimal Search Bar */}
                <div className="relative px-0.5">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-7.5 pl-8 pr-2.5 rounded-lg bg-white/[0.04] text-xs text-white placeholder:text-[#52525B] border-none outline-none focus:bg-white/[0.06] transition-colors"
                  />
                </div>

                {/* Dynamic Folder Tree */}
                <DynamicFolderTree
                  items={treeItems}
                  selectedPath={selectedFolder}
                  onSelectPath={handleSelectFolder}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-2 bg-[#0E0E11] border-t border-white/[0.04] shrink-0">
        {isCollapsed ? (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onToggleTerminal}
              className={`w-10 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer outline-none ${
                isTerminalOpen
                  ? "bg-white/[0.12] text-white"
                  : "bg-white/[0.03] text-[#8E8E93] hover:text-white"
              }`}
              title="บันทึกการทำงาน"
            >
              <Terminal className="w-3.5 h-3.5 text-[#71717A]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleTerminal}
            className={`w-full h-7 rounded-md px-2 flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer outline-none ${
              isTerminalOpen
                ? "bg-white/[0.12] text-white"
                : "bg-white/[0.03] text-[#8E8E93] hover:text-white"
            }`}
            title="เปิดหรือปิดบันทึกการทำงาน"
          >
            <Terminal className="w-3 h-3 text-[#71717A]" />
            <span>{t("navTerminal")}</span>
          </button>
        )}
      </div>
    </aside>

  );
};

