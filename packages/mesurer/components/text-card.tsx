import { useState, type ReactNode } from "react"
import {
  TEXT_FONT_OPTIONS,
  textFontFamily,
  type TextBackground,
  type TextStyleSettings,
} from "../core/text-style"
import { cn } from "../core/utils"
import { ColorPicker } from "./color-picker"
import { inkOf, surface, Swatches } from "./swatches"

// The colours a note is offered in, and those of what is behind it. Any other is picked from
// the last of each.
const COLORS = ["#ef4444", "#facc15", "#22c55e", "#0d99ff", "#111827"]
const FILLS = ["#ffffff", "#111827", "#facc15"]

// The parts of a note that have a colour: its letters, and either thing that can be behind it.
const PARTS: Array<{ value: TextBackground; label: string }> = [
  { value: "none", label: "Text color" },
  { value: "label", label: "Label" },
  { value: "outline", label: "Outline" },
]

const letter = { x: 10, y: 14.5, textAnchor: "middle", fontSize: 13, fontWeight: 600 } as const

// Each part drawn on a letter: the letter alone, a label behind it, or a line round it.
const PART_SHAPES: Record<TextBackground, ReactNode> = {
  none: <text {...letter} fill="currentColor">A</text>,
  label: (
    <>
      <rect x="2.5" y="3" width="15" height="14" rx="3" fill="currentColor" opacity="0.25" />
      <text {...letter} fill="currentColor">A</text>
    </>
  ),
  outline: <text {...letter} fill="none" stroke="currentColor" strokeWidth="1">A</text>,
}

const row = "msr:flex msr:w-full msr:min-w-0 msr:items-center msr:gap-2 msr:rounded-[20px] msr:p-2"
const choice = "msr:flex msr:h-6 msr:items-center msr:justify-center msr:rounded-[8px] msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
// What is in use is the one on a plate of its own.
const plate = (chosen: boolean) => (chosen ? "msr:bg-ink-900 msr:text-surface" : "msr:text-ink-900 msr:hover:bg-ink-100")

// What the text tool writes in, opened from the tool's caret: the fonts, each written in itself,
// and under them the colours, for the note's letters or for what is behind it: a label or an
// outline, neither until a colour is picked for one. The last of the colours opens a picker
// for any colour. What is set here is what the next note is written in; a note
// already written keeps its own.
export function TextCard({
  style,
  above = false,
  onChange,
}: {
  style: TextStyleSettings
  /** The card is above the toolbar, not below it: its parts stack away from the toolbar. */
  above?: boolean
  onChange: (style: Partial<TextStyleSettings>) => void
}) {
  const [picking, setPicking] = useState(false)
  // Which part of the note the colours are for. "none" is its letters.
  const [part, setPart] = useState<TextBackground>("none")
  const backed = part === style.background
  const set = (color: string) => onChange(part === "none" ? { color } : { background: part, backgroundColor: color })

  return (
    <section
      className={cn("msr:flex msr:w-56 msr:items-center msr:gap-1 msr:text-[11px] msr:text-ink-700", above ? "msr:flex-col-reverse" : "msr:flex-col")}
      aria-label="Text"
      data-mesurer-text-card
      // A press here leaves a note being written as it is, still being written, so that what is
      // set shows on it. A field to type a colour in takes the keyboard all the same.
      onMouseDown={(event) => {
        if (!(event.target as Element).closest("input")) event.preventDefault()
      }}
    >
      <div className={cn(surface, row, "msr:gap-0.5")} role="group" aria-label="Font">
        {TEXT_FONT_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={value === style.font}
            title={label}
            className={cn(choice, "msr:flex-1 msr:text-[14px] msr:leading-none", plate(value === style.font))}
            style={{ fontFamily: textFontFamily(value) }}
            onClick={() => onChange({ font: value })}
          >
            Aa
          </button>
        ))}
      </div>

      {/* What the note is set to. On the left is which part of it the colours beside are for:
          its letters, a label behind it, or a line round it. */}
      <div className={cn(surface, row)}>
        <div className="msr:flex msr:shrink-0 msr:gap-0.5" role="group" aria-label="Part">
          {PARTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={value === part}
              title={label}
              className={cn(choice, "msr:w-6", plate(value === part))}
              onClick={() => setPart(value)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                {PART_SHAPES[value]}
              </svg>
            </button>
          ))}
        </div>
        <span className="msr:h-4 msr:w-px msr:shrink-0 msr:bg-ink-200" aria-hidden="true" />
        {part === "none" ? (
          <Swatches
            label="Color"
            colors={COLORS}
            value={inkOf(style.color).solid}
            picking={picking}
            onPick={set}
            onMore={() => setPicking((open) => !open)}
          />
        ) : (
          // A note has nothing behind it until a colour is picked for it.
          <Swatches
            label={part === "label" ? "Label color" : "Outline color"}
            colors={FILLS}
            value={backed ? inkOf(style.backgroundColor).solid : ""}
            picking={picking}
            onPick={set}
            onMore={() => setPicking((open) => !open)}
            onClear={() => onChange({ background: "none" })}
          />
        )}
      </div>

      {picking ? (
        <div className={cn(surface, "msr:w-full msr:rounded-[20px] msr:p-3")}>
          <ColorPicker key={part} value={part === "none" ? style.color : style.backgroundColor} onChange={set} />
        </div>
      ) : null}
    </section>
  )
}
