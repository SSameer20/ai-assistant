import React, { useEffect, useState } from "react";
import { Download, AlertCircle, CheckCircle2 } from "lucide-react";

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export const UpdateNotification: React.FC = () => {
  const [updateStatus, setUpdateStatus] = useState<
    "checking" | "available" | "downloading" | "downloaded" | "not-available" | "error" | null
  >(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Set up event listeners
    const removeCheckingListener = window.updater.onUpdateChecking(() => {
      setUpdateStatus("checking");
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 3000); // Auto-hide after 3s if checking
    });

    const removeAvailableListener = window.updater.onUpdateAvailable((info: any) => {
      setUpdateStatus("available");
      setUpdateInfo(info);
      setIsVisible(true);
    });

    const removeNotAvailableListener = window.updater.onUpdateNotAvailable(() => {
      setUpdateStatus("not-available");
      setTimeout(() => setIsVisible(false), 2000);
    });

    const removeErrorListener = window.updater.onUpdateError((_: string) => {
      setUpdateStatus("error");
      setError("Error While checking update");
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 5000);
    });

    const removeProgressListener = window.updater.onDownloadProgress(
      (progress: DownloadProgress) => {
        setUpdateStatus("downloading");
        setDownloadProgress(progress);
        setIsVisible(true);
      },
    );

    const removeDownloadedListener = window.updater.onUpdateDownloaded(() => {
      setUpdateStatus("downloaded");
      setDownloadProgress(null);
      setIsVisible(true);
    });

    // Cleanup listeners
    return () => {
      removeCheckingListener();
      removeAvailableListener();
      removeNotAvailableListener();
      removeErrorListener();
      removeProgressListener();
      removeDownloadedListener();
    };
  }, []);

  const handleDownload = async () => {
    try {
      setUpdateStatus("downloading");
      await window.updater.downloadUpdate();
    } catch (err) {
      setError("Failed to download update");
      setUpdateStatus("error");
    }
  };

  const handleInstall = async () => {
    try {
      await window.updater.installUpdate();
    } catch (err) {
      setError("Failed to install update");
      setUpdateStatus("error");
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateStatus) {
    return null;
  }

  const getIcon = () => {
    switch (updateStatus) {
      case "checking":
        return (
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        );
      case "available":
        return <Download className="w-4 h-4 text-blue-600" />;
      case "downloading":
        return <Download className="w-4 h-4 text-blue-600 animate-pulse" />;
      case "downloaded":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getMessage = () => {
    switch (updateStatus) {
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Update ${updateInfo?.version || "available"}`;
      case "downloading":
        return `Downloading update... ${downloadProgress?.percent.toFixed(1) || 0}%`;
      case "downloaded":
        return "Update ready to install";
      case "not-available":
        return "You have the latest version";
      case "error":
        return `Update error: ${error}`;
      default:
        return "";
    }
  };

  const getActions = () => {
    switch (updateStatus) {
      case "available":
        return (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Download
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
            >
              Later
            </button>
          </div>
        );
      case "downloaded":
        return (
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Restart & Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
            >
              Later
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          >
            Dismiss
          </button>
        );
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
      <div className="flex items-center gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{getMessage()}</p>
          {downloadProgress && updateStatus === "downloading" && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB /{" "}
                {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
        </div>
      </div>
      {(updateStatus === "available" ||
        updateStatus === "downloaded" ||
        updateStatus === "error") && <div className="mt-3 flex justify-end">{getActions()}</div>}
    </div>
  );
};
