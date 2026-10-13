import { describe, expect, it } from "vitest"
import { colorToHex, parseCssColor } from "../core/colors"
import { colorToPicked, pickedToColor } from "./color-picker"

const picked = (hex: string) => colorToPicked(parseCssColor(hex)!)

describe("colorToPicked", () => {
  it("reads a colour's hue, strength, brightness and how solid it is", () => {
    expect(picked("#ff0000")).toEqual({ hue: 0, saturation: 1, value: 1, alpha: 1 })
    expect(picked("#00ff00").hue).toBe(120)
    expect(picked("#0000ff").hue).toBe(240)
    expect(picked("#ff00ff").hue).toBe(300)
    expect(picked("#000000")).toMatchObject({ saturation: 0, value: 0 })
    expect(picked("#ffffff")).toMatchObject({ saturation: 0, value: 1 })
    expect(picked("#facc1566").alpha).toBeCloseTo(0.4, 2)
  })
})

describe("pickedToColor", () => {
  it("gives back the colour it was read from", () => {
    for (const hex of ["#ef4444", "#f97316", "#facc15", "#22c55e", "#0d99ff", "#a855f7", "#111827", "#ffffff", "#facc1566"]) {
      expect(colorToHex(pickedToColor(picked(hex)))).toBe(hex)
    }
  })

  it("keeps a hue through grey and black, where a colour alone has none", () => {
    expect(colorToHex(pickedToColor({ hue: 200, saturation: 0, value: 0.5, alpha: 1 }))).toBe("#808080")
    expect(colorToHex(pickedToColor({ hue: 200, saturation: 1, value: 0, alpha: 1 }))).toBe("#000000")
  })
})
