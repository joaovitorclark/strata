import "@/index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/i18n";
import { AppGate } from "@/features/domains/AppGate";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppGate />
  </React.StrictMode>,
);
