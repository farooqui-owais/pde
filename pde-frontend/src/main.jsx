import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./i18n/index.js"; // init translations before render (§5)
import { ensureCsrfToken } from "./api/axios.js";

// Prime the CSRF cookie/token at startup so the first form submit already has
// an X-CSRF-Token available (§3).
ensureCsrfToken();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
