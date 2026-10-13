import { useState, type ReactNode } from "react"
import { colorToHex, parseCssColor } from "../core/colors"
import { ERASER_WIDTHS, PEN_STYLES, type PenInHand, type PenSetting } from "../core/ink"
import type { PenChoice, PenKind } from "../core/types"
import { cn } from "../core/utils"
import { ColorPicker } from "./color-picker"
import { inkOf, surface, Swatches } from "./swatches"

// The colours a pen is offered in: enough to tell one remark from another on a page, and no
// more than fit beside its widths. Any other is picked from the last of them.
const COLORS = ["#ef4444", "#facc15", "#22c55e", "#0d99ff", "#111827"]

// A colour as solid as another is: picking one of the colours offered leaves the ink as
// see-through as it was.
const withAlpha = (color: string, alpha: number) => {
  const sample = parseCssColor(color)
  return sample ? colorToHex({ ...sample, alpha }) : color
}

// The pens stand in the tray with their tips up, each drawn as the thing it is, on a canvas 40
// wide and 104 tall, the tray cutting off their lower end. Their barrels are the tray's own tone, a shade
// deeper so they stand off it with no line drawn round them, and lit from one side like
// something round (`--msr-pen-*` in styles.css). What is in the pen's colour is lit the same
// way, by a sheen laid over it, so the colour sits on the pen rather than on top of the drawing.
const BARREL = "url(#mesurer-pen-barrel)"
const SHEEN = "url(#mesurer-pen-sheen)"
// Where the light and the shade fall across a barrel, from one side to the other.
const BARREL_STOPS = [0, 0.22, 0.5, 0.86, 1]

// The band round a pen's barrel is in the pen's colour, and as tall as the pen draws wide: the
// thinnest of its widths the thinnest band, the widest the tallest.
const bandOf = (pen: PenInHand) => {
  const widths = PEN_STYLES[pen.kind].widths
  const nearest = widths.reduce((best, width, index) => (Math.abs(width - pen.width) < Math.abs(widths[best] - pen.width) ? index : best), 0)
  return 3 + nearest * 3
}

