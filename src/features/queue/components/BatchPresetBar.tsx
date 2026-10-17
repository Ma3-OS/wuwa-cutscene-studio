import React from "react";
import { StudioButton } from "@/components/ui/StudioButton";
import { StudioSegmentedControl } from "@/components/ui/StudioSegmentedControl";
import { StudioSelect } from "@/components/ui/StudioSelect";

interface BatchPresetBarProps {
  batchGender: "Girl" | "Boy";
  setBatchGender: (val: "Girl" | "Boy") => void;
  batchLocale: string;
  setBatchLocale: (val: string) => void;
  batchSubMode: "Hard-sub" | "Soft-sub" | "None";
  setBatchSubMode: (val: "Hard-sub" | "Soft-sub" | "None") => void;
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
  batchResolution,
  setBatchResolution,
  autoAction,
  setAutoAction,
  onApplyPresets,
}) => {
  return (
    <div className="p-3.5 rounded-2xl bg-[#141417] flex items-center justify-between gap-3 text-xs overflow-x-auto no-scrollbar border border-white/[0.04]">
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider shrink-0 mr-1">
          พรีเซ็ตส่วนกลาง
        </span>

        {/* Protagonist */}
        <div className="w-36 shrink-0">
          <StudioSegmentedControl<"Girl" | "Boy">
            size="sm"
            value={batchGender}
            onChange={setBatchGender}
            options={[
              { value: "Girl", label: "โรเวอร์หญิง" },
              { value: "Boy", label: "โรเวอร์ชาย" },
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
              { value: "Hard-sub", label: "ฝังซับลงภาพ" },
              { value: "Soft-sub", label: "ซับแยก" },
              { value: "None", label: "ไม่มีซับ" },
            ]}
          />
        </div>

        {/* Resolution */}
        <div className="w-40 shrink-0">
          <StudioSelect
            value={batchResolution}
            onChange={(e) => setBatchResolution(e.target.value)}
            options={[
              { value: "1920x1080", label: "16:9 แถบดำภาพยนตร์" },
              { value: "1920x1080_zoom", label: "16:9 ซูมเต็มจอ ไร้แถบดำ" },
              { value: "original", label: "21:9 ต้นฉบับเกม" },
              { value: "1080x1920", label: "9:16 แนวตั้ง Shorts" },
              { value: "2560x1440", label: "2560x1440 2K" },
              { value: "3840x2160", label: "3840x2160 4K" },
            ]}
          />
        </div>

        {/* Auto Action */}
        <div className="w-52 shrink-0">
          <StudioSelect
            value={autoAction}
            onChange={(e) => setAutoAction(e.target.value as any)}
            options={[
              { value: "none", label: "เมื่อเสร็จ ไม่มีการกระทำ" },
              { value: "chime", label: "เมื่อเสร็จ ส่งเสียงแจ้งเตือน" },
              { value: "folder", label: "เมื่อเสร็จ เปิดโฟลเดอร์ผลลัพธ์" },
              { value: "sleep", label: "เมื่อเสร็จ พักเครื่องคอม" },
              { value: "shutdown", label: "เมื่อเสร็จ ปิดเครื่องคอม" },
            ]}
          />
        </div>
      </div>

      <StudioButton variant="secondary" size="sm" onClick={onApplyPresets} className="shrink-0 whitespace-nowrap ml-2">
        <span>ปรับใช้กับทุกคลิปในคิว</span>
      </StudioButton>
    </div>
  );
};
