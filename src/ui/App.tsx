import { Routes, Route, useNavigate } from "react-router-dom";
import Home from "./components/Home";
import Settings from "./components/Settings";
import { UpdateNotification } from "./components/UpdateNotification";
import QuotaNotifications from "./components/QuotaNotifications";
import { useEffect } from "react";
import Login from "./components/Login";
import Onboarding from "./components/Onboarding";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = window.nav.onChange((route) => {
      console.log("Navigation received:", route);
      navigate(route);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [navigate]);

  return (
    <>
      <UpdateNotification />
      <QuotaNotifications />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
