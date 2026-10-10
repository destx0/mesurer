import { useState, type ReactNode } from "react"
import { colorToHex, parseCssColor } from "../core/colors"
import { PEN_STYLES, type PenInHand, type PenSetting } from "../core/ink"
import type { PenChoice, PenKind } from "../core/types"
import { cn } from "../core/utils"
import { ColorPicker } from "./color-picker"

// The colours offered for a pen, beside whatever is picked from the picker itself.
const SWATCHES = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#0d99ff", "#a855f7", "#111827", "#ffffff"]

const CHECKER = "conic-gradient(#d4d4d8 25%, #fff 0 50%, #d4d4d8 0 75%, #fff 0)"
const RAINBOW = "conic-gradient(#ff453a, #ff9f0a, #ffd60a, #30d158, #64d2ff, #0a84ff, #bf5af2, #ff375f, #ff453a)"

// A pen's colour and how solid it is, apart: the pens are drawn in the colour itself, and a
// marker says how solid on its barrel. A colour this cannot read is drawn as it is, and solid.
const inkOf = (color: string) => {
  const sample = parseCssColor(color)
  return sample ? { solid: colorToHex({ ...sample, alpha: 1 }), alpha: sample.alpha } : { solid: color, alpha: 1 }
}

// The pens stand in the tray with their tips up, each drawn as the thing it is: 40 wide and 104
// tall, the tray cutting off their lower end. Their barrels are the tray's own tone, a shade
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
  return 2 + nearest * 2
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

type Ink = { solid: string; alpha: number; band: number }

const PEN_SHAPES: Record<PenKind, (ink: Ink) => ReactNode> = {
  // A long tip that swells from a rounded point into the barrel, the ink at its very end.
  ink: ({ solid, band }) => (
    <>
      <path d="M20 3c2.4 0 3.5 2.9 4.5 7l5.7 30c.6 3 .8 5 .8 8v56H9V48c0-3 .2-5 .8-8l5.7-30c1-4.1 2.1-7 4.5-7Z" fill={BARREL} />
      <Inked d="M20 3c2.4 0 3.5 2.9 4.5 7l.8 4.200H14.700l.8-4.200c1-4.1 2.1-7 4.5-7Z" color={solid} />
      <Band x={9} y={54} width={22} height={band} color={solid} />
    </>
  ),
  // A needle of a nib in a small collar, on a barrel that widens in steps.
  fineliner: ({ solid, band }) => (
    <>
      <path d="M17 18h6l3.5 11h-13Z" fill={BARREL} />
      <rect x="17.5" y="13" width="5" height="5.5" rx="1" fill={BARREL} />
      <rect x="12.5" y="29" width="15" height="17.5" rx="1.5" fill={BARREL} />
      <path d="M12.5 47h15c1.1 0 1.5.8 1.5 2v55H11V49c0-1.2.4-2 1.5-2Z" fill={BARREL} />
      <rect x="19.2" y="3.5" width="1.6" height="10.5" rx="0.8" fill={solid} />
      <Band x={11} y={60} width={18} height={band} color={solid} />
    </>
  ),
  // A slanted felt tip on a neck that flares out into the barrel, and how solid its ink is
  // written under its band.
  marker: ({ solid, alpha, band }) => (
    <>
      <path d="M14 22h12v5c0 6 5 7 5 15v62H9V42c0-8 5-9 5-15Z" fill={BARREL} />
      <Inked d="M14 22.500v-10.300c0-1.2.5-1.9 1.5-2.400l7.7-4.200c1.4-.7 2.8.2 2.8 1.700v15.200Z" color={solid} />
      <Band x={9} y={60} width={22} height={band} color={solid} />
      <text x="20" y="86" textAnchor="middle" fontSize="8.5" fontWeight="600" letterSpacing="0.6" style={{ fill: "var(--msr-pen-text)" }}>
        {Math.round(alpha * 100)}
      </text>
    </>
  ),
}

// The eraser: a rubber with a rounded top, on a barrel of its own.
const ERASER_SHAPE = (
  <>
    <path d="M11 30h18v74H11Z" fill={BARREL} />
    <Inked d="M11 31V20c0-6.5 3-10.5 9-10.500s9 4 9 10.500v11Z" color="#f0a8a3" />
  </>
)

const surface = "mesurer-menu-surface msr:bg-surface msr:shadow-floating"

