import { describe, expect, it } from "vitest"
import { erasePenStroke, isOnPenStroke } from "./pen-transform"
import type { PenStroke } from "./types"

const stroke = (rotation?: number): PenStroke => ({
  id: "stroke",
  color: "#000",
  width: 4,
  rotation,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
})

describe("isOnPenStroke", () => {
  it("is on a stroke within half its width, anywhere along it", () => {
    expect(isOnPenStroke(stroke(), { x: 50, y: 2 })).toBe(true)
    expect(isOnPenStroke(stroke(), { x: 50, y: 3 })).toBe(false)
    expect(isOnPenStroke(stroke(), { x: 110, y: 0 })).toBe(false)
  })

  it("reaches further when asked to", () => {
    expect(isOnPenStroke(stroke(), { x: 50, y: 9 }, 8)).toBe(true)
    expect(isOnPenStroke(stroke(), { x: 50, y: 11 }, 8)).toBe(false)
  })

  it("follows a stroke that was turned", () => {
    // Turned a quarter turn about its middle, it stands where x is 50.
    expect(isOnPenStroke(stroke(90), { x: 50, y: 40 })).toBe(true)
    expect(isOnPenStroke(stroke(90), { x: 90, y: 0 })).toBe(false)
  })
})

describe("erasePenStroke", () => {
  it("leaves a stroke it is not on alone", () => {
    expect(erasePenStroke(stroke(), { x: 50, y: 40 }, 8)).toBeNull()
  })

  it("takes a bite out of the middle, and leaves the two ends as strokes of their own", () => {
    const pieces = erasePenStroke(stroke(), { x: 50, y: 0 }, 8)!
    expect(pieces).toHaveLength(2)
    // The first is still the stroke it was. Each stops short of where the eraser was.
    expect(pieces[0].id).toBe("stroke")
    // What is left is the line as it was drawn, not to be smoothed again.
    expect(pieces.every((piece) => piece.fixed)).toBe(true)
    expect(pieces[1].id).not.toBe("stroke")
    expect(Math.max(...pieces[0].points.map((point) => point.x))).toBeLessThan(41)
    expect(Math.min(...pieces[1].points.map((point) => point.x))).toBeGreaterThan(59)
    expect(pieces[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(pieces[1].points[pieces[1].points.length - 1]).toEqual({ x: 100, y: 0 })
  })

  it("shortens a stroke rubbed at its end, and leaves nothing of one rubbed out whole", () => {
    const pieces = erasePenStroke(stroke(), { x: 100, y: 0 }, 8)!
    expect(pieces).toHaveLength(1)
    expect(Math.max(...pieces[0].points.map((point) => point.x))).toBeLessThan(91)
    expect(erasePenStroke({ ...stroke(), points: [{ x: 0, y: 0 }, { x: 6, y: 0 }] }, { x: 3, y: 0 }, 8)).toEqual([])
  })

  it("leaves the pieces of a turned stroke where they were, no longer turned", () => {
    // Turned a quarter turn about its middle, the stroke stands where x is 50.
    const pieces = erasePenStroke(stroke(90), { x: 50, y: 0 }, 8)!
    expect(pieces).toHaveLength(2)
    for (const piece of pieces) {
      expect(piece.rotation).toBeUndefined()
      for (const point of piece.points) expect(point.x).toBeCloseTo(50, 5)
    }
  })
})

