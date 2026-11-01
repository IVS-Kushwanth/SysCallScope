import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TraceProvider } from "./context/TraceContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TraceProvider>
        <App />
      </TraceProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
