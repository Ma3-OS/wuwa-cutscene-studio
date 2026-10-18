import React from "react";
import {
  Film,
  Clapperboard,
  Layers,
  User,
  Search,
  MessageSquare,
  X,
  RefreshCw,
  LayoutGrid,
  List,
  PanelRight,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

interface GalleryToolbarProps {
  toolbarMode: "full" | "compact" | "icon";
  isSearchOverlayOpen: boolean;
  setIsSearchOverlayOpen: (val: boolean) => void;
  assetKindFilter: "all" | "video" | "sequence";
  onAssetKindChange: (kind: "all" | "video" | "sequence") => void;
  videoCount: number;
  sequenceCount: number;
  totalKindCount: number;
  roverFilter: string;
  charSelection: string;
  onRoverFilterChange: (gender: "all" | "Girl" | "Boy") => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchMode: "name" | "dialogue";
  onToggleSearchMode: () => void;
  loading: boolean;
  onRefresh: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  toolbarMode,
  isSearchOverlayOpen,
  setIsSearchOverlayOpen,
  assetKindFilter,
  onAssetKindChange,
  videoCount,
  sequenceCount,
  totalKindCount,
  roverFilter,
  charSelection: _charSelection,
  onRoverFilterChange,
  searchQuery,
  onSearchQueryChange,
  searchMode,
  onToggleSearchMode,
  loading,
  onRefresh,
  viewMode,
  onViewModeChange,
  isInspectorOpen = true,
  onToggleInspector,
}) => {
  const { t } = useApp();
  if (isSearchOverlayOpen && toolbarMode === "icon") {
    return (
      <div className="h-10 px-3 border-b border-white/[0.04] flex items-center gap-2 shrink-0 bg-[#131316] w-full">
        <button
          type="button"
          onClick={onToggleSearchMode}
          className="px-2 py-1 rounded text-xs font-medium bg-white/[0.04] text-[#8E8E93] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          title={t("gallerySearchModeSwitch")}
        >
          {searchMode === "name" ? (
            <>
              <Film className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-xs">{t("gallerySearchModeName")}</span>
            </>
          ) : (
            <>
              <MessageSquare className="w-3 h-3 text-neutral-300 shrink-0" />
              <span className="text-xs">{t("gallerySearchModeDialogue")}</span>
            </>
          )}
        </button>
        <div className="relative flex-1 flex items-center min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2 text-neutral-500 pointer-events-none shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={searchMode === "name" ? t("gallerySearchPlaceholderName") : t("gallerySearchPlaceholderDialogue")}
            className="w-full h-7 pl-7 pr-7 bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              className="absolute right-2 w-4 h-4 rounded flex items-center justify-center text-neutral-500 hover:text-white cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsSearchOverlayOpen(false)}
          className="w-7 h-7 rounded-md bg-white/[0.04] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={t("gallerySearchClose")}
          aria-label={t("gallerySearchClose")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-10 px-3.5 border-b border-white/[0.04] flex items-center justify-between gap-2 shrink-0 bg-[#131316]">
      {/* Left Side: Segmented Filter Pills & Rover Gender Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink">
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onAssetKindChange("video")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              assetKindFilter === "video"
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilterCinema")}
          >
            {toolbarMode === "full" ? (
              <span>{t("galleryFilterCinema")}</span>
            ) : toolbarMode === "compact" ? (
              <span>{t("galleryFilterCinemaShort")}</span>
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px] font-mono text-[#71717A]">{videoCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onAssetKindChange("sequence")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              assetKindFilter === "sequence"
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilter3D")}
          >
            {toolbarMode === "full" ? (
              <span>{t("galleryFilter3DShort")}</span>
            ) : toolbarMode === "compact" ? (
              <span>3D</span>
            ) : (
              <Clapperboard className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px] font-mono text-[#71717A]">{sequenceCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onAssetKindChange("all")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              assetKindFilter === "all"
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilterAll")}
          >
            {toolbarMode === "icon" ? (
              <Layers className="w-3.5 h-3.5" />
            ) : (
              <span>{t("galleryFilterAll")}</span>
            )}
            <span className="text-[10px] font-mono text-[#71717A]">{totalKindCount}</span>
          </button>
        </div>

        <div className="h-3.5 w-px bg-white/[0.06] shrink-0" />

        {/* Rover Gender Segmented Control */}
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onRoverFilterChange("all")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              roverFilter === "all" || !roverFilter
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilterAllGenders")}
          >
            {toolbarMode === "icon" ? (
              <User className="w-3 h-3 text-neutral-400" />
            ) : (
              <span>{t("galleryFilterAllGenders")}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onRoverFilterChange("Girl")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              roverFilter === "Girl"
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilterFemaleRover")}
          >
            <User className="w-3 h-3 text-neutral-400" />
            {toolbarMode === "full" && <span>{t("galleryFilterFemaleRover")}</span>}
            {toolbarMode === "compact" && <span>{t("galleryFilterFemaleShort")}</span>}
          </button>

          <button
            type="button"
            onClick={() => onRoverFilterChange("Boy")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none flex items-center gap-1 ${
              roverFilter === "Boy"
                ? "bg-white/[0.12] text-white font-medium shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryFilterMaleRover")}
          >
            <User className="w-3 h-3 text-neutral-400" />
            {toolbarMode === "full" && <span>{t("galleryFilterMaleRover")}</span>}
            {toolbarMode === "compact" && <span>{t("galleryFilterMaleShort")}</span>}
          </button>
        </div>
      </div>

      {/* Middle: Studio Spotlight Search */}
      {toolbarMode === "icon" ? (
        <button
          type="button"
          onClick={() => setIsSearchOverlayOpen(true)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer outline-none shrink-0 ${
            searchQuery
              ? "bg-white/[0.12] text-white"
              : "bg-white/[0.03] text-[#8E8E93] hover:text-white"
          }`}
          title={t("sidebarSearchCutscene")}
          aria-label={t("sidebarSearchCutscene")}
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="flex-1 min-w-[140px] max-w-[280px] relative flex items-center bg-white/[0.04] rounded-lg px-2 border border-white/[0.06] focus-within:border-white/20 transition-colors">
          <Search className="w-3.5 h-3.5 text-neutral-500 pointer-events-none shrink-0 mr-1.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={searchMode === "name" ? t("gallerySearchPlaceholderName") : t("gallerySearchPlaceholderDialogue")}
            className="w-full h-7 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              className="w-4 h-4 rounded flex items-center justify-center text-neutral-500 hover:text-white cursor-pointer mr-1"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSearchMode}
            className={`p-1 rounded text-[10px] font-medium transition-colors cursor-pointer outline-none shrink-0 ${
              searchMode === "dialogue" ? "text-white bg-white/[0.12]" : "text-[#71717A] hover:text-white"
            }`}
            title={searchMode === "name" ? t("gallerySwitchToDialogue") : t("gallerySwitchToName")}
          >
            {searchMode === "name" ? <Film className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Right Side: View Mode, Refresh & Inspector Toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="w-7 h-7 rounded-md bg-white/[0.03] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors cursor-pointer outline-none disabled:opacity-40"
          title={t("galleryRefresh")}
          aria-label={t("galleryRefresh")}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin text-white" : ""}`}
          />
        </button>

        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer outline-none ${
              viewMode === "grid"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-[#71717A] hover:text-white"
            }`}
            title={t("galleryGridView")}
            aria-label={t("galleryGridView")}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer outline-none ${
              viewMode === "list"
                ? "bg-white/[0.12] text-white shadow-sm"
                : "text-[#71717A] hover:text-white"
            }`}
            title={t("galleryListView")}
            aria-label={t("galleryListView")}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer outline-none ${
              isInspectorOpen
                ? "bg-white/[0.12] text-white"
                : "bg-white/[0.03] text-[#8E8E93] hover:text-white"
            }`}
            title={t("galleryToggleInspector")}
            aria-label={t("galleryToggleInspector")}
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
