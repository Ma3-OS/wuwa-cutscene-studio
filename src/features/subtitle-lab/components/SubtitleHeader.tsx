import React from "react";
import { Subtitles, RotateCcw, CheckCheck } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";

interface SubtitleHeaderProps {
  title: string;
  desc: string;
  lastSaved: string | null;
  onReset: () => void;
  resetLabel: string;
}

export const SubtitleHeader: React.FC<SubtitleHeaderProps> = ({
  title,
  desc,
  lastSaved,
  onReset,
  resetLabel,
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
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCheck className="w-3 h-3" /> {lastSaved}
              </span>
            )}
          </div>
          <p className="text-xs text-[#737373] mt-0.5">
            {desc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StudioButton variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetLabel}</span>
        </StudioButton>
      </div>
    </div>
  );
};
