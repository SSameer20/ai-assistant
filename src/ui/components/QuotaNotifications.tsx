import { useEffect } from "react";
import { useNotifications } from "../store";
import { AlertTriangle, X } from "lucide-react";

export default function QuotaNotifications() {
  const { quotaAlert, hideQuotaAlert } = useNotifications();

  // Auto-hide quota alert after 10 seconds
  useEffect(() => {
    if (quotaAlert.visible) {
      const timer = setTimeout(() => {
        hideQuotaAlert();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [quotaAlert.visible, hideQuotaAlert]);

  return (
    <>
      {/* Quota Alert Notification */}
      {quotaAlert.visible && (
        <div className="fixed top-4 right-4 z-50 bg-orange-500/90 backdrop-blur-sm border border-orange-400/50 rounded-lg p-4 text-white max-w-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-200 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Quota Warning</h4>
              <p className="text-sm text-orange-100 mt-1">{quotaAlert.message}</p>
              {quotaAlert.remainingCredits !== undefined && (
                <p className="text-xs text-orange-200 mt-1">
                  Remaining credits: {quotaAlert.remainingCredits}
                </p>
              )}
            </div>
            <button
              onClick={hideQuotaAlert}
              className="text-orange-200 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
