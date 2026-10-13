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
    slug: "random-color-palette-generator",
    name: "Color palette generator",
    summary: "Random palettes of five colors that go together.",
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
    slug: "svg-to-jpg",
    name: "SVG to JPG",
    summary: "SVG files to JPG, at any scale.",
  },
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    summary: "PNG images to JPG, in your browser.",
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    summary: "JPG images to PNG, in your browser.",
  },
  {
    slug: "image-to-svg",
    name: "Image to SVG",
    summary: "Trace a logo or icon into SVG paths.",
  },
  {
    slug: "heic-to-jpg",
    name: "HEIC to JPG",
    summary: "iPhone photos to JPG, in your browser.",
  },
  {
    slug: "avif-to-png",
    name: "AVIF to PNG",
    summary: "AVIF images to PNG, in your browser.",
  },
  {
    slug: "jpeg-to-jpg",
    name: "JPEG to JPG",
    summary: ".jpeg files to .jpg, with no quality lost.",
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
