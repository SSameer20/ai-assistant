import { useState, useEffect } from "react";
import { Mic, Monitor, Settings, AlertCircle, CheckCircle } from "lucide-react";

interface PermissionStepProps {
    onComplete: () => void;
}

type PermissionStatus = "not-determined" | "granted" | "denied" | "restricted" | "unknown";

export default function PermissionStep({ onComplete }: PermissionStepProps) {
    const [micStatus, setMicStatus] = useState<PermissionStatus>("unknown");
    const [screenStatus, setScreenStatus] = useState<PermissionStatus>("unknown");
    const [loading, setLoading] = useState(true);

    const checkPermissions = async () => {
        try {
            const mic = await window.permissions.getStatus("microphone");
            const screen = await window.permissions.getStatus("screen");
            setMicStatus(mic);
            setScreenStatus(screen);
        } catch (error) {
            console.error("Error checking permissions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkPermissions();
        // Poll for changes in case user comes back from settings
        const interval = setInterval(checkPermissions, 2000);
        return () => clearInterval(interval);
    }, []);

    const requestMic = async () => {
        const granted = await window.permissions.request("microphone");
        if (granted) {
            setMicStatus("granted");
        } else {
            setMicStatus("denied");
        }
    };

    const openSettings = (type: "microphone" | "screen") => {
        window.permissions.openSettings(type);
    };

    const isAllGranted = micStatus === "granted" && screenStatus === "granted";

    if (loading) return null;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold text-white">Permissions Required</h2>
                <p className="text-zinc-400 text-sm mt-1">
                    Clever AI needs these permissions to capture audio and screen content.
                </p>
            </div>

            <div className="space-y-4">
                {/* Microphone Permission */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Mic className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-white">Microphone</h3>
                            <p className="text-xs text-zinc-500">Required for voice interactions</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {micStatus === "granted" ? (
                            <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Granted
                            </div>
                        ) : micStatus === "denied" ? (
                            <button
                                onClick={() => openSettings("microphone")}
                                className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-white transition-colors"
                            >
                                <Settings className="w-3.5 h-3.5" />
                                Open Settings
                            </button>
                        ) : (
                            <button
                                onClick={requestMic}
                                className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition-colors"
                            >
                                Allow
                            </button>
                        )}
                    </div>
                </div>

                {/* Screen Recording Permission */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Monitor className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-white">Screen Recording</h3>
                            <p className="text-xs text-zinc-500">Required for system audio loopback</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {screenStatus === "granted" ? (
                            <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Granted
                            </div>
                        ) : (
                            <button
                                onClick={() => openSettings("screen")}
                                className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-white transition-colors"
                            >
                                <Settings className="w-3.5 h-3.5" />
                                Open Settings
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {screenStatus !== "granted" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                        Due to macOS security, you must manually enable Screen Recording in System Settings to capture system audio.
                    </p>
                </div>
            )}

            <button
                onClick={onComplete}
                disabled={!isAllGranted}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-600/20"
            >
                Continue
            </button>
        </div>
    );
}
