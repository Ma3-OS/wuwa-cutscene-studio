import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  }>({ left: 0, width: 160 });

  const selectedValue = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : "";
  const selectedOption = options.find((opt) => opt.value === selectedValue);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < 220 && rect.top > 220;

    setMenuPosition({
      top: openUpwards ? undefined : rect.bottom + 6,
      bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8)),
      width: Math.max(rect.width, 160),
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange?.({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div className={`space-y-1 relative select-none ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-medium text-[#737373] tracking-wide">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            updatePosition();
            setIsOpen(!isOpen);
          }
        }}
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

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 9999,
            }}
            className="rounded-xl bg-[#1c1c20] p-1 shadow-2xl shadow-black/90 ring-1 ring-white/[0.08] backdrop-blur-2xl max-h-56 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-100"
          >
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
          </div>,
          document.body
        )}
    </div>
  );
};

