import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { colorToHex, parseCssColor, type ColorSample } from "../core/colors"
import { cn } from "../core/utils"

// A colour as it is picked: its hue around the wheel (0 to 360), how strong and how bright it is
// (0 to 1 each), and how solid.
type Picked = { hue: number; saturation: number; value: number; alpha: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export const colorToPicked = ({ red, green, blue, alpha }: ColorSample): Picked => {
  const [r, g, b] = [red / 255, green / 255, blue / 255]
  const max = Math.max(r, g, b)
  const spread = max - Math.min(r, g, b)
  const hue = spread === 0 ? 0 : max === r ? ((g - b) / spread) % 6 : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4
  return { hue: (hue * 60 + 360) % 360, saturation: max === 0 ? 0 : spread / max, value: max, alpha }
}

export const pickedToColor = ({ hue, saturation, value, alpha }: Picked): ColorSample => {
  const channel = (offset: number) => {
    const k = (offset + hue / 60) % 6
    return (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))) * 255
  }
  return { red: channel(5), green: channel(3), blue: channel(1), alpha }
}

const BLACK: ColorSample = { red: 0, green: 0, blue: 0, alpha: 1 }

// Reads any colour the browser understands. One this file cannot read itself (an `oklch()`, a
// named colour) is handed to a canvas, which gives it back in a form it can.
const readColor = (value: string): ColorSample => {
  const parsed = parseCssColor(value)
  if (parsed || typeof document === "undefined") return parsed ?? BLACK
  const context = document.createElement("canvas").getContext("2d")
  if (!context) return BLACK
  context.fillStyle = value
  return parseCssColor(String(context.fillStyle)) ?? BLACK
}

const CHECKER = "conic-gradient(#d4d4d8 25%, #fff 0 50%, #d4d4d8 0 75%, #fff 0)"
const HUES = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"

const thumb =
  "msr:pointer-events-none msr:absolute msr:size-3.5 msr:-translate-x-1/2 msr:-translate-y-1/2 msr:rounded-full msr:border-2 msr:border-white msr:shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"

// Follows a press across a track or an area: where the pointer is in it, from 0 to 1 each way,
// for as long as it is held.
const follow = (onMove: (x: number, y: number) => void) => {
  const report = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    onMove(clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height))
  }
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.focus()
      report(event)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) report(event)
    },
  }
}

// A track with a thumb on it, moved by dragging or with the arrow keys.
function Slider({
  label,
  at,
  text,
  background,
  thumbColor,
  onChange,
}: {
  label: string
  /** Where the thumb is, from 0 to 1. */
  at: number
  /** What that is called, for whoever cannot see it. */
  text: string
  background: string
  thumbColor: string
  onChange: (at: number) => void
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
    if (!step) return
    event.preventDefault()
    event.stopPropagation()
    onChange(clamp(at + step * (event.shiftKey ? 0.1 : 0.01)))
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(at * 100)}
      aria-valuetext={text}
      className="msr:relative msr:h-3.5 msr:cursor-pointer msr:touch-none msr:rounded-full msr:outline-none msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
      style={{ background, backgroundSize: "auto, 8px 8px" }}
      onKeyDown={onKeyDown}
      {...follow((x) => onChange(x))}
    >
      {/* Kept inside the track's round ends, so the thumb never hangs off them. */}
      <span className="msr:pointer-events-none msr:absolute msr:inset-y-0 msr:left-[7px] msr:right-[7px]">
        <span className={thumb} style={{ left: `${at * 100}%`, top: "50%", backgroundColor: thumbColor }} />
      </span>
    </div>
  )
}

