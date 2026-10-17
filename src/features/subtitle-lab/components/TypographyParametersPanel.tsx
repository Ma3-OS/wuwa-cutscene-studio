import React, { useState } from "react";
import { Type, Music, Languages, Sliders } from "lucide-react";
import { StudioSelect } from "@/components/ui/StudioSelect";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { useApp } from "@/context/AppContext";
import type { TranslationKey } from "@/locales";

interface TypographyParametersPanelProps {
  title?: string;
  fontFamilyLabel?: string;
  fontSizeLabel?: string;
  outlineWidthLabel?: string;
  shadowDepthLabel?: string;
  verticalMarginLabel?: string;
  textColorLabel?: string;

  // Dialogue
  subFont: string;
  setSubFont: (val: string) => void;
  subSize: number;
  setSubSize: (val: number) => void;
  subOutline: number;
  setSubOutline: (val: number) => void;
  subShadow: number;
  setSubShadow: (val: number) => void;
  subMarginV: number;
  setSubMarginV: (val: number) => void;
  subColor: string;
  setSubColor: (val: string) => void;

  // Ruby
  rubyEnabled: boolean;
  setRubyEnabled: (val: boolean) => void;
  rubyFont?: string;
  setRubyFont?: (val: string) => void;
  rubySize: number;
  setRubySize: (val: number) => void;
  rubyOutline?: number;
  setRubyOutline?: (val: number) => void;
  rubyShadow?: number;
  setRubyShadow?: (val: number) => void;
  rubyOffsetY: number;
  setRubyOffsetY: (val: number) => void;
  rubyColor: string;
  setRubyColor: (val: string) => void;

  // Lyrics
  lyricFont?: string;
  setLyricFont?: (val: string) => void;
  lyricSize: number;
  setLyricSize: (val: number) => void;
  lyricOutline?: number;
  setLyricOutline?: (val: number) => void;
  lyricShadow?: number;
  setLyricShadow?: (val: number) => void;
  lyricMarginX: number;
  setLyricMarginX: (val: number) => void;
  lyricMarginY: number;
  setLyricMarginY: (val: number) => void;
  lyricBilingual: boolean;
  setLyricBilingual: (val: boolean) => void;
  lyricColor: string;
  setLyricColor: (val: string) => void;
}

const FONT_DEFS: Array<{ value: string; key: TranslationKey }> = [
  { value: "Kanit Medium", key: "fontKanitDesc" },
  { value: "Prompt Medium", key: "fontPromptDesc" },
  { value: "Segoe UI", key: "fontSegoeDesc" },
  { value: "Inter", key: "fontInterDesc" },
  { value: "Noto Sans Thai", key: "fontNotoDesc" },
  { value: "Tahoma", key: "fontTahomaDesc" },
  { value: "Arial", key: "fontArialDesc" },
];

const COLOR_SWATCHES: Array<{ nameKey: TranslationKey; hex: string }> = [
  { nameKey: "subColorWhite", hex: "#FFFFFF" },
  { nameKey: "subColorGold", hex: "#FEF08A" },
  { nameKey: "subColorGray", hex: "#E0E0E0" },
  { nameKey: "subColorSky", hex: "#E0F2FE" },
  { nameKey: "subColorMint", hex: "#CCFBF1" },
];

// Sleek Apple Pro App Parameter Row with Slider and Precision Numeric Box
const AppleProSliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  hint?: string;
}> = ({ label, value, min, max, step = 1, unit = "px", onChange, hint }) => {
  return (
    <div className="py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#A1A1AA] font-medium">{label}</span>
        <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-0.5 rounded-lg border border-white/[0.08]">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) onChange(val);
            }}
            className="w-12 bg-transparent text-right font-mono text-xs text-white outline-none"
          />
          <span className="text-[10px] font-mono text-[#71717A]">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer transition-all"
      />
      {hint && <p className="text-[10px] text-[#71717A]">{hint}</p>}
    </div>
  );
};

