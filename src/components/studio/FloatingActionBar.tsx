import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ListPlus } from "lucide-react";
import { StudioButton } from "../ui/StudioButton";
import { useApp } from "../../context/AppContext";

interface FloatingActionBarProps {
  selectedCount: number;
  onAddAllToQueue: () => void;
  onDeselectAll: () => void;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  selectedCount,
  onAddAllToQueue,
  onDeselectAll,
}) => {
  const { t } = useApp();

  if (selectedCount <= 1) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 450, damping: 32, mass: 0.8 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#161619]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 select-none"
      >
        <div className="flex items-center gap-2 pl-1 pr-2 border-r border-white/[0.06]">
          <Layers className="w-3.5 h-3.5 text-[#A3A3A3]" />
          <span className="text-xs font-medium text-white">
            {t("selectedItemsCount")} {selectedCount} {t("videoClipsCount")}
          </span>
        </div>

        <StudioButton
          variant="primary"
          size="sm"
          className="text-xs"
          onClick={onAddAllToQueue}
        >
          <ListPlus className="w-3.5 h-3.5" />
          <span>{t("btnAddAllToQueue")}</span>
        </StudioButton>

        <button
          type="button"
          onClick={onDeselectAll}
          className="h-7 px-2.5 rounded-lg text-xs font-medium text-[#737373] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer outline-none"
        >
          {t("btnDeselectAll")}
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
