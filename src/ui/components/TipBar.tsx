import { Grip, Minimize2, Sparkles, X } from "lucide-react";
import Tooltip from "./Tooltip";
import { useAskState } from "../store";
import logo from "../../../assets/logo.png";
import { useNavigate, useLocation } from "react-router-dom";

export default function TipBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const handleQuit = () => {
    if (window.app) {
      window.app.quit();
    }
  };
  const { isAskMode, setAskMode } = useAskState();

  const handleHomeClick = () => {
    // Already on home — nothing to do
    if (location.pathname === "/") return;

    setAskMode(true);   // ensure Ask/Mic/Send panel is visible
    navigate("/", { replace: true }); // replace so Settings doesn't linger in history

    // After the Home component mounts, re-fit the Electron window
    setTimeout(() => {
      window.size.fitToContent();
    }, 50);
  };

  return (
    <div className="flex gap-5 justify-center items-center">
      <div className="min-w-80 px-2 py-2 bg-zinc-900/65 backdrop-blur-xl border border-white/15 rounded-4xl text-white flex gap-4 items-center justify-around">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleHomeClick}>
          <img src={logo} alt="Clever AI" className="w-6 h-6" />
          <span className="font-semibold tracking-tight">Clever AI</span>
        </div>
        {isAskMode ? (
          <div
            className="flex gap-1 text-blue-800 bg-white px-2 py-1 rounded-2xl justify-center items-center cursor-pointer min-w-30 gap-2"
            onClick={() => setAskMode(false)}
          >
            <Minimize2 size={16} fill="white" /> Hide
          </div>
        ) : (
          <div
            className="flex gap-1 bg-blue-800 text-white px-2 py-1 rounded-2xl justify-center items-center cursor-pointer min-w-30 gap-2"
            onClick={() => setAskMode(true)}
          >
            <Sparkles size={16} fill="white" /> Ask
          </div>
        )}
        {/* <span className="text-xl opacity-40">Hold and Drag</span> */}
        <Tooltip text="Settings" direction="down">
          <Grip size={16} className="opacity-40 drag-item" />
        </Tooltip>
      </div>

      {/* Outer App Exit Button */}
      <Tooltip text="Exit" direction="down">
        <button
          onClick={handleQuit}
          className="bg-white/15 border-white/60 p-2.5 rounded-full hover:bg-red-500/20 transition-colors opacity-20 hover:opacity-100"
        >
          <X className="text-white" size={16} />
        </button>
      </Tooltip>
    </div>
  );
}
