import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Login, SetupNeeded } from "./components/Login.jsx";
import { api } from "./lib/api.js";
import "./styles.css";

function Root() {
  const [state, setState] = useState("checking");

  useEffect(() => {
    api.session()
      .then(s => setState(!s.passwordSet ? "no_password" : s.authed ? "app" : "login"))
      .catch(() => setState("login"));
  }, []);

  if (state === "checking") return null;
  if (state === "no_password") return <SetupNeeded what="password" />;
  if (state === "login") return <Login onSuccess={() => setState("app")} />;
  return <App onUnauthorized={() => setState("login")} onLogout={async () => {
    try { await api.logout(); } finally { setState("login"); }
  }} />;
}

createRoot(document.getElementById("root")).render(<Root />);
