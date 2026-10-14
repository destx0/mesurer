/// <reference types="vite/client" />

/** The package's npm downloads when the site was built, or null when npm could not be reached. */
declare const __MESURER_DOWNLOADS__: number | null;

interface Window {
  __MESURER_PRERENDER__?: boolean;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
