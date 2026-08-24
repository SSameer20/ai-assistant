import React, { useState, useEffect } from "react";

interface SystemAudioRecorderProps {
  className?: string;
}

interface AudioDevice {
  name: string;
  id: string;
  type: "render" | "capture";
  isDefault: boolean;
}

export const SystemAudioRecorder: React.FC<SystemAudioRecorderProps> = ({ className = "" }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [outputPath, setOutputPath] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [platform, setPlatform] = useState<string>("");

  useEffect(() => {
    // Get platform information
    if (window.systemAudio?.getPlatform) {
      setPlatform(window.systemAudio.getPlatform());
    }

    // Load available audio devices on component mount
    loadAudioDevices();

    // Update status every second when recording
    let interval: number;
    if (isRecording) {
      interval = setInterval(updateStatus, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const loadAudioDevices = async (forceRefresh = false) => {
    try {
      const result = await window.systemAudio.listDevices(forceRefresh);
      if (result.success && result.devices) {
        setDevices(
          (result.devices as AudioDevice[]).filter((device) => device.type === "render"),
        ); // Only show output devices
      } else if (result.error) {
        console.warn("Failed to load audio devices:", result.error);
        setError(`Device detection failed: ${result.error}`);
      }
    } catch (err) {
      console.warn("Failed to load audio devices:", err);
      setError("Could not detect audio devices. Please check your audio drivers.");
    }
  };

  const updateStatus = async () => {
    try {
      const status = await window.systemAudio.getStatus();
      setIsRecording(status.isRecording);
      setRecordingDuration(Math.floor(status.duration / 1000));
      setOutputPath(status.outputPath);
    } catch (err) {
      console.error("Failed to get recording status:", err);
    }
  };

  const startRecording = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await window.systemAudio.startRecording({ quality });

      if (result.success) {
        setIsRecording(true);
        setOutputPath(result.outputPath || "");
        setRecordingDuration(0);
      } else {
        const errorMessage = result.error || "Failed to start recording";
        // Provide more helpful error messages
        if (errorMessage.includes("FFmpeg")) {
          setError(
            `Audio system error: ${errorMessage}. Please ensure audio drivers are installed.`,
          );
        } else if (errorMessage.includes("Permission")) {
          setError(`Permission denied: ${errorMessage}. Try running as administrator.`);
        } else if (errorMessage.includes("disk space")) {
          setError(`Storage error: ${errorMessage}`);
        } else if (errorMessage.includes("device")) {
          setError(`Audio device error: ${errorMessage}. Check your audio settings.`);
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unexpected error occurred";
      console.error("Recording start error:", err);
      setError(`System error: ${errorMessage}. Please try restarting the application.`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    setIsLoading(true);

    try {
      const result = await window.systemAudio.stopRecording();

      if (result.success) {
        setIsRecording(false);
      } else {
        const errorMessage = result.error || "Failed to stop recording";
        if (errorMessage.includes("timeout")) {
          setError(`Recording stop timeout: ${errorMessage}. The file may still be processing.`);
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unexpected error occurred";
      console.error("Recording stop error:", err);
      setError(`Stop error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const openOutputFolder = () => {
    if (outputPath) {
      // Extract directory from file path
      const directory = outputPath.substring(
        0,
        outputPath.lastIndexOf("\\") || outputPath.lastIndexOf("/"),
      );

      // Open the folder containing the recording file
      if (window.electron?.shell?.showItemInFolder) {
        window.electron.shell.showItemInFolder(outputPath);
      } else if (window.electron?.shell?.openPath) {
        window.electron.shell.openPath(directory);
      } else {
        // Fallback: copy path to clipboard
        navigator.clipboard
          .writeText(directory)
          .then(() => {
            alert(`Folder path copied to clipboard: ${directory}`);
          })
          .catch(() => {
            alert(`Recording saved to: ${directory}`);
          });
      }
    }
  };

  return (
    <div className={`system-audio-recorder p-4 border rounded-lg bg-white shadow-sm ${className}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">System Audio Recorder</h3>
          <div className="text-sm text-gray-500">
            {platform === "win32" || platform === "darwin" ? "🟢 Supported" : "❌ Unsupported Platform"}
          </div>
        </div>

        {/* Quality Settings */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Quality:</label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                value="standard"
                checked={quality === "standard"}
                onChange={(e) => setQuality(e.target.value as "standard" | "high")}
                disabled={isRecording || isLoading}
              />
              <span className="text-sm">Standard (44.1kHz) ~10MB/min</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                value="high"
                checked={quality === "high"}
                onChange={(e) => setQuality(e.target.value as "standard" | "high")}
                disabled={isRecording || isLoading}
              />
              <span className="text-sm">High (48kHz) ~17MB/min</span>
            </label>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || (platform !== "win32" && platform !== "darwin")}
            style={{ minWidth: 150 }}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
              }
              ${(isLoading || (platform !== "win32" && platform !== "darwin")) && "opacity-50 cursor-not-allowed"}
            `}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {isRecording ? "Stopping..." : "Starting..."}
              </div>
            ) : isRecording ? (
              "Stop Recording"
            ) : (
              "Start Recording"
            )}
          </button>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-mono text-lg">{formatDuration(recordingDuration)}</span>
            </div>
          )}
        </div>

        {/* Output Path */}
        {outputPath && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
            <span className="text-sm text-gray-600">Output:</span>
            <span className="text-sm font-mono flex-1 truncate">{outputPath}</span>
            <button
              onClick={openOutputFolder}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Open Folder
            </button>
          </div>
        )}

        {/* Audio Devices Info */}
        {devices.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800 flex items-center gap-2">
              Available Output Devices ({devices.length})
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  loadAudioDevices(true);
                }}
                className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                disabled={isLoading}
              >
                Refresh
              </button>
            </summary>
            <div className="mt-2 space-y-1">
              {devices.map((device, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <span className={device.isDefault ? "font-semibold" : ""}>{device.name}</span>
                    {device.isDefault && (
                      <span className="text-green-600 text-xs ml-1">(Default)</span>
                    )}
                    {device.id !== device.name && (
                      <div className="text-xs text-gray-500 truncate">{device.id}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Platform Info */}
        {(platform !== "win32" && platform !== "darwin") && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            <strong>Note:</strong> System audio recording is primarily optimized for Windows and macOS.
          </div>
        )}
      </div>
    </div>
  );
};
