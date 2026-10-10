import { useState, type ReactNode } from "react"
import { colorToHex, parseCssColor } from "../core/colors"
import { PEN_STYLES, type PenInHand, type PenSetting } from "../core/ink"
import type { PenKind } from "../core/types"
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

// The pens stand in the tray with their tips up, each drawn as the thing it is: 36 wide and 100
// tall, the tray cutting off their lower end. Their barrels are the tray's own tone, a shade
// deeper so they stand off it with no line drawn round them, and shaded across like something
// round, so that the ink's colour at the tip and round the barrel is what stands out. The tones
// are the theme's (see `--msr-pen-*` in styles.css), set as styles: an attribute cannot read them.
const BARREL = "url(#mesurer-pen-barrel)"
const BARREL_STOPS = [0, 0.3, 0.72, 1]

// The band round a pen's barrel is in the pen's colour, and as tall as the pen draws wide: the
// thinnest of its widths the thinnest band, the widest the tallest.
const bandOf = (pen: PenInHand) => {
  const widths = PEN_STYLES[pen.kind].widths
  const nearest = widths.reduce((best, width, index) => (Math.abs(width - pen.width) < Math.abs(widths[best] - pen.width) ? index : best), 0)
  return 2 + nearest * 2
}
const BAND = { style: { transition: "height 150ms ease-out" } }

const PEN_SHAPES: Record<PenKind, (ink: { solid: string; alpha: number; band: number }) => ReactNode> = {
  // A long cone that comes to a point, the ink at its very tip.
  ink: ({ solid, band }) => (
    <>
      <path d="M18 4 28 46v54H8V46Z" fill={BARREL} />
      <path d="M18 4 21.1 17h-6.2Z" fill={solid} />
      <rect x="8" y="52" width="20" height={band} fill={solid} {...BAND} />
    </>
  ),
  // A thin nib on a stepped barrel.
  fineliner: ({ solid, band }) => (
    <>
      <path d="M15 17h6l2 7h2v9h2v67H9V33h2v-9h2Z" fill={BARREL} />
      <rect x="17" y="6" width="2" height="11" rx="0.6" fill={solid} />
      <rect x="9" y="58" width="18" height={band} fill={solid} {...BAND} />
    </>
  ),
  // A slanted felt tip on a bottle-shouldered barrel, and how solid its ink is written under
  // its band.
  marker: ({ solid, alpha, band }) => (
    <>
      <path d="M12 23h12c0 9 5 9 5 18v59H7V41c0-9 5-9 5-18Z" fill={BARREL} />
      <path d="M12 23V11.5a2 2 0 0 1 1.1-1.8l8-4A2 2 0 0 1 24 7.5V23Z" fill={solid} />
      <rect x="7" y="58" width="22" height={band} fill={solid} {...BAND} />
      <text x="18" y="83" textAnchor="middle" fontSize="8.5" fontWeight="600" letterSpacing="0.6" style={{ fill: "var(--msr-pen-text)" }}>
        {Math.round(alpha * 100)}
      </text>
    </>
  ),
}

const surface = "mesurer-menu-surface msr:bg-surface msr:shadow-floating"

// What the pen tool draws with, opened from the tool's caret, after the tray of pens on a phone:
// the pens stand in a tray, the one in hand raised, beside a well of its colour. Pressing the
// pen in hand again shows how wide it draws; pressing the well shows the colour picker, which
// says how solid the ink is too. Each pen keeps what it was set to.
export function PenCard({
  pens,
  kind,
  onKind,
  onChange,
}: {
  /** Every pen, as it is set. */
  pens: PenInHand[]
  /** The one in hand. */
  kind: PenKind
  onKind: (kind: PenKind) => void
  /** Sets the pen in hand. */
  onChange: (setting: PenSetting) => void
}) {
  // What is shown under the tray: the widths of the pen in hand, its colour, or nothing.
  const [panel, setPanel] = useState<"width" | "color" | null>(null)
  const inHand = pens.find((pen) => pen.kind === kind) ?? pens[0]
  if (!inHand) return null
  const widths = PEN_STYLES[inHand.kind].widths
  const toggle = (next: "width" | "color") => setPanel((current) => (current === next ? null : next))

  return (
    <section className="msr:flex msr:w-64 msr:flex-col msr:gap-2 msr:text-[11px] msr:text-ink-700" aria-label="Pens" data-mesurer-pen-card>
      <div className={cn(surface, "msr:flex msr:h-[76px] msr:items-center msr:overflow-hidden msr:rounded-[28px] msr:pr-4 msr:pl-5")}>
        <svg width="0" height="0" className="msr:absolute" aria-hidden="true">
          <defs>
            <linearGradient id="mesurer-pen-barrel" x1="0" x2="1" y1="0" y2="0">
              {BARREL_STOPS.map((offset, index) => (
                <stop key={offset} offset={offset} style={{ stopColor: `var(--msr-pen-barrel-${index + 1})` }} />
              ))}
            </linearGradient>
          </defs>
        </svg>
        <div className="msr:flex msr:h-full msr:flex-1 msr:items-start msr:gap-3" role="group" aria-label="Pen">
          {pens.map((pen) => {
            const held = pen.kind === kind
            const label = PEN_STYLES[pen.kind].label
            return (
              <button
                key={pen.kind}
                type="button"
                aria-label={label}
                aria-pressed={held}
                aria-expanded={held ? panel === "width" : undefined}
                title={held ? `${label}: press again for its width` : label}
                className="msr:rounded-control msr:bg-transparent msr:outline-none msr:transition-transform msr:duration-200 msr:ease-out msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
                // The pen in hand stands up out of the tray; the others sit lower in it.
                style={{ transform: `translateY(${held ? 8 : 26}px)` }}
                onClick={() => (held ? toggle("width") : onKind(pen.kind))}
              >
                <svg width="36" height="100" viewBox="0 0 36 100" aria-hidden="true">
                  {PEN_SHAPES[pen.kind]({ ...inkOf(pen.color), band: bandOf(pen) })}
                </svg>
              </button>
            )
          })}
        </div>
        {/* The colour of the pen in hand, in a ring of every colour: it opens the picker. */}
        <button
          type="button"
          aria-label="Color"
          aria-expanded={panel === "color"}
          title="Color"
          className="msr:flex msr:size-9 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-full msr:outline-none msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
          style={{ background: RAINBOW }}
          onClick={() => toggle("color")}
        >
          <span className="msr:flex msr:size-[28px] msr:items-center msr:justify-center msr:rounded-full msr:bg-surface">
            <span
              className="msr:size-[22px] msr:rounded-full"
              style={{ background: `linear-gradient(${inHand.color}, ${inHand.color}), ${CHECKER}`, backgroundSize: "auto, 8px 8px" }}
            />
          </span>
        </button>
      </div>

      {panel === "width" ? (
        <div className={cn(surface, "msr:flex msr:gap-1 msr:rounded-[20px] msr:p-2")} role="group" aria-label="Width">
          {widths.map((width, index) => (
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

      {panel === "color" ? (
        <div className={cn(surface, "msr:rounded-[20px] msr:p-3")}>
          <ColorPicker value={inHand.color} swatches={SWATCHES} onChange={(color) => onChange({ color })} />
        </div>
      ) : null}
    </section>
  )
}
