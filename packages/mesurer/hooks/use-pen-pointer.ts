import { useCallback, useLayoutEffect, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react"
import { INK_WEIGHT, nextInkWeight, PEN_WIDTH } from "../core/ink"
import type { PenPoint, PenStroke, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

// Shorter than this along its whole length, a press was a click and not a stroke.
const MIN_STROKE_LENGTH = 4
// A sample this close to the last one kept adds nothing to the stroke.
const MIN_SAMPLE_DISTANCE = 1

// One reading of the pointer: where it is, when, and how hard a pen is pressed.
type Sample = { clientX: number; clientY: number; timeStamp: number; pressure: number; pointerType: string }

type UsePenPointerOptions = {
  enabled: boolean
  settingsOpen: boolean
  toolMode: ToolMode
  color: string
  scrollOffset: Point
  createActionCommit: () => () => void
  setPenStrokes: Dispatch<SetStateAction<PenStroke[]>>
  setPenPreview: Dispatch<SetStateAction<PenPoint[]>>
}

export const usePenPointer = ({
  enabled,
  settingsOpen,
  toolMode,
  color,
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
  } | null>(null)

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
    drawingRef.current = { pointerId: event.pointerId, points: [point], target: event.currentTarget, time: event.timeStamp, length: 0 }
    setPenPreview([point])
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [enabled, pagePoint, setPenPreview, settingsOpen, toolMode])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId || event.buttons === 0) return
    const count = drawing.points.length
    // Every reading the browser took since the last event, not only the last: a fast stroke is
    // drawn through all of them rather than cut straight across.
    const native = event.nativeEvent
    const samples = native.getCoalescedEvents?.() ?? []
    for (const sample of samples.length > 0 ? samples : [native]) addSample(sample)
    if (drawing.points.length !== count) setPenPreview([...drawing.points])
  }, [addSample, setPenPreview])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    addSample(event.nativeEvent, true)
    // By its length, not by how far its end is from its start: a loop ends where it began.
    if (drawing.length >= MIN_STROKE_LENGTH) {
      createActionCommit()()
      setPenStrokes((strokes) => [...strokes, { id: createId(), points: drawing.points, color, width: PEN_WIDTH }])
    }
    clearDrawing()
  }, [addSample, clearDrawing, color, createActionCommit, setPenStrokes])

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
