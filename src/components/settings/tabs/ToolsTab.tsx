import React from "react";
import { Loader2 } from "lucide-react";
import { StudioButton } from "../../ui/StudioButton";
import { DependencyStatusDto } from "../../../core/ipc";

interface ToolsTabProps {
  deps: DependencyStatusDto | null;
  isSyncingTools: boolean;
  onSyncAllTools: () => void;
  t: (key: any) => string;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  deps,
  isSyncingTools,
  onSyncAllTools,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-white">
            {t("secToolsTitle")}
          </h3>
          <p className="text-[11px] text-[#737373] mt-0.5">
            {t("toolsAndDataDesc")}
          </p>
        </div>
        <StudioButton
          variant="primary"
          size="sm"
          className="whitespace-nowrap h-7.5 px-3 text-xs"
          onClick={onSyncAllTools}
          disabled={isSyncingTools}
        >
          {isSyncingTools ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("btnSyncing")}</span>
            </>
          ) : (
            <span>{t("btnSyncTools")}</span>
          )}
        </StudioButton>
      </div>

      {/* Tool Status Cards */}
      <div className="space-y-2">
        {[
          {
            name: "FFmpeg & ffprobe",
            desc: "Hardware video muxer & encoder",
            ready: deps?.ffmpeg ?? false,
          },
          {
            name: "Wwiser Engine",
            desc: "Audiokinetic Wwise soundbank parser",
            ready: deps?.wwiser ?? false,
          },
          {
            name: "vgmstream-cli",
            desc: "Lossless game audio stream decoder",
            ready: deps?.vgmstream ?? false,
          },
          {
            name: "Game Database",
            desc: "Cutscene textmaps & audio events",
            ready: deps?.json_data ?? false,
          },
        ].map((item) => (
          <div
            key={item.name}
            className="p-3 rounded-xl bg-white/[0.02] flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-medium text-white">
                {item.name}
              </div>
              <div className="text-[11px] text-[#737373] mt-0.5">
                {item.desc}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  item.ready ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span className="text-xs text-[#A3A3A3]">
                {item.ready ? t("statusInstalled") : t("statusMissing")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* AES Pak Key Reference */}
      <div className="p-3 rounded-xl bg-[#121214] text-[11px] text-[#737373] space-y-1">
        <div className="font-medium text-[#A3A3A3]">
          Unreal Engine Pak AES Keys
        </div>
        <p className="text-[10px] leading-relaxed">
          Decryption keys are fetched externally to respect DMCA guidelines:
        </p>
        <div className="text-[10px] font-mono text-[#A3A3A3] bg-white/[0.02] p-1.5 rounded">
          github.com/yarik0chka/wuwa-keys
        </div>
      </div>
    </div>
  );
};
