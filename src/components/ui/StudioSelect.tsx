import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface StudioSelectOption {
  value: string;
  label: string;
}

export interface StudioSelectProps {
  id?: string;
  label?: string;
  value?: string | number;
  defaultValue?: string | number;
  options: StudioSelectOption[];
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const StudioSelect: React.FC<StudioSelectProps> = ({
  id,
  label,
  value,
  defaultValue,
  options,
  onChange,
  className = "",
  containerClassName = "",
  disabled = false,
  placeholder = "Select...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValue = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : "";
  const selectedOption = options.find((opt) => opt.value === selectedValue);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange?.({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`space-y-1 relative select-none ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-medium text-[#737373] tracking-wide">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-normal bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 transition-colors outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#737373] shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[160px] z-[100] rounded-xl bg-[#1c1c20] p-1 shadow-2xl shadow-black/80 ring-1 ring-white/[0.06] backdrop-blur-2xl max-h-56 overflow-y-auto no-scrollbar">
          {options.map((opt) => {
            const isSelected = opt.value === selectedValue;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left outline-none ${
                  isSelected
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
