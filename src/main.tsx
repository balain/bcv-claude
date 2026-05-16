import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "./styles/class.css"; // ← add this line, anywhere among your imports

// Request persistent storage so the browser won't evict OPFS (where the DB is cached).
// Without this, mobile browsers freely evict the cache when the tab is backgrounded.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
