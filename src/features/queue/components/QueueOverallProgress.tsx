import React from "react";

interface QueueOverallProgressProps {
  completedCount: number;
  totalCount: number;
  failedCount: number;
  overallProgress: number;
}

export const QueueOverallProgress: React.FC<QueueOverallProgressProps> = ({
  completedCount,
  totalCount,
  failedCount,
  overallProgress,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#141417] space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">
            ความคืบหน้ารวม {completedCount} จากทั้งหมด {totalCount} คลิป
          </span>
          {failedCount > 0 && (
            <span className="text-[11px] text-rose-400 font-medium">
              ล้มเหลว {failedCount} คลิป
            </span>
          )}
        </div>
        <span className="font-mono text-white/70">{overallProgress}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full bg-white transition-all duration-300 rounded-full"
          style={{ width: `${overallProgress}%` }}
        />
      </div>
    </div>
  );
};
