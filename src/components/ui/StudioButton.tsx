import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";

export interface StudioButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "icon" | "danger";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  active?: boolean;
}

export const StudioButton: React.FC<StudioButtonProps> = ({
  variant = "secondary",
  size = "md",
  children,
  className = "",
  active = false,
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: variant === "icon" ? "w-7 h-7 text-xs" : "px-2.5 py-1 text-xs gap-1.5",
    md: variant === "icon" ? "w-8 h-8 text-sm" : "px-3.5 py-1.5 text-xs gap-2",
    lg: variant === "icon" ? "w-10 h-10 text-base" : "px-4 py-2 text-sm gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-white text-[#111113] font-semibold hover:bg-white/90 active:bg-white/80 shadow-sm",
    secondary:
      "bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] text-white border border-white/[0.06] shadow-sm",
    ghost:
      "bg-transparent hover:bg-white/[0.05] active:bg-white/[0.10] text-[#A3A3A3] hover:text-white",
    icon:
      "rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-[#A3A3A3] hover:text-white border border-white/[0.04] flex items-center justify-center",
    danger:
      "bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 border border-rose-500/30",
  }[variant];

  const activeClasses = active ? "bg-white/[0.15] text-white font-semibold" : "";

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 450, damping: 32, mass: 0.8 }}
      className={`inline-flex items-center justify-center font-medium select-none cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 ${sizeClasses} ${variantClasses} ${activeClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
};
