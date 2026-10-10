import { useCallback, useLayoutEffect, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react"
import { ERASER_RADIUS, INK_WEIGHT, nextInkWeight, type PenInHand } from "../core/ink"
import { isOnPenStroke } from "../core/pen-transform"
import type { PenPoint, PenStroke, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

// Shorter than this along its whole length, a press was a click and not a stroke.
const MIN_STROKE_LENGTH = 4
// A sample this close to the last one kept adds nothing to the stroke.
const MIN_SAMPLE_DISTANCE = 1

// How close together the eraser is tried along the way the pointer came, so that a quick pass
// does not step over a thin stroke.
const ERASER_STEP = 4

// One reading of the pointer: where it is, when, and how hard a pen is pressed.
type Sample = { clientX: number; clientY: number; timeStamp: number; pressure: number; pointerType: string }

type UsePenPointerOptions = {
  enabled: boolean
  settingsOpen: boolean
  toolMode: ToolMode
  /** The pen in hand, as it is set. */
  pen: PenInHand
  /** The eraser is in hand instead: a press rubs out the strokes it passes over. */
  eraser: boolean
  penStrokes: PenStroke[]
  scrollOffset: Point
  createActionCommit: () => () => void
  setPenStrokes: Dispatch<SetStateAction<PenStroke[]>>
  setPenPreview: Dispatch<SetStateAction<PenPoint[]>>
}

export const usePenPointer = ({
  enabled,
  settingsOpen,
  toolMode,
  pen,
  eraser,
  penStrokes,
  scrollOffset,
  createActionCommit,
  setPenStrokes,
  setPenPreview,
}: UsePenPointerOptions) => {
  const drawingRef = useRef<{
    pointerId: number
    points: PenPoint[]
    target: HTMLDivElement
    // When the last point was taken, and how long the stroke is so far.
    time: number
    length: number
    // With the eraser: records the strokes as they were, once, before the first is rubbed out.
    commit?: () => void
  } | null>(null)
  // The strokes as they are now, the ones rubbed out in this press already gone.
  const strokesRef = useRef(penStrokes)
  strokesRef.current = penStrokes

  const pagePoint = useCallback((sample: { clientX: number; clientY: number }): Point => ({
    x: sample.clientX + scrollOffset.x,
    y: sample.clientY + scrollOffset.y,
  }), [scrollOffset])

  // Adds a reading to the stroke being drawn, with the weight the ink has there. `last` keeps it
  // however close it is to the one before, so the stroke ends where the pointer was let go.
  const addSample = useCallback((sample: Sample, last = false) => {
    const drawing = drawingRef.current
    if (!drawing) return
    const point = pagePoint(sample)
    const previous = drawing.points[drawing.points.length - 1]
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (distance < (last ? Number.MIN_VALUE : MIN_SAMPLE_DISTANCE)) return
    const w = nextInkWeight(
      previous.w ?? INK_WEIGHT,
      distance,
      sample.timeStamp - drawing.time,
      // Only a pen says how hard it is pressed: a mouse and a finger report a fixed value.
      sample.pointerType === "pen" ? sample.pressure : undefined,
    )
    drawing.points.push({ ...point, w })
    drawing.time = sample.timeStamp
    drawing.length += distance
  }, [pagePoint])

  // Rubs out every stroke between the last place the eraser was and this one. All of a press is
  // undone as one step.
  const erase = useCallback((sample: { clientX: number; clientY: number }) => {
    const drawing = drawingRef.current
    if (!drawing) return
    const from = drawing.points[drawing.points.length - 1]
    const to = pagePoint(sample)
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / ERASER_STEP))
    let kept = strokesRef.current
    for (let step = 1; step <= steps; step++) {
      const at = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }
      kept = kept.filter((stroke) => !isOnPenStroke(stroke, at, ERASER_RADIUS))
    }
    drawing.points = [to]
    if (kept.length === strokesRef.current.length) return
    drawing.commit?.()
    const gone = new Set(strokesRef.current.filter((stroke) => !kept.includes(stroke)).map((stroke) => stroke.id))
    strokesRef.current = kept
    setPenStrokes((strokes) => strokes.filter((stroke) => !gone.has(stroke.id)))
  }, [pagePoint, setPenStrokes])

  const clearDrawing = useCallback(() => {
    const drawing = drawingRef.current
    if (drawing?.target.hasPointerCapture(drawing.pointerId)) {
      drawing.target.releasePointerCapture(drawing.pointerId)
    }
    drawingRef.current = null
    setPenPreview([])
  }, [setPenPreview])

  useLayoutEffect(() => {
    if (toolMode !== "pen") clearDrawing()
  }, [clearDrawing, toolMode])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || settingsOpen || toolMode !== "pen" || event.button !== 0) return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    event.stopPropagation()
    const point = { ...pagePoint(event), w: INK_WEIGHT }
    drawingRef.current = {
      pointerId: event.pointerId,
      points: [point],
      target: event.currentTarget,
      time: event.timeStamp,
      length: 0,
      commit: eraser ? createActionCommit() : undefined,
    }
    setPenPreview([point])
    event.currentTarget.setPointerCapture(event.pointerId)
    // A press with the eraser rubs out what is under it, before it has moved at all.
    if (eraser) erase(event)
  }, [createActionCommit, enabled, erase, eraser, pagePoint, setPenPreview, settingsOpen, toolMode])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId || event.buttons === 0) return
    if (drawing.commit) {
      erase(event)
      // Where the eraser is, for the ring drawn round it.
      setPenPreview(drawing.points)
      return
    }
    const count = drawing.points.length
    // Every reading the browser took since the last event, not only the last: a fast stroke is
    // drawn through all of them rather than cut straight across.
    const native = event.nativeEvent
    const samples = native.getCoalescedEvents?.() ?? []
    for (const sample of samples.length > 0 ? samples : [native]) addSample(sample)
    if (drawing.points.length !== count) setPenPreview([...drawing.points])
  }, [addSample, erase, setPenPreview])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (drawing.commit) {
      erase(event)
      clearDrawing()
      return
    }
    addSample(event.nativeEvent, true)
    // By its length, not by how far its end is from its start: a loop ends where it began.
    if (drawing.length >= MIN_STROKE_LENGTH) {
      createActionCommit()()
      setPenStrokes((strokes) => [...strokes, { id: createId(), ...pen, points: drawing.points }])
    }
    clearDrawing()
  }, [addSample, clearDrawing, createActionCommit, erase, pen, setPenStrokes])

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (drawingRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    clearDrawing()
  }, [clearDrawing])

  const handlePointerLeave = useCallback(() => undefined, [])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    cancelInteraction: clearDrawing,
    hasActiveInteraction: () => Boolean(drawingRef.current),
  }
}
