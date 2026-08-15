import { motion } from "framer-motion";
import { clsx } from "clsx";
import { 
  Clapperboard, 
  FolderOpen, 
  Film, 
  Settings2, 
  ScrollText, 
  Type, 
  Headphones,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export type TabId = "cutscenes" | "subtitles" | "audio" | "setup" | "logs";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "cutscenes", label: "Cutscene Studio", icon: Clapperboard },
  { id: "subtitles", label: "Subtitle & Style", icon: Type },
  { id: "audio", label: "Audio Engine", icon: Headphones },
  { id: "setup", label: "Paths & System", icon: Settings2 },
  { id: "logs", label: "Activity Terminal", icon: ScrollText },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeTab, onTabChange, isCollapsed, onToggleCollapse }: SidebarProps) {
  const handleOpenOutput = async () => {
    try {
      await invoke("open_output_dir");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.aside 
      animate={{ width: isCollapsed ? 74 : 260 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="border-r border-white/[0.08] bg-[#0c0d12]/95 backdrop-blur-2xl flex flex-col pt-5 pb-5 z-20 shrink-0 select-none overflow-hidden"
    >
      {/* App Branding Header & Collapse Toggle */}
      <div className={`mb-6 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold tracking-tight text-white leading-none truncate">
                WuWa Cutscene
              </h2>
              <span className="text-[9px] font-medium text-fg-muted tracking-wider uppercase mt-1 block">
                Studio Pro
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/10 text-fg-muted hover:text-white flex items-center justify-center transition-colors border border-white/5"
          title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-accent-bright" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex flex-col gap-1.5 flex-1 px-2.5">
        {!isCollapsed && (
          <div className="px-2 pb-1 text-[10px] font-semibold text-fg-muted uppercase tracking-widest opacity-60">
            Navigation
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={clsx(
                "group relative flex items-center rounded-xl text-xs font-medium transition-all duration-200 outline-none",
                isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                isActive ? "text-white font-semibold" : "text-fg-muted hover:text-fg hover:bg-white/[0.04]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/20 to-purple-500/10 border border-accent/30 shadow-sm"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              
              <Icon 
                className={clsx(
                  "w-4 h-4 relative z-10 transition-colors shrink-0", 
                  isActive ? "text-accent-bright" : "text-fg-muted group-hover:text-fg"
                )} 
              />
              {!isCollapsed && <span className="relative z-10 truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>
      
      {/* Quick Action: Open Output Directory */}
      <div className="mt-auto pt-3 border-t border-white/[0.06] flex flex-col gap-2 px-2.5">
        <button
          onClick={handleOpenOutput}
          className={clsx(
            "flex items-center rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-fg-muted hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200 group",
            isCollapsed ? "justify-center p-3" : "gap-2.5 px-3 py-2.5"
          )}
          title="Open local output folder in File Explorer"
        >
          <FolderOpen className="w-4 h-4 text-accent group-hover:scale-110 transition-transform shrink-0" />
          {!isCollapsed && <span className="truncate">Output Folder</span>}
        </button>

        {!isCollapsed && (
          <div className="px-2 flex items-center justify-between text-[10px] text-fg-subtle font-mono opacity-50">
            <span>v1.0.0</span>
            <span>Pro Edition</span>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
