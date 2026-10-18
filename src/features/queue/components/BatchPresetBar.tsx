import React from "react";
import { StudioButton } from "@/components/ui/StudioButton";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { StudioSelect } from "@/components/ui/StudioSelect";
import { useApp } from "@/context/AppContext";
import { SUBTITLE_LANGUAGES } from "@/locales";

interface BatchPresetBarProps {
  batchGender: "Girl" | "Boy";
  setBatchGender: (val: "Girl" | "Boy") => void;
  batchLocale: string;
  setBatchLocale: (val: string) => void;
  batchSubMode: "Hard-sub" | "Soft-sub" | "None";
  setBatchSubMode: (val: "Hard-sub" | "Soft-sub" | "None") => void;
  batchSubLang: string;
  setBatchSubLang: (val: string) => void;
  batchResolution: string;
  setBatchResolution: (val: string) => void;
  autoAction: "none" | "chime" | "folder" | "sleep" | "shutdown";
  setAutoAction: (val: "none" | "chime" | "folder" | "sleep" | "shutdown") => void;
  onApplyPresets: () => void;
}

export const BatchPresetBar: React.FC<BatchPresetBarProps> = ({
  batchGender,
  setBatchGender,
  batchLocale,
  setBatchLocale,
  batchSubMode,
  setBatchSubMode,
  batchSubLang,
  setBatchSubLang,
  batchResolution,
  setBatchResolution,
  autoAction,
  setAutoAction,
  onApplyPresets,
}) => {
  const { t } = useApp();

  return (
    <div className="p-3.5 rounded-2xl bg-[#141417] flex flex-wrap items-center justify-between gap-3 text-xs border border-white/[0.04]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider mr-1">
          {t("queueBatchPresetTitle")}
        </span>

        {/* Protagonist */}
        <div className="w-36 shrink-0">
          <StudioSegmentedControl<"Girl" | "Boy">
            size="sm"
            value={batchGender}
            onChange={setBatchGender}
            options={[
              { value: "Girl", label: t("roverGirl") },
              { value: "Boy", label: t("roverBoy") },
            ]}
          />
        </div>

        {/* Voice Language */}
        <div className="w-44 shrink-0">
          <StudioSegmentedControl<string>
            size="sm"
            value={batchLocale}
            onChange={setBatchLocale}
            options={[
              { value: "ja", label: "JP" },
              { value: "en", label: "EN" },
              { value: "ko", label: "KR" },
              { value: "zh", label: "CN" },
            ]}
          />
        </div>

        {/* Subtitle Mode */}
        <div className="w-56 shrink-0">
          <StudioSegmentedControl<"Hard-sub" | "Soft-sub" | "None">
            size="sm"
            value={batchSubMode}
            onChange={setBatchSubMode}
            options={[
              { value: "Hard-sub", label: t("subModeHardsub") },
              { value: "Soft-sub", label: t("subModeSoftsub") },
              { value: "None", label: t("subModeNone") },
            ]}
          />
        </div>

        {/* Subtitle Language */}
        <div className="w-36 shrink-0">
          <StudioSelect
            value={batchSubLang}
            onChange={(e) => setBatchSubLang(e.target.value)}
            options={SUBTITLE_LANGUAGES.map((l) => ({
              value: l.code,
              label: `${l.shortLabel} ${l.nativeLabel}`,
            }))}
          />
        </div>

        {/* Resolution */}
        <div className="w-40 shrink-0">
          <StudioSelect
            value={batchResolution}
            onChange={(e) => setBatchResolution(e.target.value)}
            options={[
              { value: "1920x1080", label: t("res1080pCinema") },
              { value: "1920x1080_zoom", label: t("res1080pZoom") },
              { value: "original", label: t("resOriginalUltrawide") },
              { value: "1080x1920", label: t("resVerticalShorts") },
              { value: "2560x1440", label: t("res2kQHD") },
              { value: "3840x2160", label: t("res4kUHD") },
            ]}
          />
        </div>

        {/* Auto Action */}
        <div className="w-52 shrink-0">
          <StudioSelect
            value={autoAction}
            onChange={(e) => setAutoAction(e.target.value as any)}
            options={[
              { value: "none", label: t("postActionNone") },
              { value: "chime", label: t("postActionChime") },
              { value: "folder", label: t("postActionFolder") },
              { value: "sleep", label: t("postActionSleep") },
              { value: "shutdown", label: t("postActionShutdown") },
            ]}
          />
        </div>
      </div>

      <StudioButton variant="secondary" size="sm" onClick={onApplyPresets} className="shrink-0 whitespace-nowrap ml-2">
        <span>{t("queueApplyAll")}</span>
      </StudioButton>
    </div>
  );
};
