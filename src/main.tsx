import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/class.css"; // ← add this line, anywhere among your imports

// Request persistent storage so the browser won't evict OPFS (where the DB is cached).
// Without this, mobile browsers freely evict the cache when the tab is backgrounded.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// Load the app after the startup message is visible. Import-time failures
// (including worker creation) must not leave users with an empty page.
import("./App.tsx").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}).catch((error: unknown) => {
  console.error("App startup failed", error);
  const root = document.getElementById("root")!;
  root.textContent = "Bible Search could not start. " +
    (error instanceof Error ? error.message : String(error)) +
    " Reload the page and check that the server serves the app's JavaScript files correctly.";
  root.setAttribute("role", "alert");
});
