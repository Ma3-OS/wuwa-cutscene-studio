import React from "react";
import { Sparkles } from "lucide-react";
import { StylePreset, PRESETS } from "../constants";

interface SubtitlePresetsBarProps {
  label: string;
  onApplyPreset: (preset: StylePreset) => void;
}

export const SubtitlePresetsBar: React.FC<SubtitlePresetsBarProps> = ({
  label,
  onApplyPreset,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
      <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
        <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
        {label}:
      </span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onApplyPreset(p)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] text-[#A3A3A3] hover:text-white hover:bg-white/[0.08] transition-all whitespace-nowrap cursor-pointer outline-none"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};