// What the pen tool draws with, opened from the tool's caret, after the tray of pens on a phone:
// the pens and the eraser stand in a tray, the one in hand raised, beside a well of the pen's
// colour. Pressing the pen in hand again shows how wide it draws; pressing the well shows the
// colour picker, which says how solid the ink is too. Each pen keeps what it was set to.
export function PenCard({
  pens,
  kind,
  onKind,
  onChange,
}: {
  /** Every pen, as it is set. */
  pens: PenInHand[]
  /** What is in hand: one of the pens, or the eraser. */
  kind: PenChoice
  onKind: (kind: PenChoice) => void
  /** Sets the pen in hand. */
  onChange: (setting: PenSetting) => void
}) {
  // What is shown under the tray: the widths of the pen in hand, its colour, or nothing.
  const [panel, setPanel] = useState<"width" | "color" | null>(null)
  const inHand = pens.find((pen) => pen.kind === kind)
  // The well shows a pen's colour: with the eraser in hand, the first pen's, and it is not set.
  const shown = inHand ?? pens[0]
  if (!shown) return null
  const toggle = (next: "width" | "color") => setPanel((current) => (current === next ? null : next))

  const tool = (choice: PenChoice, label: string, drawing: ReactNode, onPress: () => void, expanded?: boolean) => {
    const held = choice === kind
    return (
      <button
        key={choice}
        type="button"
        aria-label={label}
        aria-pressed={held}
        aria-expanded={expanded}
        title={label}
        className="msr:rounded-control msr:bg-transparent msr:outline-none msr:transition-transform msr:duration-200 msr:ease-out msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
        // What is in hand stands up out of the tray; the rest sits lower in it.
        style={{ transform: `translateY(${held ? 8 : 28}px)` }}
        onClick={onPress}
      >
        <svg width="40" height="104" viewBox="0 0 40 104" aria-hidden="true">
          {drawing}
        </svg>
      </button>
    )
  }

  return (
    <section className="msr:flex msr:w-72 msr:flex-col msr:gap-2 msr:text-[11px] msr:text-ink-700" aria-label="Pens" data-mesurer-pen-card>
      <div className={cn(surface, "msr:flex msr:h-20 msr:items-center msr:overflow-hidden msr:rounded-[28px] msr:pr-4 msr:pl-5")}>
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
        <div className="msr:flex msr:h-full msr:flex-1 msr:items-start msr:gap-2" role="group" aria-label="Pen">
          {pens.map((pen) => {
            const held = pen.kind === kind
            return tool(
              pen.kind,
              PEN_STYLES[pen.kind].label,
              PEN_SHAPES[pen.kind]({ ...inkOf(pen.color), band: bandOf(pen) }),
              // Pressing the pen in hand again shows its widths.
              () => (held ? toggle("width") : onKind(pen.kind)),
              held ? panel === "width" : undefined,
            )
          })}
          {tool("eraser", "Eraser", ERASER_SHAPE, () => {
            setPanel(null)
            onKind("eraser")
          })}
        </div>
        {/* The colour of the pen in hand, in a ring of every colour: it opens the picker. */}
        <button
          type="button"
          aria-label="Color"
          aria-expanded={panel === "color"}
          title="Color"
          disabled={!inHand}
          className="msr:flex msr:size-9 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-full msr:outline-none msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)] msr:disabled:opacity-40"
          style={{ background: RAINBOW }}
          onClick={() => toggle("color")}
        >
          <span className="msr:flex msr:size-[28px] msr:items-center msr:justify-center msr:rounded-full msr:bg-surface">
            <span
              className="msr:size-[22px] msr:rounded-full"
              style={{ background: `linear-gradient(${shown.color}, ${shown.color}), ${CHECKER}`, backgroundSize: "auto, 8px 8px" }}
            />
          </span>
        </button>
      </div>

      {inHand && panel === "width" ? (
        <div className={cn(surface, "msr:flex msr:gap-1 msr:rounded-[20px] msr:p-2")} role="group" aria-label="Width">
          {PEN_STYLES[inHand.kind].widths.map((width, index) => (
            <button
              key={width}
              type="button"
              aria-label={`${width}px`}
              aria-pressed={width === inHand.width}
              title={`${width}px`}
              className={cn(
                "msr:flex msr:h-11 msr:flex-1 msr:items-center msr:justify-center msr:rounded-[12px] msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]",
                // The width in use is the one on a plate of its own.
                width === inHand.width ? "msr:bg-ink-900 msr:text-surface" : "msr:text-ink-900 msr:hover:bg-ink-100",
              )}
              onClick={() => onChange({ width })}
            >
              {/* Drawn from thin to thick across the row, not to scale: a marker's would not fit. */}
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                <line x1="8" y1="8" x2="20" y2="20" stroke="currentColor" strokeWidth={1.25 + index * 2.4} strokeLinecap="round" />
              </svg>
            </button>
          ))}
        </div>
      ) : null}

      {inHand && panel === "color" ? (
        <div className={cn(surface, "msr:rounded-[20px] msr:p-3")}>
          <ColorPicker value={inHand.color} swatches={SWATCHES} onChange={(color) => onChange({ color })} />
        </div>
      ) : null}
    </section>
  )
}
