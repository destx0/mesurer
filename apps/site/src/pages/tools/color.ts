export type Rgb = { r: number; g: number; b: number };
// Hue in degrees, the rest in percent.
export type Hsv = { h: number; s: number; v: number };
export type Hsl = { h: number; s: number; l: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const byte = (value: number) => clamp(Math.round(value), 0, 255);
const pair = (value: number) => byte(value).toString(16).padStart(2, "0");

/** `#RRGGBB`, or `#RRGGBBAA` when `alpha` (0 to 1) is given and not fully solid. */
export const rgbToHex = ({ r, g, b }: Rgb, alpha = 1) =>
  `#${pair(r)}${pair(g)}${pair(b)}${alpha < 1 ? pair(alpha * 255) : ""}`.toUpperCase();

/** The three-digit form of a hex code, when it has one. */
export const shortHex = (hex: string) => {
  const digits = hex.replace("#", "");
  if (digits.length !== 6 && digits.length !== 8) return null;
  for (let index = 0; index < digits.length; index += 2) {
    if (digits[index] !== digits[index + 1]) return null;
  }
  return `#${[...digits].filter((_, index) => index % 2 === 0).join("")}`;
};

/** Reads `#RGB`, `#RGBA`, `#RRGGBB` and `#RRGGBBAA`, with or without the `#`. */
export const parseHex = (input: string): { rgb: Rgb; alpha: number } | null => {
  const digits = input.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(digits)) return null;
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const at = (index: number) => parseInt(full.slice(index, index + 2), 16);
  return {
    rgb: { r: at(0), g: at(2), b: at(4) },
    alpha: full.length === 8 ? Math.round((at(6) / 255) * 100) / 100 : 1,
  };
};

/** The numbers in a piece of text, in order: `rgb(255, 0, 0)` gives 255, 0 and 0. */
export const numbersIn = (text: string) => (text.match(/-?\d*\.?\d+%?/g) ?? []).map((part) => ({
  value: Number.parseFloat(part),
  percent: part.endsWith("%"),
}));

/** Reads `rgb(255, 0, 0)`, `rgba(255 0 0 / 50%)`, or just `255, 0, 0`. */
export const parseRgb = (text: string): { rgb: Rgb; alpha: number } | null => {
  const parts = numbersIn(text);
  if (parts.length < 3 || parts.length > 4) return null;
  const [r, g, b] = parts.slice(0, 3).map((part) => (part.percent ? (part.value / 100) * 255 : part.value));
  if ([r, g, b].some((value) => value < 0 || value > 255)) return null;
  const a = parts[3];
  const alpha = a ? clamp(a.percent ? a.value / 100 : a.value, 0, 1) : 1;
  return { rgb: { r: byte(r), g: byte(g), b: byte(b) }, alpha };
};

export const rgbToHsv = ({ r, g, b }: Rgb): Hsv => {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? (delta / max) * 100 : 0, v: max * 100 };
};

export const hsvToRgb = ({ h, s, v }: Hsv): Rgb => {
  const saturation = s / 100;
  const value = v / 100;
  const channel = (offset: number) => {
    const k = (offset + h / 60) % 6;
    return byte((value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
};

export const hsvToHsl = ({ h, s, v }: Hsv): Hsl => {
  const l = (v / 100) * (1 - s / 200);
  const saturation = l === 0 || l === 1 ? 0 : (v / 100 - l) / Math.min(l, 1 - l);
  return { h, s: saturation * 100, l: l * 100 };
};

export const hslToHsv = ({ h, s, l }: Hsl): Hsv => {
  const lightness = l / 100;
  const v = lightness + (s / 100) * Math.min(lightness, 1 - lightness);
  return { h, s: v ? 2 * (1 - lightness / v) * 100 : 0, v: v * 100 };
};

export const rgbToHsl = (rgb: Rgb) => hsvToHsl(rgbToHsv(rgb));

export const rgbToCmyk = ({ r, g, b }: Rgb): Cmyk => {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const ink = (value: number) => ((1 - value / 255 - k) / (1 - k)) * 100;
  return { c: ink(r), m: ink(g), y: ink(b), k: k * 100 };
};

export const cmykToRgb = ({ c, m, y, k }: Cmyk): Rgb => {
  const channel = (ink: number) => byte(255 * (1 - ink / 100) * (1 - k / 100));
  return { r: channel(c), g: channel(m), b: channel(y) };
};

const round = (value: number) => Math.round(value);

export const formatRgb = ({ r, g, b }: Rgb, alpha = 1) =>
  alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;

export const formatHsl = ({ h, s, l }: Hsl, alpha = 1) =>
  alpha < 1
    ? `hsla(${round(h)}, ${round(s)}%, ${round(l)}%, ${alpha})`
    : `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;

export const formatHsv = ({ h, s, v }: Hsv) => `hsv(${round(h)}, ${round(s)}%, ${round(v)}%)`;

export const formatCmyk = ({ c, m, y, k }: Cmyk) => `cmyk(${round(c)}%, ${round(m)}%, ${round(y)}%, ${round(k)}%)`;

// How bright a colour is to the eye, as WCAG measures it.
const luminance = ({ r, g, b }: Rgb) => {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** The WCAG contrast ratio between two colours, from 1 to 21. */
export const contrast = (a: Rgb, b: Rgb) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

export const COMMON_COLORS: Array<{ name: string; hex: string }> = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#FF0000" },
  { name: "Lime", hex: "#00FF00" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Cyan", hex: "#00FFFF" },
  { name: "Magenta", hex: "#FF00FF" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gray", hex: "#808080" },
  { name: "Maroon", hex: "#800000" },
  { name: "Olive", hex: "#808000" },
  { name: "Green", hex: "#008000" },
  { name: "Purple", hex: "#800080" },
  { name: "Teal", hex: "#008080" },
  { name: "Navy", hex: "#000080" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Pink", hex: "#FFC0CB" },
];
