import React from "react";
import { StudioSelect } from "../../ui/StudioSelect";

interface AppearanceTabProps {
  config: {
    app_language?: string;
    app_font?: string;
    enable_ui_sounds?: boolean;
    auto_open_output?: boolean;
  };
  updateConfig: (patch: any) => void;
  t: (key: any) => string;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  config,
  updateConfig,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-white">
          {t("secAppearanceTitle")}
        </h3>
        <p className="text-[11px] text-[#737373] mt-0.5">
          {t("appLangDesc")}
        </p>
      </div>

      <div className="space-y-3.5 p-3 rounded-xl bg-white/[0.02]">
        {/* Interface Language */}
        <StudioSelect
          label={t("appLangLabel")}
          value={config.app_language || "th"}
          onChange={(e) =>
            updateConfig({
              app_language: e.target.value as "th" | "en",
            })
          }
          options={[
            { value: "th", label: t("langTh") },
            { value: "en", label: t("langEn") },
          ]}
        />

        {/* Font Family */}
        <StudioSelect
          label={t("fontFamilyLabel")}
          value={config.app_font || "Kanit"}
          onChange={(e) => updateConfig({ app_font: e.target.value })}
          options={[
            { value: "Kanit", label: "Kanit" },
            { value: "Prompt", label: "Prompt" },
            { value: "Inter", label: "Inter" },
            { value: "Noto Sans Thai", label: "Noto Sans Thai" },
          ]}
        />

        {/* UI Sounds */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-medium text-white">
              {t("uiSoundsLabel")}
            </div>
            <div className="text-[10px] text-[#737373]">
              {t("uiSoundsDesc")}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              updateConfig({
                enable_ui_sounds: !config.enable_ui_sounds,
              })
            }
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer outline-none ${
              config.enable_ui_sounds ? "bg-white" : "bg-white/[0.12]"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-0.75 ${
                config.enable_ui_sounds
                  ? "right-0.75 bg-[#111113]"
                  : "left-0.75 bg-[#737373]"
              }`}
            />
          </button>
        </div>

        {/* Auto Open Output */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-medium text-white">
              {t("autoOpenLabel")}
            </div>
            <div className="text-[10px] text-[#737373]">
              {t("autoOpenDesc")}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              updateConfig({
                auto_open_output: !config.auto_open_output,
              })
            }
            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer outline-none ${
              config.auto_open_output ? "bg-white" : "bg-white/[0.12]"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-0.75 ${
                config.auto_open_output
                  ? "right-0.75 bg-[#111113]"
                  : "left-0.75 bg-[#737373]"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
