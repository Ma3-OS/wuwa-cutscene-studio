import React from "react";
import { Type } from "lucide-react";
import { SAMPLE_TEXTS } from "../constants";

interface SampleDialogueCardProps {
  label: string;
  sampleLang: "th" | "en" | "ja" | "zh";
  onSwitchLanguage: (lang: "th" | "en" | "ja" | "zh") => void;
  enableRuby: boolean;
  setEnableRuby: (val: boolean) => void;
  rubyText: string;
  setRubyText: (val: string) => void;
  baseText: string;
  setBaseText: (val: string) => void;
}

export const SampleDialogueCard: React.FC<SampleDialogueCardProps> = ({
  label,
  sampleLang,
  onSwitchLanguage,
  enableRuby,
  setEnableRuby,
  rubyText,
  setRubyText,
  baseText,
  setBaseText,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#141416] space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-[#737373] uppercase tracking-wider font-medium flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-neutral-400" />
          {label}
        </span>

        {/* Language Switcher Chips */}
        <div className="flex items-center gap-1.5">
          {(["th", "en", "ja", "zh"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onSwitchLanguage(lang)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-medium uppercase transition-colors cursor-pointer outline-none ${
                sampleLang === lang ? "bg-white/[0.14] text-white" : "text-[#737373] hover:text-white"
              }`}
            >
              {lang}
            </button>
          ))}
          <div className="w-px h-3 bg-white/[0.08] mx-1" />
          <button
            type="button"
            onClick={() => setEnableRuby(!enableRuby)}
            className={`text-[10px] px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer outline-none ${
              enableRuby ? "bg-white/[0.14] text-white" : "text-[#737373] hover:text-white"
            }`}
          >
            คำอ่านรูบี้กำกับคำ
          </button>
        </div>
      </div>

      {/* Quick Sentence Presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-[#71717A] font-medium">รูปแบบตัวอย่าง:</span>
        <button
          type="button"
          onClick={() => setBaseText(SAMPLE_TEXTS[sampleLang].base)}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer outline-none ${
            baseText === SAMPLE_TEXTS[sampleLang].base
              ? "bg-white/[0.14] text-white"
              : "text-[#71717A] hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          มีรูบี้
        </button>
        <button
          type="button"
          onClick={() => setBaseText(SAMPLE_TEXTS[sampleLang].long)}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer outline-none ${
            baseText === SAMPLE_TEXTS[sampleLang].long
              ? "bg-white/[0.14] text-white"
              : "text-[#71717A] hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          ตัดสองบรรทัด
        </button>
        <button
          type="button"
          onClick={() => setBaseText(SAMPLE_TEXTS[sampleLang].short)}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer outline-none ${
            baseText === SAMPLE_TEXTS[sampleLang].short
              ? "bg-white/[0.14] text-white"
              : "text-[#71717A] hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          บรรทัดเดียว
        </button>
      </div>

      {enableRuby && (
        <input
          type="text"
          value={rubyText}
          onChange={(e) => setRubyText(e.target.value)}
          placeholder="คำอ่านรูบี้ เช่น Xuanqing หรือ ซวนชิง"
          className="w-full h-8 px-3 rounded-xl bg-white/[0.04] text-xs text-white placeholder-[#737373] border-none outline-none focus:ring-1 focus:ring-white/20 transition-all"
        />
      )}

      <input
        type="text"
        value={baseText}
        onChange={(e) => setBaseText(e.target.value)}
        placeholder="ข้อความบทสนทนาหลัก..."
        className="w-full h-9 px-3 rounded-xl bg-white/[0.04] text-xs text-white placeholder-[#737373] border-none outline-none focus:ring-1 focus:ring-white/20 transition-all font-medium"
      />
    </div>
  );
};