// Sleek Apple Pro Color Picker Row
const AppleProColorRow: React.FC<{
  label: string;
  color: string;
  onChange: (val: string) => void;
  t: (key: TranslationKey) => string;
}> = ({ label, color, onChange, t }) => {
  return (
    <div className="pt-2.5 space-y-2">
      <span className="text-xs text-[#A1A1AA] font-medium flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-white/40" />
        <span>{label}</span>
      </span>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => onChange(swatch.hex)}
              className={`w-6 h-6 rounded-full transition-all cursor-pointer outline-none ${
                color.toLowerCase() === swatch.hex.toLowerCase()
                  ? "ring-2 ring-white scale-110 shadow-md"
                  : "opacity-75 hover:opacity-100 hover:scale-105"
              }`}
              style={{ backgroundColor: swatch.hex }}
              title={t(swatch.nameKey)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#1A1A1E] px-2.5 py-1 rounded-lg border border-white/[0.08]">
          <div
            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
            style={{ backgroundColor: color }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            maxLength={7}
            className="w-16 bg-transparent font-mono text-xs text-white outline-none uppercase"
            placeholder="#FFFFFF"
          />
          <div className="relative w-4 h-4 overflow-hidden rounded cursor-pointer shrink-0">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="absolute -top-3 -left-3 w-10 h-10 cursor-pointer border-0 p-0"
              title={t("subPalettePicker")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const TypographyParametersPanel: React.FC<TypographyParametersPanelProps> = ({
  title,
  fontFamilyLabel,
  fontSizeLabel,
  outlineWidthLabel,
  shadowDepthLabel,
  verticalMarginLabel,
  textColorLabel,
  subFont,
  setSubFont,
  subSize,
  setSubSize,
  subOutline,
  setSubOutline,
  subShadow,
  setSubShadow,
  subMarginV,
  setSubMarginV,
  subColor,
  setSubColor,
  rubyEnabled,
  setRubyEnabled,
  rubyFont = "Kanit Medium",
  setRubyFont,
  rubySize,
  setRubySize,
  rubyOutline = 1.0,
  setRubyOutline,
  rubyShadow = 0.6,
  setRubyShadow,
  rubyOffsetY,
  setRubyOffsetY,
  rubyColor,
  setRubyColor,
  lyricFont = "Kanit Medium",
  setLyricFont,
  lyricSize,
  setLyricSize,
  lyricOutline = 1.0,
  setLyricOutline,
  lyricShadow = 0.6,
  setLyricShadow,
  lyricMarginX,
  setLyricMarginX,
  lyricMarginY,
  setLyricMarginY,
  lyricBilingual,
  setLyricBilingual,
  lyricColor,
  setLyricColor,
}) => {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<"dialogue" | "ruby" | "lyric">("dialogue");
  const fontOptions = FONT_DEFS.map((f) => ({ value: f.value, label: t(f.key) }));

  const effectiveTitle = title || t("subStudioTitle");
  const effectiveFontFamilyLabel = fontFamilyLabel || t("fontFamilyLabel");
  const effectiveFontSizeLabel = fontSizeLabel || t("fontSizeLabel");
  const effectiveOutlineWidthLabel = outlineWidthLabel || t("outlineWidthLabel");
  const effectiveShadowDepthLabel = shadowDepthLabel || t("shadowDepthLabel");
  const effectiveVerticalMarginLabel = verticalMarginLabel || t("verticalMarginLabel");
  const effectiveTextColorLabel = textColorLabel || t("textColorLabel");

  return (
    <div className="lg:col-span-5 p-5 rounded-2xl bg-[#141418] border border-white/[0.06] space-y-4 overflow-y-auto no-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <h3 className="text-xs font-semibold text-white flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-neutral-400" />
          <span>{effectiveTitle}</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-[#A1A1AA] border border-white/[0.04]">
          {t("subStandard1080p")}
        </span>
      </div>

      {/* Navigation Segmented Tabs */}
      <StudioSegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "dialogue", label: t("subTabDialogue"), icon: Type },
          { value: "ruby", label: t("subTabRuby"), icon: Languages },
          { value: "lyric", label: t("subTabLyric"), icon: Music },
        ]}
        className="w-full"
      />

      {/* Tab 1: Dialogue Settings */}
      {activeTab === "dialogue" && (
        <div className="divide-y divide-white/[0.05]">
          <div className="pb-3">
            <StudioSelect
              label={effectiveFontFamilyLabel}
              value={subFont}
              onChange={(e) => setSubFont(e.target.value)}
              options={fontOptions}
            />
          </div>

          <AppleProSliderRow
            label={effectiveFontSizeLabel}
            value={subSize}
            min={16}
            max={72}
            step={1}
            unit="px"
            onChange={setSubSize}
          />

          <AppleProSliderRow
            label={effectiveOutlineWidthLabel}
            value={subOutline}
            min={0}
            max={6}
            step={0.1}
            unit="px"
            onChange={setSubOutline}
          />

          <AppleProSliderRow
            label={effectiveShadowDepthLabel}
            value={subShadow}
            min={0}
            max={6}
            step={0.1}
            unit="px"
            onChange={setSubShadow}
          />

          <AppleProSliderRow
            label={effectiveVerticalMarginLabel}
            value={subMarginV}
            min={0}
            max={180}
            step={1}
            unit="px"
            onChange={setSubMarginV}
          />

          <AppleProColorRow
            label={effectiveTextColorLabel}
            color={subColor}
            onChange={setSubColor}
            t={t}
          />
        </div>
      )}

      {/* Tab 2: Ruby Settings */}
      {activeTab === "ruby" && (
        <div className="divide-y divide-white/[0.05]">
          {/* Ruby Toggle */}
          <div className="pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t("subRubyToggle")}</span>
              </span>
              <p className="text-[11px] text-[#71717A]">
                {t("subRubyDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRubyEnabled(!rubyEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 outline-none ${
                rubyEnabled ? "bg-white" : "bg-neutral-800 border border-white/10"
              }`}
            >
              <div
                className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  rubyEnabled ? "translate-x-5" : "translate-x-0 bg-neutral-400"
                }`}
              />
            </button>
          </div>

          {/* Ruby Font Selector */}
          {setRubyFont && (
            <div className="py-3">
              <StudioSelect
                label={t("subRubyFont")}
                value={rubyFont}
                onChange={(e) => setRubyFont(e.target.value)}
                options={fontOptions}
              />
            </div>
          )}

          <AppleProSliderRow
            label={t("subRubySize")}
            value={rubySize}
            min={0}
            max={48}
            step={1}
            unit="px"
            onChange={setRubySize}
            hint={rubySize === 0 ? t("subRubySizeHintAuto") : t("subRubySizeHintFixed")}
          />

          {setRubyOutline && (
            <AppleProSliderRow
              label={t("subRubyOutline")}
              value={rubyOutline}
              min={0}
              max={6}
              step={0.1}
              unit="px"
              onChange={setRubyOutline}
              hint={t("subRubyOutlineHint")}
            />
          )}

          {setRubyShadow && (
            <AppleProSliderRow
              label={t("subRubyShadow")}
              value={rubyShadow}
              min={0}
              max={6}
              step={0.1}
              unit="px"
              onChange={setRubyShadow}
              hint={t("subRubyShadowHint")}
            />
          )}

          <AppleProSliderRow
            label={t("subRubyOffsetY")}
            value={rubyOffsetY}
            min={-20}
            max={40}
            step={1}
            unit="px"
            onChange={setRubyOffsetY}
            hint={t("subRubyOffsetYHint")}
          />

          <AppleProColorRow
            label={t("subRubyColor")}
            color={rubyColor}
            onChange={setRubyColor}
            t={t}
          />
        </div>
      )}

      {/* Tab 3: Lyric Settings */}
      {activeTab === "lyric" && (
        <div className="divide-y divide-white/[0.05]">
          {/* Bilingual Toggle */}
          <div className="pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t("subLyricBilingualToggle")}</span>
              </span>
              <p className="text-[11px] text-[#71717A]">
                {t("subLyricBilingualDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLyricBilingual(!lyricBilingual)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 outline-none ${
                lyricBilingual ? "bg-white" : "bg-neutral-800 border border-white/10"
              }`}
            >
              <div
                className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  lyricBilingual ? "translate-x-5" : "translate-x-0 bg-neutral-400"
                }`}
              />
            </button>
          </div>

          {/* Lyric Font Selector */}
          {setLyricFont && (
            <div className="py-3">
              <StudioSelect
                label={t("subLyricFont")}
                value={lyricFont}
                onChange={(e) => setLyricFont(e.target.value)}
                options={fontOptions}
              />
            </div>
          )}

          <AppleProSliderRow
            label={t("subLyricSize")}
            value={lyricSize}
            min={0}
            max={72}
            step={1}
            unit="px"
            onChange={setLyricSize}
            hint={lyricSize === 0 ? t("subLyricSizeHintAuto") : t("subLyricSizeHintFixed")}
          />

          {setLyricOutline && (
            <AppleProSliderRow
              label={t("subLyricOutline")}
              value={lyricOutline}
              min={0}
              max={6}
              step={0.1}
              unit="px"
              onChange={setLyricOutline}
              hint={t("subLyricOutlineHint")}
            />
          )}

          {setLyricShadow && (
            <AppleProSliderRow
              label={t("subLyricShadow")}
              value={lyricShadow}
              min={0}
              max={6}
              step={0.1}
              unit="px"
              onChange={setLyricShadow}
              hint={t("subLyricShadowHint")}
            />
          )}

          <AppleProSliderRow
            label={t("subLyricMarginX")}
            value={lyricMarginX}
            min={20}
            max={400}
            step={5}
            unit="px"
            onChange={setLyricMarginX}
            hint={t("subLyricMarginXHint")}
          />

          <AppleProSliderRow
            label={t("subLyricMarginY")}
            value={lyricMarginY}
            min={10}
            max={200}
            step={2}
            unit="px"
            onChange={setLyricMarginY}
            hint={t("subLyricMarginYHint")}
          />

          <AppleProColorRow
            label={t("subLyricColor")}
            color={lyricColor}
            onChange={setLyricColor}
            t={t}
          />
        </div>
      )}
    </div>
  );
};
