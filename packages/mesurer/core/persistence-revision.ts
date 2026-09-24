export type PersistenceRevision = {
  counter: number
  writerId: string
  mutationId: string
}

export const isPersistenceRevision = (value: unknown): value is PersistenceRevision => {
  if (!value || typeof value !== "object") return false
  const revision = value as Record<string, unknown>
  return Number.isSafeInteger(revision.counter) &&
    (revision.counter as number) >= 0 &&
    typeof revision.writerId === "string" &&
    typeof revision.mutationId === "string"
}

export const createWriterId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export const compareRevisions = (
  left: PersistenceRevision | undefined,
  right: PersistenceRevision | undefined,
) => {
  if (!left && !right) return 0
  if (!left) return -1
  if (!right) return 1
  if (left.counter !== right.counter) return left.counter - right.counter
  const leftKey = `${left.mutationId}\u0000${left.writerId}`
  const rightKey = `${right.mutationId}\u0000${right.writerId}`
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}

export const latestRevision = (...revisions: Array<PersistenceRevision | undefined>) =>
  revisions.reduce<PersistenceRevision | undefined>(
    (latest, revision) => compareRevisions(revision, latest) > 0 ? revision : latest,
    undefined,
  )

export const createNextRevision = (
  previous: PersistenceRevision | undefined,
  writerId: string,
): PersistenceRevision => ({
  counter: (previous?.counter ?? 0) + 1,
  writerId,
  mutationId: createWriterId(),
})
