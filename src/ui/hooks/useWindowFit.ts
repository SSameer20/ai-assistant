import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Debounced window fitting hook to prevent excessive resize calls
 * @param dependencies - Array of dependencies to watch for changes (optional)
 * @param delay - Debounce delay in milliseconds (default: 150ms)
 */
export const useDebouncedWindowFit = (dependencies: any[] = [], delay: number = 150) => {
  const timeoutRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      window.size?.fitToContent();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, dependencies);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
};

/**
 * Layout monitoring hook to detect overflow issues
 */
export const useLayoutMonitor = () => {
  useEffect(() => {
    const checkOverflow = () => {
      const container = document.querySelector("[data-main-container]") || document.body;
      if (container && container.scrollWidth > container.clientWidth) {
        console.warn("Horizontal overflow detected", {
          scrollWidth: container.scrollWidth,
          clientWidth: container.clientWidth,
          element: container,
        });
      }
    };

    const observer = new ResizeObserver(checkOverflow);
    const container = document.querySelector("[data-main-container]") || document.body;
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, []);
};

/**
 * Get optimal window size based on content type
 */
export const getOptimalWindowSize = (contentType: "text" | "code" | "mixed") => {
  switch (contentType) {
    case "code":
      return { minWidth: 600, maxWidth: "80vw", minHeight: 300 };
    case "text":
      return { minWidth: 400, maxWidth: "60vw", minHeight: 200 };
    case "mixed":
      return { minWidth: 500, maxWidth: "70vw", minHeight: 250 };
    default:
      return { minWidth: 400, maxWidth: "70vw", minHeight: 200 };
  }
};
