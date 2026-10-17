import React, { useState } from "react";
import { Type, Palette, Music, Languages, MoveVertical, MoveHorizontal } from "lucide-react";
import { StudioSelect } from "@/components/ui/StudioSelect";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { COLOR_PRESETS } from "../constants";

interface TypographyParametersPanelProps {
  title: string;
  fontFamilyLabel: string;
  fontSizeLabel: string;
  outlineWidthLabel: string;
  shadowDepthLabel: string;
  verticalMarginLabel: string;
  textColorLabel: string;

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
  rubySize: number;
  setRubySize: (val: number) => void;
  rubyOffsetY: number;
  setRubyOffsetY: (val: number) => void;
  rubyColor: string;
  setRubyColor: (val: string) => void;

  // Lyrics
  lyricSize: number;
  setLyricSize: (val: number) => void;
  lyricMarginX: number;
  setLyricMarginX: (val: number) => void;
  lyricMarginY: number;
  setLyricMarginY: (val: number) => void;
  lyricBilingual: boolean;
  setLyricBilingual: (val: boolean) => void;
  lyricColor: string;
  setLyricColor: (val: string) => void;
}

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
  rubySize,
  setRubySize,
  rubyOffsetY,
  setRubyOffsetY,
  rubyColor,
  setRubyColor,
  lyricSize,
  setLyricSize,
  lyricMarginX,
  setLyricMarginX,
  lyricMarginY,
  setLyricMarginY,
  lyricBilingual,
  setLyricBilingual,
  lyricColor,
  setLyricColor,
}) => {
  const [activeTab, setActiveTab] = useState<"dialogue" | "ruby" | "lyric">("dialogue");

  return (
    <div className="lg:col-span-5 p-5 rounded-2xl bg-[#141416] border border-white/[0.06] space-y-5 overflow-y-auto no-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <h3 className="text-xs font-semibold text-white flex items-center gap-2">
          <Type className="w-3.5 h-3.5 text-neutral-400" />
          <span>{title}</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-[#A1A1AA] border border-white/[0.04]">
          มาตรฐาน 1080p
        </span>
      </div>

      {/* Navigation Segmented Tabs */}
      <StudioSegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "dialogue", label: "บทสนทนา", icon: Type },
          { value: "ruby", label: "คำอ่านรูบี้", icon: Languages },
          { value: "lyric", label: "เนื้อเพลงมุมบน", icon: Music },
        ]}
        className="w-full"
      />

      {/* Tab 1: Dialogue Settings */}
      {activeTab === "dialogue" && (
        <div className="space-y-5">
          {/* Font Family Selector */}
          <StudioSelect
            label={fontFamilyLabel}
            value={subFont}
            onChange={(e) => setSubFont(e.target.value)}
            options={[
              { value: "Kanit Medium", label: "Kanit Medium มาตรฐานเกม" },
              { value: "Prompt Medium", label: "Prompt Medium ทรงเรขาคณิต" },
              { value: "Segoe UI", label: "Segoe UI คมชัดสูง" },
              { value: "Inter", label: "Inter สไตล์มินิมอล" },
              { value: "Noto Sans Thai", label: "Noto Sans Thai มาตรฐานเว็บ" },
              { value: "Tahoma", label: "Tahoma คลาสสิก" },
              { value: "Arial", label: "Arial สากล" },
            ]}
          />

          {/* Parameter 1: Font Size */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium">{fontSizeLabel}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubSize(30)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐานเกม 30px"
                >
                  30
                </button>
                <button
                  type="button"
                  onClick={() => setSubSize(38)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ขนาดกลาง 38px"
                >
                  38
                </button>
                <button
                  type="button"
                  onClick={() => setSubSize(42)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ขนาดใหญ่ 42px"
                >
                  42
                </button>
                <button
                  type="button"
                  onClick={() => setSubSize(54)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ขนาดใหญ่คมชัด 54px"
                >
                  54
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={16}
                    max={72}
                    value={subSize}
                    onChange={(e) => setSubSize(Math.max(16, Math.min(72, Number(e.target.value) || 16)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={16}
              max={72}
              step={1}
              value={subSize}
              onChange={(e) => setSubSize(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Parameter 2: Outline Width */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium">{outlineWidthLabel}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubOutline(0.0)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ไร้เส้นขอบ 0.0"
                >
                  0.0
                </button>
                <button
                  type="button"
                  onClick={() => setSubOutline(1.0)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐานเกม 1.0"
                >
                  1.0
                </button>
                <button
                  type="button"
                  onClick={() => setSubOutline(1.2)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="คมชัด 1.2"
                >
                  1.2
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={0}
                    max={6}
                    step={0.1}
                    value={subOutline}
                    onChange={(e) => setSubOutline(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.1}
              value={subOutline}
              onChange={(e) => setSubOutline(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Parameter 3: Shadow Depth */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium">{shadowDepthLabel}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubShadow(0.0)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ไร้เงา 0.0"
                >
                  0.0
                </button>
                <button
                  type="button"
                  onClick={() => setSubShadow(0.8)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="เงานุ่มนวล 0.8"
                >
                  0.8
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={0}
                    max={6}
                    step={0.1}
                    value={subShadow}
                    onChange={(e) => setSubShadow(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.1}
              value={subShadow}
              onChange={(e) => setSubShadow(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Parameter 4: Bottom Margin Offset */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-1.5">
                <MoveVertical className="w-3.5 h-3.5 text-neutral-400" />
                <span>{verticalMarginLabel}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubMarginV(30)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ชิดล่าง 30px"
                >
                  30
                </button>
                <button
                  type="button"
                  onClick={() => setSubMarginV(50)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐานเกม 50px กึ่งกลางแถบดำ"
                >
                  50
                </button>
                <button
                  type="button"
                  onClick={() => setSubMarginV(54)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="กึ่งกลางแถบดำ 54px"
                >
                  54
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={subMarginV}
                    onChange={(e) => setSubMarginV(Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={180}
              step={1}
              value={subMarginV}
              onChange={(e) => setSubMarginV(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Parameter 5: Color Palette */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-neutral-400" />
              <span>{textColorLabel}</span>
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSubColor(color.hex)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer outline-none ${
                      subColor.toLowerCase() === color.hex.toLowerCase()
                        ? "ring-2 ring-white scale-110 shadow-md"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 bg-[#1A1A1E] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                <div
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: subColor }}
                />
                <input
                  type="text"
                  value={subColor}
                  onChange={(e) => setSubColor(e.target.value)}
                  maxLength={7}
                  className="w-16 bg-transparent font-mono text-xs text-white outline-none uppercase"
                  placeholder="#FFFFFF"
                />
                <div className="relative w-4 h-4 overflow-hidden rounded cursor-pointer shrink-0">
                  <input
                    type="color"
                    value={subColor}
                    onChange={(e) => setSubColor(e.target.value)}
                    className="absolute -top-3 -left-3 w-10 h-10 cursor-pointer border-0 p-0"
                    title="เลือกสีจากจานสี"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ruby Settings - เช่น Xuanqing เหนือคำว่า นาง */}
      {activeTab === "ruby" && (
        <div className="space-y-5">
          {/* Ruby Enable Toggle */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-white flex items-center gap-2">
                <Languages className="w-3.5 h-3.5 text-neutral-400" />
                <span>เปิดแสดงคำอ่านรูบี้</span>
              </span>
              <p className="text-[11px] text-[#71717A]">
                แสดงคำอ่านลอยเหนือคำเฉพาะ เช่น Xuanqing เหนือคำว่า นาง
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

          {/* Ruby Size */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs text-[#A3A3A3] font-medium">ขนาดคำอ่านรูบี้</span>
                <p className="text-[10px] text-[#71717A]">
                  {rubySize === 0 ? "อัตโนมัติ 52% ของบทสนทนา" : "กำหนดขนาดตายตัว"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRubySize(0)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer outline-none ${
                    rubySize === 0 ? "text-white bg-white/[0.1] border border-white/20" : "text-[#71717A] hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title="อัตโนมัติสัมพันธ์ตามขนาดซับหลัก"
                >
                  อัตโนมัติ
                </button>
                <button
                  type="button"
                  onClick={() => setRubySize(20)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  20
                </button>
                <button
                  type="button"
                  onClick={() => setRubySize(24)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  24
                </button>
                <button
                  type="button"
                  onClick={() => setRubySize(28)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐาน 28px สำหรับซับ 54px"
                >
                  28
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={rubySize}
                    onChange={(e) => setRubySize(Math.max(0, Math.min(48, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={rubySize}
              onChange={(e) => setRubySize(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Ruby Vertical Elevation / Offset */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-1.5">
                  <MoveVertical className="w-3.5 h-3.5 text-neutral-400" />
                  <span>ระยะยกแนวตั้งเหนือคำหลัก</span>
                </span>
                <p className="text-[10px] text-[#71717A]">
                  ค่าบวกทำให้ลอยสูงขึ้น ค่าลบชิดคำหลักมากขึ้น
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRubyOffsetY(-4)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ชิดลงมา 4px"
                >
                  -4
                </button>
                <button
                  type="button"
                  onClick={() => setRubyOffsetY(0)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ระยะมาตรฐานเกม 0px"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setRubyOffsetY(8)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="ลอยสูงขึ้น 8px"
                >
                  +8
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={-20}
                    max={40}
                    value={rubyOffsetY}
                    onChange={(e) => setRubyOffsetY(Math.max(-20, Math.min(40, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={-20}
              max={40}
              step={1}
              value={rubyOffsetY}
              onChange={(e) => setRubyOffsetY(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Ruby Color */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-neutral-400" />
              <span>สีคำอ่านรูบี้</span>
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "เทาอ่อนมาตรฐาน", hex: "#E0E0E0" },
                  { name: "ขาวบริสุทธิ์", hex: "#FFFFFF" },
                  { name: "เหลืองทอง", hex: "#FACC15" },
                  { name: "เทาหม่น", hex: "#A1A1AA" },
                  { name: "ส้มละมุน", hex: "#FB923C" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setRubyColor(color.hex)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer outline-none ${
                      rubyColor.toLowerCase() === color.hex.toLowerCase()
                        ? "ring-2 ring-white scale-110 shadow-md"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 bg-[#1A1A1E] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                <div
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: rubyColor }}
                />
                <input
                  type="text"
                  value={rubyColor}
                  onChange={(e) => setRubyColor(e.target.value)}
                  maxLength={7}
                  className="w-16 bg-transparent font-mono text-xs text-white outline-none uppercase"
                  placeholder="#E0E0E0"
                />
                <div className="relative w-4 h-4 overflow-hidden rounded cursor-pointer shrink-0">
                  <input
                    type="color"
                    value={rubyColor}
                    onChange={(e) => setRubyColor(e.target.value)}
                    className="absolute -top-3 -left-3 w-10 h-10 cursor-pointer border-0 p-0"
                    title="เลือกสีจากจานสี"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Lyric Settings */}
      {activeTab === "lyric" && (
        <div className="space-y-5">
          {/* Bilingual Toggle */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-white flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-neutral-400" />
                <span>แสดงสองภาษาคู่คำแปลภาษาจีน</span>
              </span>
              <p className="text-[11px] text-[#71717A]">
                แสดงเนื้อร้องภาษาไทยแถวบนและคำแปลภาษาจีนแถวล่าง
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

          {/* Lyric Font Size */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs text-[#A3A3A3] font-medium">ขนาดตัวอักษรเนื้อเพลง</span>
                <p className="text-[10px] text-[#71717A]">
                  {lyricSize === 0 ? "อัตโนมัติ 85% ของบทสนทนา" : "กำหนดขนาดตายตัว"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLyricSize(0)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer outline-none ${
                    lyricSize === 0 ? "text-white bg-white/[0.1] border border-white/20" : "text-[#71717A] hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title="อัตโนมัติสัมพันธ์ตามขนาดซับหลัก"
                >
                  อัตโนมัติ
                </button>
                <button
                  type="button"
                  onClick={() => setLyricSize(34)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  34
                </button>
                <button
                  type="button"
                  onClick={() => setLyricSize(40)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  40
                </button>
                <button
                  type="button"
                  onClick={() => setLyricSize(46)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐาน 46px สำหรับซับ 54px"
                >
                  46
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={lyricSize}
                    onChange={(e) => setLyricSize(Math.max(0, Math.min(72, Number(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={72}
              step={1}
              value={lyricSize}
              onChange={(e) => setLyricSize(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Lyric Margin X (Left offset) */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-1.5">
                <MoveHorizontal className="w-3.5 h-3.5 text-neutral-400" />
                <span>ระยะห่างจากขอบซ้าย</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLyricMarginX(100)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  100
                </button>
                <button
                  type="button"
                  onClick={() => setLyricMarginX(160)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐานเกม 160px"
                >
                  160
                </button>
                <button
                  type="button"
                  onClick={() => setLyricMarginX(220)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  220
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={20}
                    max={400}
                    value={lyricMarginX}
                    onChange={(e) => setLyricMarginX(Math.max(20, Math.min(400, Number(e.target.value) || 20)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={20}
              max={400}
              step={5}
              value={lyricMarginX}
              onChange={(e) => setLyricMarginX(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Lyric Margin Y (Top offset) */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-1.5">
                <MoveVertical className="w-3.5 h-3.5 text-neutral-400" />
                <span>ระยะห่างจากขอบบน</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLyricMarginY(20)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  20
                </button>
                <button
                  type="button"
                  onClick={() => setLyricMarginY(30)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                  title="มาตรฐานเกม 30px"
                >
                  30
                </button>
                <button
                  type="button"
                  onClick={() => setLyricMarginY(50)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
                >
                  50
                </button>
                <div className="flex items-center gap-1 bg-[#1A1A1E] px-2 py-1 rounded-lg border border-white/[0.08]">
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={lyricMarginY}
                    onChange={(e) => setLyricMarginY(Math.max(10, Math.min(200, Number(e.target.value) || 10)))}
                    className="w-10 bg-transparent text-right font-mono text-xs text-white outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#71717A]">px</span>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={10}
              max={200}
              step={2}
              value={lyricMarginY}
              onChange={(e) => setLyricMarginY(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/[0.08] rounded-lg cursor-pointer"
            />
          </div>

          {/* Lyric Color */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <span className="text-xs text-[#A3A3A3] font-medium flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-neutral-400" />
              <span>สีเนื้อเพลง</span>
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: "ขาวบริสุทธิ์", hex: "#FFFFFF" },
                  { name: "เทาอ่อน", hex: "#E0E0E0" },
                  { name: "เหลืองนวล", hex: "#FEF08A" },
                  { name: "ฟ้าคราม", hex: "#93C5FD" },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setLyricColor(color.hex)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer outline-none ${
                      lyricColor.toLowerCase() === color.hex.toLowerCase()
                        ? "ring-2 ring-white scale-110 shadow-md"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 bg-[#1A1A1E] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                <div
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: lyricColor }}
                />
                <input
                  type="text"
                  value={lyricColor}
                  onChange={(e) => setLyricColor(e.target.value)}
                  maxLength={7}
                  className="w-16 bg-transparent font-mono text-xs text-white outline-none uppercase"
                  placeholder="#FFFFFF"
                />
                <div className="relative w-4 h-4 overflow-hidden rounded cursor-pointer shrink-0">
                  <input
                    type="color"
                    value={lyricColor}
                    onChange={(e) => setLyricColor(e.target.value)}
                    className="absolute -top-3 -left-3 w-10 h-10 cursor-pointer border-0 p-0"
                    title="เลือกสีจากจานสี"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
