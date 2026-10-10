import { describe, expect, it } from "vitest"
import { inkPath, nextInkWeight } from "./ink"

// The numbers of a path, in order.
const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe("nextInkWeight", () => {
  it("grows heavier when the pointer slows, and lighter when it speeds up", () => {
    expect(nextInkWeight(0.5, 1, 16)).toBeGreaterThan(0.5)
    expect(nextInkWeight(0.5, 80, 16)).toBeLessThan(0.5)
  })

  it("moves a part of the way at a time, so the width does not jump", () => {
    const next = nextInkWeight(0.5, 200, 16)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(0.5)
  })

  it("follows a pen's pressure rather than its speed", () => {
    expect(nextInkWeight(0.5, 200, 16, 1)).toBeGreaterThan(0.5)
    expect(nextInkWeight(0.5, 1, 16, 0)).toBeLessThan(0.5)
  })
})

describe("inkPath", () => {
  it("draws nothing for no points, and a dot for one", () => {
    expect(inkPath([], 4)).toBe("")
    expect(inkPath([{ x: 10, y: 10 }], 4)).toMatch(/^M8 10a2 2 .*Z$/)
  })

  it("outlines a stroke as one closed shape around its line", () => {
    const path = inkPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], 4)
    expect(path).toMatch(/^M.*A.*A.*Z$/)
    const values = numbers(path)
    expect(values.every(Number.isFinite)).toBe(true)
  })

  it("is thicker where the ink is heavier", () => {
    const points = (w: number) => Array.from({ length: 21 }, (_, index) => ({ x: index * 10, y: 0, w }))
    // One side of a level stroke, up to the cap that turns it round: how far it stands off the
    // line is how thick the stroke is there.
    const reach = (path: string) =>
      Math.max(...numbers(path.split("A")[0]).filter((_, index) => index % 2 === 1).map(Math.abs))
    expect(reach(inkPath(points(1), 4))).toBeGreaterThan(reach(inkPath(points(0), 4)))
  })

  it("thins to its ends", () => {
    const points = Array.from({ length: 21 }, (_, index) => ({ x: index * 10, y: 0 }))
    const path = inkPath(points, 4)
    // It starts on the outline beside the first point, much closer to the line than half the width.
    const [, startY] = numbers(path)
    expect(Math.abs(startY)).toBeLessThan(1)
  })
})
