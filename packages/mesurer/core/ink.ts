import type { PenPoint } from "./types"

// Ink is drawn as the outline of the stroke rather than as a line of one width: the line through
// the points is smoothed, given a width at each point from how hard or how slowly it was drawn
// there, thinned to nothing at both ends, and the shape around it is filled.

// How far each point is drawn toward the one before it, which takes the shake out of a hand.
const STREAMLINE = 0.5
// Points closer than this to the last one kept say nothing more about the line.
const MIN_SPACING = 1
// The thinnest and the thickest a stroke gets, as parts of its width. A point with no weight of
// its own is drawn at the width itself.
const THIN = 0.4
const THICK = 1.6
// Each end thins over this many widths of the stroke, or over half of a stroke shorter than that.
const TAPER_WIDTHS = 5
// The ends keep this much of their width, so they are rounded and not needle sharp.
const TAPER_FLOOR = 0.2

/** The width of a new pen stroke, around which the ink swells and thins. */
export const PEN_WIDTH = 3

/** The weight of a point drawn with no pressure or speed known: the stroke's own width. */
export const INK_WEIGHT = 0.5

// The fastest a pointer is taken to move, in pixels a millisecond: there the ink is thinnest.
const FAST = 2.5
// How much of the way a point's weight goes from the last one's to its own, so the width swells
// and thins along the stroke without jumping.
const WEIGHT_EASE = 0.3

/**
 * The weight of the next point of a stroke, from the last one's: heavier the harder a pen is
 * pressed, or without one, the slower the pointer moves.
 */
export const nextInkWeight = (previous: number, distance: number, elapsed: number, pressure?: number) => {
  const target = pressure ?? 1 - Math.min(1, distance / Math.max(1, elapsed) / FAST)
  return Math.round((previous + (target - previous) * WEIGHT_EASE) * 100) / 100
}

type Spot = { x: number; y: number; radius: number; along: number }

// The line the ink follows: the points smoothed and thinned out, each with the half width the
// stroke has there and how far along the stroke it is.
const inkLine = (points: readonly PenPoint[], width: number): Spot[] => {
  const line: Spot[] = []
  let smooth = points[0]
  let along = 0
  points.forEach((point, index) => {
    const last = index === points.length - 1
    // The ends stay where they were put; what is between is drawn toward what came before.
    smooth =
      index === 0 || last
        ? point
        : { x: smooth.x + (point.x - smooth.x) * STREAMLINE, y: smooth.y + (point.y - smooth.y) * STREAMLINE }
    const previous = line[line.length - 1]
    const step = previous ? Math.hypot(smooth.x - previous.x, smooth.y - previous.y) : 0
    if (previous && step < MIN_SPACING && !last) return
    along += step
    const weight = point.w ?? INK_WEIGHT
    line.push({ x: smooth.x, y: smooth.y, along, radius: (width / 2) * (THIN + (THICK - THIN) * weight) })
  })
  const taper = Math.min(along / 2, width * TAPER_WIDTHS)
  if (taper > 0) {
    // Eased, so the stroke swells out of its tip rather than widening in a straight line.
    const eased = (distance: number) => {
      const t = Math.min(1, distance / taper)
      return TAPER_FLOOR + (1 - TAPER_FLOOR) * t * (2 - t)
    }
    for (const spot of line) spot.radius *= Math.min(eased(spot.along), eased(along - spot.along))
  }
  return line
}

const format = (value: number) => Math.round(value * 100) / 100

// A curve through the points: each is the handle of a curve that ends halfway to the next.
const through = (points: { x: number; y: number }[]) =>
  points
    .slice(1)
    .map((point, index) => {
      const previous = points[index]
      return `Q${format(previous.x)} ${format(previous.y)} ${format((previous.x + point.x) / 2)} ${format((previous.y + point.y) / 2)}`
    })
    .join("")

/** The outline of a stroke of this width through the points, as the data of an SVG path to fill. */
export const inkPath = (points: readonly PenPoint[], width: number): string => {
  if (points.length === 0) return ""
  const line = inkLine(points, width)
  const first = line[0]
  if (line.length === 1) {
    // A dot: a circle the width of the stroke.
    const r = format(first.radius)
    return `M${format(first.x - first.radius)} ${format(first.y)}a${r} ${r} 0 1 0 ${format(first.radius * 2)} 0a${r} ${r} 0 1 0 ${format(-first.radius * 2)} 0Z`
  }
  const left: { x: number; y: number }[] = []
  const right: { x: number; y: number }[] = []
  line.forEach((spot, index) => {
    // The way the line runs at this point, from its neighbours on either side.
    const before = line[Math.max(0, index - 1)]
    const after = line[Math.min(line.length - 1, index + 1)]
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1
    const across = { x: (-(after.y - before.y) / length) * spot.radius, y: ((after.x - before.x) / length) * spot.radius }
    left.push({ x: spot.x + across.x, y: spot.y + across.y })
    right.push({ x: spot.x - across.x, y: spot.y - across.y })
  })
  right.reverse()
  const cap = (radius: number, to: { x: number; y: number }) =>
    `A${format(radius)} ${format(radius)} 0 0 0 ${format(to.x)} ${format(to.y)}`
  const leftEnd = left[left.length - 1]
  const rightEnd = right[right.length - 1]
  // Down one side, round the far end, back up the other and round the near end.
  return [
    `M${format(left[0].x)} ${format(left[0].y)}`,
    through(left),
    `L${format(leftEnd.x)} ${format(leftEnd.y)}`,
    cap(line[line.length - 1].radius, right[0]),
    through(right),
    `L${format(rightEnd.x)} ${format(rightEnd.y)}`,
    cap(first.radius, left[0]),
    "Z",
  ].join("")
}
