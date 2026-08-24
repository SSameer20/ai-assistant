import React, { createContext, useContext, useReducer, useEffect } from "react";
import type { ReactNode } from "react";
import type { GlobalState, GlobalAction } from "./types";
import { globalReducer, initialState } from "./reducer";

// Context Type
interface GlobalContextType {
  state: GlobalState;
  dispatch: React.Dispatch<GlobalAction>;
}

// Create Context
const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// Provider Component
interface GlobalStateProviderProps {
  children: ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, initialState);

  // WebSocket quota event listeners
  useEffect(() => {
    let quotaAlertUnsubscribe: (() => void) | undefined;
    let quotaExhaustedUnsubscribe: (() => void) | undefined;

    if (window.quota) {
      // Listen for quota alert events
      quotaAlertUnsubscribe = window.quota.onAlert((event: any) => {
        dispatch({
          type: "NOTIFICATION_SHOW_QUOTA_ALERT",
          payload: {
            message: event.data?.message || "You are approaching your quota limit",
            remainingCredits: event.data?.remainingCredits,
          },
        });
      });

      // Listen for quota exhausted events
      quotaExhaustedUnsubscribe = window.quota.onExhausted((event: any) => {
        dispatch({
          type: "NOTIFICATION_SHOW_QUOTA_EXHAUSTED",
          payload: { message: event.data?.message || "Your quota has been exhausted" },
        });
      });
    }

    return () => {
      if (quotaAlertUnsubscribe) quotaAlertUnsubscribe();
      if (quotaExhaustedUnsubscribe) quotaExhaustedUnsubscribe();
    };
  }, [dispatch]);

  const value = { state, dispatch };

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};

// Hook to use the global context
export const useGlobalState = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error("useGlobalState must be used within a GlobalStateProvider");
  }
  return context;
};
