import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InteractiveMode from "./InteractiveMode";
import Tooltip from "./Tooltip";
import Screenshot from "./Screenshot";
import { useScreenshotState } from "@/store";
import { useRef } from "react";

export default function Navigation({ send, disabled = false }: { send?: (image: string) => void; disabled?: boolean }) {
  const navigate = useNavigate();
  const processedImageRef = useRef<string | null>(null);

  const handleSettingsClick = () => {
    navigate("/settings");   // direct React Router nav — no IPC round-trip needed
  };
  const { image, isCapturing, startCapture, completeCapture, reset } = useScreenshotState();

  return (
    <div className="flex items-center justify-between w-[600px] h-14 px-4 bg-zinc-900/65 backdrop-blur-2xl border border-white/15 rounded-2xl text-white">
      {/* <div className="text-sm font-medium text-zinc-400">No API</div> */}
      <Tooltip text={disabled ? "Image credits exhausted" : "Screenshot"}>
        <div className={disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}>
          <Screenshot
            image={image}
            loading={isCapturing}
            capture={async () => {
              if (disabled) return "";
              try {
                startCapture();
                const capturedImage = await window.screenAPI.capture();
                completeCapture(capturedImage);
                send?.(capturedImage);
                return capturedImage;
              } catch (error) {
                console.error("Screenshot failed:", error);
                reset();
                throw error;
              }
            }}
            reset={() => {
              reset();
              processedImageRef.current = null;
            }}
          />
        </div>
      </Tooltip>

      {/* Infos */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm text-[#ddd]">
          <span>Exit App</span>
          <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 font-inherit text-xs min-w-5 text-center">
            ⌘
          </kbd>
          <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 font-inherit text-xs min-w-5 text-center">
            x
          </kbd>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#ddd]">
          <span>Show/Hide</span>
          <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 font-inherit text-xs min-w-5 text-center">
            ⌘
          </kbd>
          <kbd className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 font-inherit text-xs min-w-5 text-center">
            /
          </kbd>
        </div>
      </div>

      {/* Left: Branding & Waveform */}

      <div className="flex gap-4 items-center justify-center">
        <InteractiveMode />
        <Tooltip text="Settings">
          <button
            className="rounded-md transition-colors cursor-pointer"
            onClick={handleSettingsClick}
          >
            <Settings size={18} className="text-zinc-400 hover:text-white" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
