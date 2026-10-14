import { lazy, Suspense, useEffect } from "react";
import { useClientPath } from "./use-client-path";
import { TOOLS, toolHref } from "./pages/tools/tools";

const routeLoaders = {
  marketing: () => import("./pages/marketing/route"),
  changelog: () => import("./pages/changelog"),
  privacy: () => import("./pages/privacy"),
  terms: () => import("./pages/terms"),
  docs: () => import("./pages/docs"),
  tools: () => import("./pages/tools"),
} as const;
const MarketingPage = lazy(routeLoaders.marketing);
const ChangelogPage = lazy(routeLoaders.changelog);
const PrivacyPage = lazy(routeLoaders.privacy);
const TermsPage = lazy(routeLoaders.terms);
const DocsPage = lazy(routeLoaders.docs);
const ToolsPage = lazy(routeLoaders.tools);
const OldPage = lazy(() => import("./pages/old"));
const NotFoundPage = lazy(() => import("./pages/not-found"));

const PAGES = new Set(["/", "/changelog", "/privacy", "/terms", "/docs", "/docs/props", "/docs/shortcuts", "/tools", "/old"]);

/** Whether the site has a page at this address. Any other one shows the not-found page. */
export const isPage = (path: string) => PAGES.has(path) || TOOLS.some((tool) => toolHref(tool.slug) === path);

const prefetchRoute = (pathname: string) => {
  if (pathname === "/") return routeLoaders.marketing();
  if (pathname === "/changelog") return routeLoaders.changelog();
  if (pathname === "/privacy") return routeLoaders.privacy();
  if (pathname === "/terms") return routeLoaders.terms();
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return routeLoaders.docs();
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return routeLoaders.tools();
  return null;
};

function RoutePrefetcher() {
  useEffect(() => {
    if (window.__MESURER_PRERENDER__) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    if (import.meta.env.DEV) {
      void Promise.all(Object.values(routeLoaders).map((load) => load()));
      return;
    }
    const preloadOnIntent = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin) void prefetchRoute(url.pathname);
    };
    document.addEventListener("pointerover", preloadOnIntent, { passive: true });
    document.addEventListener("focusin", preloadOnIntent);
    return () => {
      document.removeEventListener("pointerover", preloadOnIntent);
      document.removeEventListener("focusin", preloadOnIntent);
    };
  }, []);
  return null;
}

function Analytics() {
  useEffect(() => {
    if (window.__MESURER_PRERENDER__) return;
    const add = () => {
      if (document.querySelector('script[src="https://assets.onedollarstats.com/stonks.js"]')) return;
      const script = document.createElement("script");
      script.src = "https://assets.onedollarstats.com/stonks.js";
      script.defer = true;
      document.head.appendChild(script);
    };
    const options: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", add, options);
    window.addEventListener("keydown", add, options);
    return () => {
      window.removeEventListener("pointerdown", add, options);
      window.removeEventListener("keydown", add, options);
    };
  }, []);
  return null;
}

export function App() {
  const path = useClientPath();
  const found = isPage(path);
  const canonical = `https://mesurer.dev${path === "/" ? "" : path}`;
  const page =
    !found ? (
      <NotFoundPage />
    ) : path === "/changelog" ? (
      <ChangelogPage />
    ) : path === "/privacy" ? (
      <PrivacyPage />
    ) : path === "/terms" ? (
      <TermsPage />
    ) : path === "/docs" || path.startsWith("/docs/") ? (
      <DocsPage />
    ) : path === "/tools" || path.startsWith("/tools/") ? (
      <ToolsPage path={path} />
    ) : path === "/old" ? (
      <OldPage />
    ) : (
      <MarketingPage />
    );

  return (
    <>
      {found ? (
        <>
          <link rel="canonical" href={canonical} />
          <meta property="og:url" content={canonical} />
        </>
      ) : null}
      <Analytics />
      <RoutePrefetcher />
      <Suspense fallback={null}>{page}</Suspense>
    </>
  );
}
