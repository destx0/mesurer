import { colorToHex, parseCssColor } from "../core/colors"
import { cn } from "../core/utils"

const RAINBOW = "conic-gradient(#ff453a, #ff9f0a, #ffd60a, #30d158, #64d2ff, #0a84ff, #bf5af2, #ff375f, #ff453a)"

/** What each part of a card hung off a tool is laid on. */
export const surface = "mesurer-menu-surface msr:bg-surface msr:shadow-floating"

// A colour and how solid it is, apart: what is offered is the colour itself, however see-through
// it is set. A colour this cannot read is taken as it is, and as solid.
export const inkOf = (color: string) => {
  const sample = parseCssColor(color)
  return sample ? { solid: colorToHex({ ...sample, alpha: 1 }), alpha: sample.alpha } : { solid: color, alpha: 1 }
}

const ring = "msr:shadow-[0_0_0_2px_var(--msr-surface),0_0_0_3px_var(--msr-color-ink-500)]"
const dot = "msr:size-4 msr:shrink-0 msr:rounded-full msr:outline-none msr:focus-visible:shadow-[0_0_0_2px_var(--msr-accent)]"

// No colour at all, as a swatch: white, struck through in red.
const CLEAR = "linear-gradient(to top right, #fff calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), #fff calc(50% + 1px))"

// A row of colours to pick one from, the one in use ringed. The last opens a picker for any
// other, and with `onClear` the first is no colour at all.
export function Swatches({
  label,
  colors,
  value,
  picking,
  onPick,
  onMore,
  onClear,
}: {
  label: string
  colors: readonly string[]
  /** The colour in use, fully solid, or nothing when there is none. */
  value: string
  /** Whether the picker for any other colour is open. */
  picking: boolean
  onPick: (color: string) => void
  onMore: () => void
  /** Picks no colour at all. It is the one in use when `value` is none of them. */
  onClear?: () => void
}) {
  return (
    <div className="msr:flex msr:min-w-0 msr:flex-1 msr:items-center msr:justify-between" role="group" aria-label={label}>
      {onClear ? (
        <button
          type="button"
          aria-label="No color"
          aria-pressed={!value}
          title="No color"
          className={cn(dot, "msr:border msr:border-black/10", !value && ring)}
          style={{ background: CLEAR }}
          onClick={onClear}
        />
      ) : null}
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={color === value}
          className={cn(dot, "msr:border msr:border-black/10", color === value && ring)}
          style={{ backgroundColor: color }}
          onClick={() => onPick(color)}
        />
      ))}
      <button
        type="button"
        aria-label="More colors"
        aria-expanded={picking}
        title="More colors"
        className={cn(dot, picking && ring)}
        style={{ background: RAINBOW }}
        onClick={onMore}
      />
    </div>
  )
}
