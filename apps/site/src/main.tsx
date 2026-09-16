import React, { lazy, Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./app";
import { loadReviewViewer } from "mesurer";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
// Demo route: UUID viewers resolve from browser-local storage until a review API exists.
const reviewId = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pathname)
  ? pathname.slice(1)
  : null;
const ReviewPage = ({ id }: { id: string }) => {
  const [html, setHtml] = useState<string | null | undefined>();
  useEffect(() => {
    void loadReviewViewer(window, id)
      .then((value) => setHtml(value ?? null))
      .catch(() => setHtml(null));
  }, [id]);
  return html === undefined ? null : (
    <iframe
      title="Mesurer review"
      srcDoc={html ?? "<h1>Review not found</h1>"}
      sandbox="allow-scripts"
      style={{ width: "100vw", height: "100vh", border: 0, display: "block" }}
    />
  );
};

const Bench = lazy(() => import("../bench/main").then(({ Bench: page }) => ({ default: page })));

if (reviewId) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ReviewPage id={reviewId} />
    </React.StrictMode>,
  );
} else if (pathname === "/bench") {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <Bench />
      </Suspense>
    </React.StrictMode>,
  );
} else {
  const app = (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  if (root.hasChildNodes()) {
    ReactDOM.hydrateRoot(root, app);
  } else {
    ReactDOM.createRoot(root).render(app);
  }
}
