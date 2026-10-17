import React from "react";
import { StudioButton } from "../../ui/StudioButton";

interface PathsTabProps {
  exportDir: string;
  outputDir: string;
  onBrowseExportDir: () => void;
  onBrowseOutputDir: () => void;
  t: (key: any) => string;
}

export const PathsTab: React.FC<PathsTabProps> = ({
  exportDir,
  outputDir,
  onBrowseExportDir,
  onBrowseOutputDir,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-white">
          {t("secPathsTitle")}
        </h3>
        <p className="text-[11px] text-[#737373] mt-0.5">
          {t("settingsDesc")}
        </p>
      </div>

      {/* FModel Export Directory */}
      <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02]">
        <label className="text-[11px] font-medium text-white block">
          {t("fmodelExportDirLabel")}
        </label>
        <p className="text-[10px] text-[#737373]">
          {t("fmodelExportDirDesc")}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={exportDir || ""}
            placeholder={t("pathsExportPlaceholder")}
            className="flex-1 h-8 px-3 rounded-lg bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
          />
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={onBrowseExportDir}
          >
            {t("btnBrowse")}
          </StudioButton>
        </div>
      </div>

      {/* Output Directory */}
      <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02]">
        <label className="text-[11px] font-medium text-white block">
          {t("outputDirLabel")}
        </label>
        <p className="text-[10px] text-[#737373]">
          {t("outputDirDesc")}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={outputDir || ""}
            placeholder={t("pathsOutputPlaceholder")}
            className="flex-1 h-8 px-3 rounded-lg bg-white/[0.04] text-xs text-white font-mono border-none outline-none"
          />
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={onBrowseOutputDir}
          >
            {t("btnBrowse")}
          </StudioButton>
        </div>
      </div>
    </div>
  );
};
