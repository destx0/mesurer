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
];

export const toolHref = (slug: string) => `/tools/${slug}`;
