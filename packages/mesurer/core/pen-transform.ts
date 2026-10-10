import { smoothInkPoints } from "./ink"
import type { PenPoint, PenStroke, Point } from "./types"
import { createId } from "./utils"
import { boxCenter, rotatePoint, rotationFromPointer, type ResizeHandle } from "./text-transform"
import { boundsFromPoints, resizeGeometry, resizePoint, rotatedBounds } from "./transform-geometry"

export type PenBounds = { x: number; y: number; width: number; height: number }

export const penBounds = (stroke: PenStroke): PenBounds => {
  return boundsFromPoints(stroke.points)
}

export const transformedPenBounds = (stroke: PenStroke): PenBounds => {
  return rotatedBounds(penBounds(stroke), stroke.rotation ?? 0)
}

export const movePenStroke = (stroke: PenStroke, dx: number, dy: number): PenStroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
})

export const resizePenStroke = (stroke: PenStroke, handle: ResizeHandle, pointer: Point): PenStroke => {
  const box = penBounds(stroke)
  const rotation = stroke.rotation ?? 0
  const geometry = resizeGeometry(box, rotation, handle, pointer)
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point, ...resizePoint(point, geometry) })),
    rotation,
  }
}

export const rotatePenStroke = (stroke: PenStroke, pointer: Point, offset: number): PenStroke => {
  const box = penBounds(stroke)
  const center = boxCenter(box.x, box.y, box.width, box.height)
  const nextRotation = rotationFromPointer(center, pointer) - offset
  return {
    ...stroke,
    rotation: nextRotation,
  }
}

export const rotatePenStrokeAround = (
  stroke: PenStroke,
  center: Point,
  degrees: number,
): PenStroke => {
  const box = penBounds(stroke)
  const strokeCenter = boxCenter(box.x, box.y, box.width, box.height)
  const rotation = stroke.rotation ?? 0
  const nextCenter = rotatePoint(strokeCenter, center, degrees)
  const nextRotation = rotation + degrees
  const rotated = stroke.points.map((point) => ({
    ...point,
    ...rotatePoint(rotatePoint(rotatePoint(point, strokeCenter, rotation), center, degrees), nextCenter, -nextRotation),
  }))
  return {
    ...stroke,
    points: rotated,
    rotation: nextRotation,
  }
}

// How far a point is from the line between two others.
const distanceToSegment = (point: Point, from: Point, to: Point) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = dx * dx + dy * dy
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length))
  return Math.hypot(point.x - from.x - dx * along, point.y - from.y - dy * along)
}

/** Whether a point is on a stroke, or within `reach` of it. */
export const isOnPenStroke = (stroke: PenStroke, point: Point, reach = 0): boolean => {
  const box = penBounds(stroke)
  // The stroke's points are kept as drawn, and turned when it is: the point is turned back.
  const local = stroke.rotation ? rotatePoint(point, boxCenter(box.x, box.y, box.width, box.height), -stroke.rotation) : point
  const within = stroke.width / 2 + reach
  if (local.x < box.x - within || local.x > box.x + box.width + within || local.y < box.y - within || local.y > box.y + box.height + within) return false
  return stroke.points.some((from, index) => distanceToSegment(local, from, stroke.points[index + 1] ?? from) <= within)
}

// A stroke's points are looked at this close together when part of it is rubbed out, so the
// eraser takes a bite its own size out of a stroke drawn fast, with its points far apart.
const ERASE_SPACING = 2

/**
 * A stroke with what is within `reach` of a point rubbed out of it: the pieces left, each a
 * stroke of its own, or none if nothing is. It is null when the point is not on the stroke.
 * The pieces are cut from the line as it is drawn, smoothed, and keep it: were they smoothed
 * again from their own points, what is left of the stroke would shift as the first bite is taken.
 */
export const erasePenStroke = (stroke: PenStroke, at: Point, reach: number): PenStroke[] | null => {
  if (!isOnPenStroke(stroke, at, reach)) return null
  const box = penBounds(stroke)
  const center = boxCenter(box.x, box.y, box.width, box.height)
  const rotation = stroke.rotation ?? 0
  const within = stroke.width / 2 + reach
  const pieces: PenPoint[][] = [[]]
  const visit = (point: PenPoint) => {
    // Where the point is on the page. The pieces are kept that way, not turned: each would
    // otherwise turn about a middle of its own, and move.
    const placed = rotation ? { ...point, ...rotatePoint(point, center, rotation) } : point
    if (Math.hypot(placed.x - at.x, placed.y - at.y) > within) pieces[pieces.length - 1].push(placed)
    else if (pieces[pieces.length - 1].length > 0) pieces.push([])
  }
  const line = stroke.fixed ? stroke.points : smoothInkPoints(stroke.points)
  line.forEach((point, index) => {
    const previous = line[index - 1]
    if (previous) {
      const steps = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / ERASE_SPACING)
      for (let step = 1; step < steps; step++) {
        const t = step / steps
        visit({
          x: previous.x + (point.x - previous.x) * t,
          y: previous.y + (point.y - previous.y) * t,
          ...(previous.w === undefined || point.w === undefined ? null : { w: Math.round((previous.w + (point.w - previous.w) * t) * 100) / 100 }),
        })
      }
    }
    visit(point)
  })
  return pieces
    .filter((points) => points.length > 1)
    // The first piece is still the stroke it was; the others are new.
    .map((points, index) => ({ ...stroke, id: index === 0 ? stroke.id : createId(), rotation: undefined, fixed: true, points }))
}

