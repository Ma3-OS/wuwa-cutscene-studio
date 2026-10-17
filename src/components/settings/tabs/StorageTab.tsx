import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { StudioButton } from "../../ui/StudioButton";
import { StorageStatsDto } from "../../../core/ipc";

interface StorageTabProps {
  storageStats: StorageStatsDto | null;
  cacheSize: number;
  isCheckingDeps: boolean;
  isClearingCache: boolean;
  onRefreshStorage: () => void;
  onClearCache: () => void;
  formatBytes: (bytes: number) => string;
  t: (key: any) => string;
}

export const StorageTab: React.FC<StorageTabProps> = ({
  storageStats,
  cacheSize,
  isCheckingDeps,
  isClearingCache,
  onRefreshStorage,
  onClearCache,
  formatBytes,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-white">
          {t("secStorageTitle")}
        </h3>
        <p className="text-[11px] text-[#737373] mt-0.5">
          {t("cacheExplanation")}
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-white/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#737373] uppercase tracking-wider font-medium">
              พื้นที่รวมที่ใช้งานในโปรเจกต์
            </div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {storageStats?.total_formatted || formatBytes(cacheSize)}
            </div>
          </div>
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={onRefreshStorage}
            disabled={isCheckingDeps}
          >
            <RefreshCw
              className={`w-3 h-3 ${isCheckingDeps ? "animate-spin" : ""}`}
            />
            <span>{t("btnRefresh")}</span>
          </StudioButton>
        </div>

        {/* Storage Breakdown Cards */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-[10px] text-[#71717A]">แคชชั่วคราว</div>
            <div className="text-xs font-mono font-medium text-white">
              {storageStats?.cache_formatted || formatBytes(cacheSize)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-[10px] text-[#71717A]">โฟลเดอร์สกัด</div>
            <div className="text-xs font-mono font-medium text-white">
              {storageStats?.export_formatted || "0 MB"}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.03] space-y-1">
            <div className="text-[10px] text-[#71717A]">โฟลเดอร์เรนเดอร์</div>
            <div className="text-xs font-mono font-medium text-white">
              {storageStats?.render_formatted || "0 MB"}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.04]">
          <StudioButton
            variant="danger"
            size="sm"
            className="w-full text-xs"
            onClick={onClearCache}
            disabled={isClearingCache}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้างแคชชั่วคราวเพื่อประหยัดพื้นที่</span>
          </StudioButton>
        </div>
      </div>
    </div>
  );
};
