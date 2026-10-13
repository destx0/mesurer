export type Tool = {
  slug: string;
  name: string;
  summary: string;
};

export const TOOLS: Tool[] = [
  {
    slug: "aspect-ratio-calculator",
    name: "Aspect ratio calculator",
    summary: "Find the ratio of any size, and resize it without stretching.",
  },
  {
    slug: "color-picker",
    name: "Color picker",
    summary: "Pick a color and copy it as HEX, RGB, HSL, HSV, or CMYK.",
  },
  {
    slug: "rgb-to-hex",
    name: "RGB to HEX",
    summary: "Convert an RGB color to its HEX code.",
  },
  {
    slug: "hex-to-rgb",
    name: "HEX to RGB",
    summary: "Convert a HEX code to RGB values.",
  },
];

export const toolHref = (slug: string) => `/tools/${slug}`;
