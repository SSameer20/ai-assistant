import { useState } from "react";

export default function ToggleButton() {
  const [enabled, setEnabled] = useState(true);

  const handleToggle = async () => {
    const newState = !enabled;
    setEnabled(newState);
    await window.protection.setContentProtection(newState);
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-12 h-6 rounded-full transition-colors duration-200 
        ${enabled ? "bg-blue-700" : "bg-gray-400"}`}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full transition-transform duration-200
          ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
