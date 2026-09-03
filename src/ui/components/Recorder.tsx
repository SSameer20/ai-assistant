import "../styles/recorder.css";
import { useEffect, useState, useRef, useCallback } from "react";
import { Mic, Square } from "lucide-react";
import { useAppState, useDispatch } from "../store";
import Tooltip from "./Tooltip";


/**
 * Recorder component — system audio capture toggle.
 * Uses window.systemAudio APIs (macOS + Windows) for cross-platform recording.
 * Shows pulsing red dot + duration when recording, loading state, and inline errors.
 */
export default function Recorder({ disabled = false }: { disabled?: boolean }) {
  const [isRecording, setIsRecording] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [_, setError] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Format seconds → MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Clear error after 5 seconds
  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(""), 5000);
  }, []);

  // Start duration timer
  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // Stop duration timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const { shouldStopRecording } = useAppState();
  const dispatch = useDispatch();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [stopTimer]);

  // Listen for external stop request
  useEffect(() => {
    if (shouldStopRecording && isRecording) {
      handleToggle(); // Toggle off
      dispatch({ type: "RECORDING_STOPPED_ACK" });
    }
  }, [shouldStopRecording, isRecording]);

  // Deliberately NOT pre-initialising on mount: acquiring the loopback stream raises the
  // OS "sharing" indicator. Capture starts only when the button is clicked.

  const handleToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      if (!isRecording) {
        // Start recording
        const result = await window.systemAudio.startRecording();
        if (result.success) {
          setIsRecording(true);
          startTimer();
          console.log("Recording started:", result.outputPath);
        } else {
          showError(result.error || "Failed to start recording");
        }
      } else {
        // Stop recording
        const result = await window.systemAudio.stopRecording();
        if (result.success) {
          setIsRecording(false);
          stopTimer();
          console.log("Recording stopped");
        } else {
          showError(result.error || "Failed to stop recording");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      console.error("Recorder error:", err);
      showError(msg);
      // Reset state on error
      setIsRecording(false);
      stopTimer();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Tooltip text={disabled ? "audio credits exhausted" : isRecording ? "" : "Record system audio"}>
        <button
          className={`flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10 justify-center px-2 py-1 rounded-sm transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          onClick={disabled ? undefined : handleToggle}
          disabled={disabled || isLoading}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isLoading ? (
            <div className="w-[22px] h-[22px] border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
          ) : isRecording ? (
            <>
              {/* Pulsing red dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="mic-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-xs font-mono text-white/80">{formatDuration(duration)}</span>
              <Square size={18} className="text-red-400 hover:text-red-300" fill="currentColor" />
            </>
          ) : (
            <Mic size={22} />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
