export type TextFont = "handwritten" | "code" | "serif" | "sans-serif"

// What is put behind a note so that it reads over any page: nothing, a filled label, or an
// outline round its letters.
export type TextBackground = "none" | "label" | "outline"

export type TextStyleSettings = {
  font: TextFont
  color: string
  background: TextBackground
  /** The colour of the label, or of the outline. */
  backgroundColor: string
}

export const DEFAULT_TEXT_STYLE: TextStyleSettings = {
  font: "sans-serif",
  color: "#000000",
  background: "none",
  backgroundColor: "#ffffff",
}

export const TEXT_BACKGROUND_OPTIONS: Array<{ value: TextBackground; label: string }> = [
  { value: "none", label: "None" },
  { value: "label", label: "Label" },
  { value: "outline", label: "Outline" },
]

export const TEXT_FONT_OPTIONS: Array<{ value: TextFont; label: string }> = [
  { value: "handwritten", label: "Handwritten" },
  { value: "code", label: "Code" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-serif" },
]

const FONT_STACKS: Record<TextFont, string> = {
  handwritten:
    '"Segoe Script", "Bradley Hand", "Apple Chancery", "Snell Roundhand", "Comic Sans MS", cursive',
  code: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  serif: 'ui-serif, Georgia, "Times New Roman", "Noto Serif", serif',
  "sans-serif": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

const isTextFont = (value: unknown): value is TextFont =>
  value === "handwritten" || value === "code" || value === "serif" || value === "sans-serif"

const isTextBackground = (value: unknown): value is TextBackground =>
  value === "none" || value === "label" || value === "outline"

// Around the letters, at each of the eight points of the compass.
const OUTLINE = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]

/**
 * The styles that put a note's background behind it. They are in ems, so they grow with the
 * note, and take no room, so a note stays where it was put whichever is chosen.
 */
export const resolveTextBackdrop = (style: TextStyleSettings): Record<string, string> => {
  const backdrop = style.backgroundColor
  if (style.background === "label") {
    // A fine line and a soft shadow round it, so that a label the colour of the page under it
    // (white on white) is still seen to be one.
    return {
      backgroundColor: backdrop,
      boxShadow: `0 0 0 0.3em ${backdrop}, 0 0 0 calc(0.3em + 1px) rgba(0, 0, 0, 0.14), 0 0.15em 0.6em 0.3em rgba(0, 0, 0, 0.16)`,
      borderRadius: "0.1em",
    }
  }
  if (style.background === "outline") {
    return { textShadow: OUTLINE.map(([x, y]) => `${x * 0.07}em ${y * 0.07}em 0.02em ${backdrop}`).join(", ") }
  }
  return {}
}

export const resolveTextFontFamily = (style: TextStyleSettings) => FONT_STACKS[style.font]

export const normalizeTextStyle = (value: unknown): TextStyleSettings | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  return {
    font: isTextFont(input.font) ? input.font : DEFAULT_TEXT_STYLE.font,
    color: typeof input.color === "string" && input.color ? input.color : DEFAULT_TEXT_STYLE.color,
    background: isTextBackground(input.background) ? input.background : DEFAULT_TEXT_STYLE.background,
    backgroundColor:
      typeof input.backgroundColor === "string" && input.backgroundColor ? input.backgroundColor : DEFAULT_TEXT_STYLE.backgroundColor,
  }
}