// The band, lit like the barrel it is round.
const Band = ({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) => (
  <>
    {[color, SHEEN].map((fill) => (
      <rect key={fill} x={x} y={y} width={width} height={height} fill={fill} style={{ transition: "height 150ms ease-out" }} />
    ))}
  </>
)

// A part in the pen's colour, lit like the rest of it.
const Inked = ({ d, color }: { d: string; color: string }) => (
  <>
    <path d={d} fill={color} />
    <path d={d} fill={SHEEN} />
  </>
)

const PEN_SHAPES: Record<PenKind, (color: string, band: number) => ReactNode> = {
  // A long tip that swells from a rounded point into the barrel, the ink at its very end.
  ink: (color, band) => (
    <>
      <path d="M20 3c2.4 0 3.5 2.9 4.5 7l5.7 30c.6 3 .8 5 .8 8v56H9V48c0-3 .2-5 .8-8l5.7-30c1-4.1 2.1-7 4.5-7Z" fill={BARREL} />
      <Inked d="M20 3c2.4 0 3.5 2.9 4.5 7l.8 4.2H14.7l.8-4.2c1-4.1 2.1-7 4.5-7Z" color={color} />
      <Band x={9} y={54} width={22} height={band} color={color} />
    </>
  ),
  // A slanted felt tip on a neck that flares out into the barrel.
  marker: (color, band) => (
    <>
      <path d="M14 22h12v5c0 6 5 7 5 15v62H9V42c0-8 5-9 5-15Z" fill={BARREL} />
      <Inked d="M14 22.5v-10.3c0-1.2.5-1.9 1.5-2.4l7.7-4.2c1.4-.7 2.8.2 2.8 1.7v15.2Z" color={color} />
      <Band x={9} y={60} width={22} height={band} color={color} />
    </>
  ),
}

// The eraser: a rubber with a rounded top, on a barrel of its own.
const ERASER_SHAPE = (
  <>
    <path d="M11 30h18v74H11Z" fill={BARREL} />
    <Inked d="M11 31V20c0-6.5 3-10.5 9-10.5s9 4 9 10.5v11Z" color="#f0a8a3" />
  </>
)

// What the pen tool draws with, opened from the tool's caret, after the tray of pens on a phone:
// the pens and the eraser stand in a small tray, the one in hand raised. Under it is how wide
// what is in hand draws, or rubs out, and for a pen in what colour; the last of the colours
// opens a picker for any colour, and for how solid the ink is. Each keeps what it was set to.
export function PenCard({
  pens,
  kind,
  eraserWidth,
  above = false,
  onKind,
  onChange,
}: {
  /** Every pen, as it is set. */
  pens: PenInHand[]
  /** What is in hand: one of the pens, or the eraser. */
  kind: PenChoice
  /** How wide the eraser is set. */
  eraserWidth: number
  /**
   * The card is above the toolbar, not below it. The tray stays the part next to the toolbar
   * either way, and what it is set to stacks away from it.
   */
  above?: boolean
  onKind: (kind: PenChoice) => void
  /** Sets what is in hand: a pen, or the eraser's width. */
  onChange: (setting: PenSetting) => void
}) {
  const [picking, setPicking] = useState(false)
  const inHand = pens.find((pen) => pen.kind === kind)
  const ink = inHand ? inkOf(inHand.color) : null

  const tool = (choice: PenChoice, label: string, drawing: ReactNode) => {
    const held = choice === kind
    return (
      <button
        key={choice}
        type="button"
        aria-label={label}
        aria-pressed={held}
        title={label}
        className="msr:rounded-control msr:bg-transparent msr:outline-none msr:transition-transform msr:duration-200 msr:ease-out msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
        // What is in hand stands up out of the tray; the rest sits lower in it.
        style={{ transform: `translateY(${held ? 6 : 20}px)` }}
        onClick={() => onKind(choice)}
      >
        <svg width="28" height="73" viewBox="0 0 40 104" aria-hidden="true">
          {drawing}
        </svg>
      </button>
    )
  }

  return (
    // Its parts are as far from each other as the card is from the toolbar.
    <section
      className={cn("msr:flex msr:w-56 msr:items-center msr:gap-1 msr:text-[11px] msr:text-ink-700", above ? "msr:flex-col-reverse" : "msr:flex-col")}
      aria-label="Pens"
      data-mesurer-pen-card
    >
      <div className={cn(surface, "msr:flex msr:h-14 msr:items-start msr:justify-center msr:gap-3 msr:overflow-hidden msr:rounded-[20px] msr:px-4")} role="group" aria-label="Pen">
        <svg width="0" height="0" className="msr:absolute" aria-hidden="true">
          <defs>
            <linearGradient id="mesurer-pen-barrel" x1="0" x2="1" y1="0" y2="0">
              {BARREL_STOPS.map((offset, index) => (
                <stop key={offset} offset={offset} style={{ stopColor: `var(--msr-pen-barrel-${index + 1})` }} />
              ))}
            </linearGradient>
            {/* Light down one side and shade down the other, over whatever colour is under it. */}
            <linearGradient id="mesurer-pen-sheen" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.1" />
              <stop offset="0.22" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
        {pens.map((pen) => tool(pen.kind, PEN_STYLES[pen.kind].label, PEN_SHAPES[pen.kind](inkOf(pen.color).solid, bandOf(pen))))}
        {tool("eraser", "Eraser", ERASER_SHAPE)}
      </div>

      {/* What is in hand is set to: how wide, and for a pen in what colour. */}
      {/* A pen's fills the card; the eraser's, with only its sizes, is as wide as they are, under the tray. */}
      <div className={cn(surface, "msr:flex msr:min-w-0 msr:items-center msr:gap-2 msr:rounded-[20px] msr:p-2", inHand && "msr:w-full")}>
        <div className="msr:flex msr:shrink-0 msr:gap-0.5" role="group" aria-label={inHand ? "Width" : "Eraser size"}>
          {(inHand ? PEN_STYLES[inHand.kind].widths : ERASER_WIDTHS).map((width, index) => {
            const chosen = width === (inHand ? inHand.width : eraserWidth)
            return (
              <button
                key={width}
                type="button"
                aria-label={`${width}px`}
                aria-pressed={chosen}
                title={`${width}px`}
                className={cn(
                  "msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-[8px] msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]",
                  // The width in use is the one on a plate of its own.
                  chosen ? "msr:bg-ink-900 msr:text-surface" : "msr:text-ink-900 msr:hover:bg-ink-100",
                )}
                onClick={() => onChange({ width })}
              >
                {/* From thin to thick across the row, not to scale: a marker's would not fit. A
                    pen's is drawn as a stroke, the eraser's as the round thing it is. */}
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  {inHand ? (
                    <line x1="6" y1="6" x2="14" y2="14" stroke="currentColor" strokeWidth={1.5 + index * 2.25} strokeLinecap="round" />
                  ) : (
                    <circle cx="10" cy="10" r={2.5 + index * 2.25} fill="none" stroke="currentColor" strokeWidth="1.5" />
                  )}
                </svg>
              </button>
            )
          })}
        </div>
        {inHand && ink ? (
          <>
            <span className="msr:h-4 msr:w-px msr:shrink-0 msr:bg-ink-200" aria-hidden="true" />
            {/* The last of them is any other colour, and how solid the ink is. */}
            <Swatches
              label="Color"
              colors={COLORS}
              value={ink.solid}
              picking={picking}
              onPick={(color) => onChange({ color: withAlpha(color, ink.alpha) })}
              onMore={() => setPicking((open) => !open)}
            />
          </>
        ) : null}
      </div>

      {inHand && picking ? (
        <div className={cn(surface, "msr:w-full msr:rounded-[20px] msr:p-3")}>
          <ColorPicker value={inHand.color} onChange={(color) => onChange({ color })} />
        </div>
      ) : null}
    </section>
  )
}