// Picks a colour, and with `alpha` how solid it is: an area for how strong and how bright, a
// track for the hue, one for the opacity, the colour's code to type, and any `swatches` to pick
// straight from. The colour comes in and goes out as text (`#rrggbb`, or `#rrggbbaa` when it is
// not fully solid), so it is used wherever a colour is kept as text.
export function ColorPicker({
  value,
  alpha = true,
  swatches,
  children,
  onChange,
}: {
  value: string
  /** Whether how solid the colour is can be set. Without it the colour is kept fully solid. */
  alpha?: boolean
  swatches?: readonly string[]
  /** Anything to show under the picker. */
  children?: ReactNode
  onChange: (value: string) => void
}) {
  // What is picked is kept here, not read back from the colour: grey has no hue and black no
  // strength, and reading them back would throw the thumbs to one end as they pass through.
  const [picked, setPicked] = useState<Picked | null>(null)
  const emitted = useRef<string | null>(null)
  const current =
    picked && emitted.current === value ? picked : colorToPicked(readColor(value))
  const shown = alpha ? current : { ...current, alpha: 1 }

  const pick = (next: Partial<Picked>) => {
    const merged = { ...shown, ...next }
    const text = colorToHex(pickedToColor(merged))
    emitted.current = text
    setPicked(merged)
    onChange(text)
  }
  const solid = colorToHex(pickedToColor({ ...shown, alpha: 1 }))
  const pureHue = colorToHex(pickedToColor({ hue: shown.hue, saturation: 1, value: 1, alpha: 1 }))
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="msr:flex msr:flex-col msr:gap-2" data-mesurer-color-picker>
      <div
        aria-hidden="true"
        className="msr:relative msr:h-24 msr:cursor-crosshair msr:touch-none msr:rounded-control"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})` }}
        {...follow((x, y) => pick({ saturation: x, value: 1 - y }))}
      >
        <span className={thumb} style={{ left: `${shown.saturation * 100}%`, top: `${(1 - shown.value) * 100}%`, backgroundColor: solid }} />
      </div>

      <Slider
        label="Hue"
        at={shown.hue / 360}
        text={`${Math.round(shown.hue)}°`}
        background={HUES}
        thumbColor={pureHue}
        onChange={(at) => pick({ hue: Math.min(359.9, at * 360) })}
      />

      {alpha ? (
        <Slider
          label="Opacity"
          at={shown.alpha}
          text={`${Math.round(shown.alpha * 100)}%`}
          background={`linear-gradient(to right, transparent, ${solid}), ${CHECKER}`}
          thumbColor={solid}
          onChange={(at) => pick({ alpha: Math.max(0.05, at) })}
        />
      ) : null}

      <div className="msr:flex msr:items-center msr:gap-2 msr:text-[11px] msr:text-ink-700">
        <span
          aria-hidden="true"
          className="msr:size-5 msr:shrink-0 msr:rounded-control msr:border msr:border-black/10"
          style={{ background: `linear-gradient(${value}, ${value}), ${CHECKER}`, backgroundSize: "auto, 8px 8px" }}
        />
        <input
          type="text"
          aria-label="Color code"
          spellCheck={false}
          value={draft ?? solid.toUpperCase()}
          className="msr:h-6 msr:min-w-0 msr:flex-1 msr:rounded-control msr:bg-ink-100 msr:px-1.5 msr:font-mono msr:text-[11px] msr:text-ink-900 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
          onChange={(event) => {
            const text = event.currentTarget.value
            setDraft(text)
            const typed = /^#?[\da-f]{6}$/i.test(text.trim()) ? parseCssColor(`#${text.trim().replace("#", "")}`) : null
            if (typed) pick({ ...colorToPicked(typed), alpha: shown.alpha })
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        {alpha ? <span className="msr:w-9 msr:shrink-0 msr:text-right msr:tabular-nums msr:text-ink-500">{Math.round(shown.alpha * 100)}%</span> : null}
      </div>

      {swatches?.length ? (
        <div className="msr:flex msr:items-center msr:justify-between" role="group" aria-label="Swatches">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              aria-pressed={swatch.toLowerCase() === solid}
              className={cn(
                "msr:size-5 msr:rounded-full msr:border msr:border-black/10 msr:outline-none msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]",
                swatch.toLowerCase() === solid && "msr:shadow-[0_0_0_2px_var(--msr-surface),0_0_0_3px_var(--msr-color-ink-500)]",
              )}
              style={{ backgroundColor: swatch }}
              // A swatch changes the colour, and leaves it as solid as it was.
              onClick={() => pick({ ...colorToPicked(parseCssColor(swatch) ?? BLACK), alpha: shown.alpha })}
            />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  )
}
