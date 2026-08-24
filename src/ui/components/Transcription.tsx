import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";


interface TranscriptionProps {
  onAnswer?: (text: string) => void;
}

/**
 * Transcription component — displays real-time transcribed text
 * received from the server via system:audio:chunk WebSocket events.
 */
export default function Transcription({ onAnswer }: TranscriptionProps) {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = window.transcription.onTranscript((text: string) => {
      if (text && text.trim()) {
        setLines((prev) => [...prev, text.trim()]);
      }
    });

    return () => cleanup();
  }, []);

  const triggerAnswer = () => {
    if (lines.length <= 1) return;
    const text = lines.join(" ");

    if (onAnswer) {
      onAnswer(text);
    } else {
      window.transcription.sendAudioMessage(text);
    }

    setLines([]);
  };
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.scrollLeft = el.scrollWidth;
  }, [lines]);


  if (lines.length === 0) return null;

  return (
    <div className="w-full flex gap-2 items-center">
      {
        lines.length > 1 && (
          <button
            onClick={triggerAnswer}
            className="bg-blue-800/60 hover:bg-blue-800/50 text-white px-2 py-1 rounded text-xs transition-colors"
          >
            Answer
          </button>
        )
      }
      <div
        ref={containerRef}
        className="w-full h-full overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2 px-2 mask-linear-fade"
        style={{ scrollbarWidth: "none" }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className={`text-sm px-1 rounded-sm ${i === lines.length - 1
              ? "text-white/90 font-medium bg-white/10"
              : "text-white/50 bg-white/20"
              }`}
          >
            {line}
          </span>
        ))}
      </div>
      <button onClick={() => setLines([])} className="text-white/50 hover:text-white transition-colors">
        <X size={18} />
      </button>
    </div >
  );
}
