import { useState } from "react"
import type { PenPoint, PenStroke } from "../core/types"

export const usePenState = (initialStrokes?: PenStroke[], initialSelectedIds: string[] = []) => {
  const [penStrokes, setPenStrokes] = useState<PenStroke[]>(initialStrokes ?? [])
  const [selectedPenStrokeIds, setSelectedPenStrokeIds] = useState<string[]>(initialSelectedIds)
  const [penPreview, setPenPreview] = useState<PenPoint[]>([])

  return { penStrokes, setPenStrokes, selectedPenStrokeIds, setSelectedPenStrokeIds, penPreview, setPenPreview }
}
