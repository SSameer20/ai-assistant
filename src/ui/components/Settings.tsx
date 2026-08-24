import { useLayoutEffect, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "./Navigation";
import { useAuth, useAskState } from "../store";
import { LogOut, CreditCard, Crown, Eye, Mic } from "lucide-react";

type BillingCycle = "monthly" | "yearly" | "lifetime";
type AccountTypes = "free" | "pro" | "enterprise";

interface UserDetails {
  imageCredits: number | undefined;
  audioCredits: number | undefined;
  creditsRemaining: number | undefined;
  creditsUsed: number | undefined;
  period: BillingCycle | null | undefined;
  plan: AccountTypes | undefined;
  planStartedAt: Date | null | undefined;
  planExpiresAt: Date | null | undefined;
  email: string | undefined;
}

const USER_DETAILS_KEY = "qluely_user_details";

export default function Settings() {
  const { logout } = useAuth();
  const { isAskMode } = useAskState();
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(() => {
    const stored = localStorage.getItem(USER_DETAILS_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  // Fetch user details on mount
  useEffect(() => {
    async function fetchUserDetails() {
      setLoading(true);
      try {
        const details = await window.auth.getUserDetails();
        console.log(details)
        if (details) {
          setUserDetails(details);
          localStorage.setItem(USER_DETAILS_KEY, JSON.stringify(details));
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserDetails();
  }, []);

  // Always enforce content protection — screen-share hiding is permanently enabled
  useEffect(() => {
    window.protection.setContentProtection(true);
  }, []);

  useLayoutEffect(() => {
    window.size.fitToContent();
  }, [isAskMode, userDetails]);

  function handleLogout() {
    localStorage.removeItem(USER_DETAILS_KEY);
    logout();
    navigate("/login");
  }



  if (!isAskMode) return null;
  return (
    <div className="flex flex-col gap-3 p-6 bg-transparent min-w-150 items-center"
      data-main-container>
      <Navigation />

      <div className="w-full bg-zinc-900/65 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden">
        {/* ACCOUNT INFO */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <InfoRow
            icon={<Crown size={18} />}
            label="Plan"
            value={loading ? "Loading..." : userDetails?.plan || "Free"}
          />
          <InfoRow
            icon={<CreditCard size={18} />}
            label="Remaining Credits"
            value={loading ? "Loading..." : userDetails?.creditsRemaining?.toString() || "0"}
          />
          <InfoRow
            icon={<Eye size={18} />}
            label="Image Credits"
            value={loading ? "Loading..." : userDetails?.imageCredits?.toString() || "0"}
          />
          <InfoRow
            icon={<Mic size={18} />}
            label="Audio Credits"
            value={loading ? "Loading..." : userDetails?.audioCredits?.toString() || "0"}
          />


        </div>

        {/* LOGOUT */}
        <div className="border-t border-white/10 p-2 bg-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 text-red-500 font-medium hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple info row component
interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3 text-zinc-400">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    <span className="text-sm text-white font-medium">{value}</span>
  </div>
);
