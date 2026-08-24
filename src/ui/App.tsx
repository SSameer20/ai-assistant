import { Routes, Route, useNavigate } from "react-router-dom";
import Home from "./components/Home";
import Settings from "./components/Settings";
import { UpdateNotification } from "./components/UpdateNotification";
import { useEffect } from "react";

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
