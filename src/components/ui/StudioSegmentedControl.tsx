import React from "react";
import { motion } from "motion/react";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface StudioSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function StudioSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  size = "md",
}: StudioSegmentedControlProps<T>) {
  const sizeClasses = size === "sm" ? "p-0.5 text-xs h-7" : "p-0.5 text-xs h-8";

  return (
    <div
      className={`inline-flex items-center rounded-lg bg-[#0d0d11] border border-white/[0.06] select-none ${sizeClasses} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1 font-medium transition-colors cursor-pointer rounded-md outline-none text-xs ${
              isSelected ? "text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-active-${options.map((o) => o.value).join("-")}`}
                className="absolute inset-0 rounded-md bg-[#25252b] shadow-sm shadow-black/40 border border-white/15"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1 truncate">
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
