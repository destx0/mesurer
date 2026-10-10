import { useState, type ReactNode } from "react"
import { PEN_STYLES, type PenInHand, type PenSetting } from "../core/ink"
import type { PenKind } from "../core/types"
import { cn } from "../core/utils"
import { ColorPicker } from "./color-picker"
import { playerCardClassName } from "./player-layout"

// The colours offered for a pen, beside whatever is picked from the picker itself.
const SWATCHES = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#0d99ff", "#a855f7", "#111827", "#ffffff"]

const CHECKER = "conic-gradient(#d4d4d8 25%, #fff 0 50%, #d4d4d8 0 75%, #fff 0)"

// The pens, standing in a tray with their tips up: each is drawn as the thing it is, its tip in
// the colour it is set to. They are 28 wide and 64 tall, and the tray cuts off their lower end.
const PEN_SHAPES: Record<PenKind, (color: string) => ReactNode> = {
  // A cone that comes to a point, with the ink at its tip.
  ink: (color) => (
    <>
      <path d="M14 2 20 24v40H8V24Z" fill="currentColor" />
      <path d="M14 2 16.7 12h-5.4Z" fill={color} />
      <path d="M8 30h12" stroke="var(--msr-surface)" strokeWidth="1.5" />
    </>
  ),
  // A long thin nib on a stepped barrel.
  fineliner: (color) => (
    <>
      <path d="M11.5 12h5l2.5 9v43H9V21Z" fill="currentColor" />
      <rect x="13" y="3" width="2" height="9" rx="0.5" fill={color} />
      <path d="M9 26h10M9 30h10" stroke="var(--msr-surface)" strokeWidth="1.5" />
    </>
  ),
  // A broad slanted tip, and a band of its colour round the barrel.
  marker: (color) => (
    <>
      <path d="M9 16h10l3 9v39H6V25Z" fill="currentColor" />
      <path d="M9 16V8l10-5v13Z" fill={color} />
      <rect x="6" y="34" width="16" height="8" fill={color} />
    </>
  ),
}

const pressed = "msr:bg-ink-100 msr:shadow-[inset_0_0_0_1px_var(--msr-color-ink-300)]"
const control =
  "msr:flex msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:hover:bg-ink-100 msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"

// What the pen tool draws with, on a card opened from the tool's caret: the pens standing in
// their tray, the one in hand raised; how wide it draws; and its colour, which says how solid
// the ink is too. Each pen keeps what it was set to.
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
  const [picking, setPicking] = useState(false)
  const inHand = pens.find((pen) => pen.kind === kind) ?? pens[0]
  if (!inHand) return null
  const widths = PEN_STYLES[inHand.kind].widths

  return (
    <section
      className={cn(playerCardClassName, "msr:flex msr:w-56 msr:flex-col msr:gap-2 msr:p-2 msr:text-[11px] msr:text-ink-700")}
      aria-label="Pens"
      data-mesurer-pen-card
    >
      <div className="msr:flex msr:items-stretch msr:gap-2">
        <div
          className="msr:flex msr:h-14 msr:flex-1 msr:items-start msr:justify-center msr:gap-3 msr:overflow-hidden msr:rounded-control msr:bg-ink-100 msr:px-2"
          role="group"
          aria-label="Pen"
        >
          {pens.map((pen) => (
            <button
              key={pen.kind}
              type="button"
              aria-label={PEN_STYLES[pen.kind].label}
              aria-pressed={pen.kind === kind}
              title={PEN_STYLES[pen.kind].label}
              className="msr:rounded-control msr:text-ink-800 msr:outline-none msr:transition-transform msr:duration-150 msr:ease-out msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"
              // The pen in hand stands up out of the tray; the others sit lower in it.
              style={{ transform: `translateY(${pen.kind === kind ? 6 : 20}px)` }}
              onClick={() => onKind(pen.kind)}
            >
              <svg width="28" height="64" viewBox="0 0 28 64" aria-hidden="true">
                {PEN_SHAPES[pen.kind](pen.color)}
              </svg>
            </button>
          ))}
        </div>
        {/* The colour of the pen in hand, in a ring of every colour: it opens the picker. */}
        <button
          type="button"
          aria-label="Color"
          aria-expanded={picking}
          title="Color"
          className={cn(control, "msr:w-14 msr:shrink-0", picking && pressed)}
          onClick={() => setPicking((open) => !open)}
        >
          <span
            className="msr:flex msr:size-7 msr:items-center msr:justify-center msr:rounded-full"
            style={{ background: "conic-gradient(#ef4444, #facc15, #22c55e, #0d99ff, #a855f7, #ef4444)" }}
          >
            <span
              className="msr:size-5 msr:rounded-full msr:border-2 msr:border-surface"
              style={{ background: `linear-gradient(${inHand.color}, ${inHand.color}), ${CHECKER}`, backgroundSize: "auto, 8px 8px" }}
            />
          </span>
        </button>
      </div>

      <div className="msr:flex msr:gap-1" role="group" aria-label="Width">
        {widths.map((width, index) => (
          <button
            key={width}
            type="button"
            aria-label={`${width}px`}
            aria-pressed={width === inHand.width}
            title={`${width}px`}
            className={cn(control, "msr:h-7 msr:flex-1", width === inHand.width && pressed)}
            onClick={() => onChange({ width })}
          >
            {/* Drawn from thin to thick across the row, not to scale: a marker's would not fit. */}
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <line x1="5" y1="15" x2="15" y2="5" stroke="currentColor" strokeWidth={1 + index * 1.75} strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>

      {picking ? <ColorPicker value={inHand.color} swatches={SWATCHES} onChange={(color) => onChange({ color })} /> : null}
    </section>
  )
}
