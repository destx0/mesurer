import { describe, expect, it } from "vitest"
import { isOnPenStroke } from "./pen-transform"
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
