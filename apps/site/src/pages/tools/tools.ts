export type Tool = {
  slug: string;
  name: string;
  summary: string;
};

export const TOOLS: Tool[] = [
  {
    slug: "aspect-ratio-calculator",
    name: "Aspect ratio calculator",
    summary: "Find a ratio and resize without stretching.",
  },
  {
    slug: "color-picker",
    name: "Color picker",
    summary: "Pick a color and copy its code.",
  },
  {
    slug: "rgb-to-hex",
    name: "RGB to HEX",
    summary: "RGB values to a HEX code.",
  },
  {
    slug: "hex-to-rgb",
    name: "HEX to RGB",
    summary: "A HEX code to RGB values.",
  },
  {
    slug: "webp-to-png",
    name: "WebP to PNG",
    summary: "WebP images to PNG, in your browser.",
  },
  {
    slug: "svg-to-png",
    name: "SVG to PNG",
    summary: "SVG files to PNG, at any scale.",
  },
  {
    slug: "px-to-rem",
    name: "PX to REM",
    summary: "Pixels to rem for CSS.",
  },
  {
    slug: "rem-to-px",
    name: "REM to PX",
    summary: "rem to pixels for CSS.",
  },
];

export const toolHref = (slug: string) => `/tools/${slug}`;
