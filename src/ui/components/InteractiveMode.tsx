import { Touchpad, TouchpadOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Tooltip from "./Tooltip";

export default function InteractiveMode() {
  const [enabled, setEnabled] = useState(false); // feature ON/OFF
  const [interactive, setInteractive] = useState(false); // hover driven
  const location = useLocation();

  // Listen for force-disable from keyboard shortcut
  useEffect(() => {
    const handleForceDisable = () => {
      setEnabled(false);
      setInteractive(false);
    };

    // Add event listener for the force-disable event
    const removeListener = window.overlay.onForceDisable(handleForceDisable);

    return () => {
      removeListener();
    };
  }, []);

  // Window behavior must depend ONLY on hover state
  useEffect(() => {
    if (enabled) {
      interactive ? window.overlay.disableClickThrough() : window.overlay.enableClickThrough();
    } else {
      // When disabled, always disable click-through (normal interaction mode)
      window.overlay.disableClickThrough();
    }
  }, [interactive, enabled]);

  // Reset interactive mode when changing routes
  useEffect(() => {
    setInteractive(false);
    // Optionally also disable the feature when changing routes
    // setEnabled(false);
  }, [location.pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure normal interaction when component unmounts
      window.overlay.disableClickThrough();
    };
  }, []);

  return (
    <Tooltip text="Interactive mode">
      <div
        onMouseEnter={() => enabled && setInteractive(true)}
        onMouseLeave={() => setInteractive(false)}
        className="cursor-pointer select-none flex items-center"
      >
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`flex items-center transition-opacity ${!enabled ? "opacity-60 hover:opacity-100" : ""}`}
        >
          {enabled ? (
            <TouchpadOff size={18} className="text-white hover:text-zinc-400" />
          ) : (
            <Touchpad size={18} className="text-white hover:text-zinc-400" />
          )}
        </button>
      </div>
    </Tooltip>
  );
}
