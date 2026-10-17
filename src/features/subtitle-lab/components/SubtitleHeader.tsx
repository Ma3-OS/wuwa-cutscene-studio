import React from "react";
import { Subtitles, RotateCcw, CheckCheck } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";
import { StudioSelect } from "@/components/ui/StudioSelect";
import { StylePreset } from "../constants";

interface SubtitleHeaderProps {
  title: string;
  desc: string;
  lastSaved: string | null;
  onReset: () => void;
  resetLabel: string;
  presets?: StylePreset[];
  onApplyPreset?: (preset: StylePreset) => void;
}

export const SubtitleHeader: React.FC<SubtitleHeaderProps> = ({
  title,
  desc,
  lastSaved,
  onReset,
  resetLabel,
  presets,
  onApplyPreset,
}) => {
  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] flex items-center justify-center text-white">
          <Subtitles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-white tracking-wide">
              {title}
            </h1>
            {lastSaved && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-neutral-400 border border-white/[0.04]">
                <CheckCheck className="w-3 h-3 text-neutral-400" /> {lastSaved}
              </span>
            )}
          </div>
          <p className="text-xs text-[#737373] mt-0.5">
            {desc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {presets && onApplyPreset && (
          <div className="w-48">
            <StudioSelect
              placeholder="เลือกรูปแบบพรีเซ็ต..."
              options={presets.map((p) => ({
                value: p.id,
                label: p.label,
              }))}
              onChange={(e) => {
                const found = presets.find((p) => p.id === e.target.value);
                if (found) onApplyPreset(found);
              }}
            />
          </div>
        )}

        <StudioButton variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetLabel}</span>
        </StudioButton>
      </div>
    </div>
  );
};
