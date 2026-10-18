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
  const sizeClasses = size === "sm" ? "p-0.5 text-xs h-7" : "p-1 text-xs h-8";

  return (
    <div
      className={`inline-flex items-center rounded-lg bg-white/[0.04] select-none ${sizeClasses} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1 font-medium transition-colors cursor-pointer rounded-md outline-none text-xs ${
              isSelected ? "text-white" : "text-[#737373] hover:text-[#A3A3A3]"
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-active-${options.map((o) => o.value).join("-")}`}
                className="absolute inset-0 rounded-md bg-neutral-800 shadow-sm border border-white/10"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5 truncate">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
