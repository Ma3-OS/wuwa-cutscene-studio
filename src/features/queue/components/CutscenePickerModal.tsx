import React from "react";
import { Layers, X, Search, Check } from "lucide-react";
import { StudioButton } from "@/components/ui/StudioButton";
import { ProcessedVideoItem } from "@/features/catalog/stores/useCatalogStore";
import { useApp } from "@/context/AppContext";

interface CutscenePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickerSearch: string;
  setPickerSearch: (val: string) => void;
  pickerSelected: Set<string>;
  setPickerSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  filteredCatalog: ProcessedVideoItem[];
  onConfirmAdd: () => void;
}

export const CutscenePickerModal: React.FC<CutscenePickerModalProps> = ({
  isOpen,
  onClose,
  pickerSearch,
  setPickerSearch,
  pickerSelected,
  setPickerSelected,
  filteredCatalog,
  onConfirmAdd,
}) => {
  const { t } = useApp();

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-2xl bg-[#141417] text-white rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white/60" />
            <h3 className="text-sm font-semibold text-white">
              {t("pickerTitle")}
            </h3>
            <span className="text-xs text-white/40 font-mono">
              {t("pickerSelectedBadge")} {pickerSelected.size} {t("queueClipsUnit")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Search Bar */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder={t("pickerSearchPlaceholder")}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] text-xs text-white placeholder-white/30 focus:outline-none focus:bg-white/[0.08]"
            />
          </div>
          <StudioButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (pickerSelected.size === filteredCatalog.length) {
                setPickerSelected(new Set());
              } else {
                setPickerSelected(new Set(filteredCatalog.map((x) => x.cgFile || x.fullPath)));
              }
            }}
          >
            <span>{pickerSelected.size === filteredCatalog.length ? t("pickerDeselectAll") : t("pickerSelectAll")}</span>
          </StudioButton>
        </div>

        {/* Modal List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[300px]">
          {filteredCatalog.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-white/30">
              {t("pickerNotFound")}
            </div>
          ) : (
            filteredCatalog.map((item) => {
              const key = item.cgFile || item.fullPath;
              const isChecked = pickerSelected.has(key);

              return (
                <div
                  key={key}
                  onClick={() => {
                    setPickerSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isChecked ? "bg-white/[0.08]" : "bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        isChecked
                          ? "bg-white border-white text-black"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {item.fileName}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono">
                        {item.folderName || t("pickerCategoryGeneral")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.01]">
          <span className="text-xs text-white/40">
            {t("pickerSelectedBadge")} {pickerSelected.size} {t("queueClipsUnit")}
          </span>
          <div className="flex items-center gap-2">
            <StudioButton variant="ghost" size="sm" onClick={onClose}>
              <span>{t("pickerCancelBtn")}</span>
            </StudioButton>
            <StudioButton
              variant="primary"
              size="sm"
              disabled={pickerSelected.size === 0}
              onClick={onConfirmAdd}
            >
              <span>{t("pickerAddBtn")} {pickerSelected.size} {t("queueClipsUnit")}</span>
            </StudioButton>
          </div>
        </div>
      </div>
    </div>
  );
};
