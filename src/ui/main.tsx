import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import TipBar from "./components/TipBar";
import { GlobalStateProvider, useAskState } from "./store";
import { useLayoutEffect } from "react";
import { cn } from "./lib/utils";
export const MainComponent = () => {
  const { isAskMode } = useAskState();

  useLayoutEffect(() => {
    // Fit window to content whenever any component state changes
    window.size.fitToContent();
  }, [isAskMode]);

  return (
    <div className="h-screen flex flex-col items-center overflow-hidden" data-main-container>
      {/* Fixed TipBar at top */}
      <div className="shrink-0 flex justify-center items-start pt-2 w-full">
        <TipBar />
      </div>
      {/* Scrollable content area is now managed internally by Home/App */}
      <div className={cn("flex-1 min-h-0 w-full flex justify-center items-start overflow-hidden")}>
        <div className="w-full h-full max-w-7xl px-4 pb-4 flex flex-col items-center">
          <App />
        </div>
      </div>
    </div>
  );
};
createRoot(document.getElementById("root")!).render(
  <GlobalStateProvider>
    <HashRouter>
      <MainComponent />
    </HashRouter>
  </GlobalStateProvider>,
);
