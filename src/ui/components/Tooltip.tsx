import { type ReactNode, useRef, useState } from "react";

interface TooltipProps {
  children: ReactNode;
  text: string;
  delay?: number;
  direction?: "top" | "down";
}

export default function Tooltip({ children, text, delay = 1000, direction = "top" }: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  const handleClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  const positionClasses = direction === "top" ? "-top-full -mt-1" : "top-full mt-1";

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative inline-flex items-center"
    >
      {children}
      <span
        className={`absolute left-1/2 -translate-x-1/2 ${positionClasses} px-2 py-1 text-xs text-white bg-zinc-800 rounded transition-opacity whitespace-nowrap pointer-events-none z-50 ${showTooltip && text ? "opacity-100" : "opacity-0"
          }`}
      >
        {text}
      </span>
    </div>
  );
}
