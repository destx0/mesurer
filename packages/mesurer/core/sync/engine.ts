import type {
  SyncEngine,
  SyncEngineOptions,
  SyncEngineSnapshot,
  SyncOperation,
  SyncRecord,
  SyncStatus,
} from "./types"
import { SyncTransportError } from "./types"

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_INITIAL_RETRY_MS = 500
const DEFAULT_MAX_RETRY_MS = 30_000
const DEFAULT_MAX_ATTEMPTS = 8
const MAX_APPLIED_OPERATION_IDS = 10_000

const defaultOperationId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const pendingCount = <TState>(record: SyncRecord<TState>) => record.pending.length

export const createSyncEngine = <TState>({
  scope,
  clientId,
  store,
  transport,
  domain,
  batchSize = DEFAULT_BATCH_SIZE,
  retry,
  now = Date.now,
  createOperationId = defaultOperationId,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: SyncEngineOptions<TState>): SyncEngine<TState> => {
  if (!scope) throw new Error("Sync scope is required")
  if (!clientId) throw new Error("Sync client ID is required")
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Sync batch size must be a positive integer")
  }
  const initialRetryMs = retry?.initialDelayMs ?? DEFAULT_INITIAL_RETRY_MS
  const maxRetryMs = retry?.maxDelayMs ?? DEFAULT_MAX_RETRY_MS
  const maxAttempts = retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  if (initialRetryMs < 0 || maxRetryMs < initialRetryMs || maxAttempts < 0) {
    throw new Error("Invalid sync retry options")
  }

  const listeners = new Set<(snapshot: SyncEngineSnapshot<TState>) => void>()
  let status: SyncStatus = { state: "stopped", pending: 0 }
  let running = false
  let lifecycleGeneration = 0
  let syncPromise: Promise<void> | null = null
  let syncRequested = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAttempt = 0
  let lastSyncedAt: number | undefined

  const snapshot = async (): Promise<SyncEngineSnapshot<TState>> => {
    const record = await store.read()
    return {
      state: record.state,
      cursor: record.cursor,
      pending: pendingCount(record),
      conflicts: record.conflicts,
      status,
    }
  }

  const emit = async () => {
    if (listeners.size === 0) return
    const current = await snapshot()
    for (const listener of listeners) {
      try {
        listener(current)
      } catch {
        // Observers cannot be allowed to interrupt durable sync work.
      }
    }
  }

  const updateStatus = async (next: SyncStatus, generation = lifecycleGeneration) => {
    if (generation !== lifecycleGeneration) return
    status = next
    await emit()
  }

  const cancelRetry = () => {
    if (retryTimer === null) return
    clearTimer(retryTimer)
    retryTimer = null
  }

  const scheduleRetry = async (error: unknown, generation: number) => {
    const record = await store.read()
    retryAttempt += 1
    if (!running || generation !== lifecycleGeneration || retryAttempt > maxAttempts) {
      await updateStatus({ state: "error", pending: pendingCount(record), error }, generation)
      return
    }
    const exponentialDelay = Math.min(maxRetryMs, initialRetryMs * 2 ** (retryAttempt - 1))
    const delay = Math.round(exponentialDelay * (0.75 + Math.random() * 0.5))
    await updateStatus({
      state: "retrying",
      pending: pendingCount(record),
      attempt: retryAttempt,
      retryAt: now() + delay,
      error,
    }, generation)
    if (!running || generation !== lifecycleGeneration) return
    retryTimer = setTimer(() => {
      retryTimer = null
      void synchronize().catch(() => {})
    }, delay)
  }

  const rebuildOptimisticState = (
    confirmedState: TState,
    pending: SyncOperation[],
  ) => pending.reduce(
    (state, operation) => domain.apply(state, operation, { source: "local" }).state,
    confirmedState,
  )

  const exchangeOnce = async () => {
    const before = await store.read()
    const acknowledgedBefore = new Set(before.acknowledgedOperationIds)
    const submitted = before.pending
      .filter((operation) => !acknowledgedBefore.has(operation.id))
      .slice(0, batchSize)
    const submittedIds = new Set(submitted.map((operation) => operation.id))
    const response = await transport.exchange({
      scope,
      clientId,
      cursor: before.cursor,
      operations: submitted,
    })
    if (response.cursor < before.cursor) {
      throw new SyncTransportError("Sync transport returned a stale cursor", { retryable: false })
    }
    if (response.hasMore && response.cursor === before.cursor) {
      throw new SyncTransportError("Sync transport did not advance a paginated cursor")
    }

    const outcome = await store.transact((record) => {
      const acceptedAcknowledgements = response.acknowledgedOperationIds.filter(
        (id) => submittedIds.has(id),
      )
      const acknowledged = new Set([
        ...record.acknowledgedOperationIds,
        ...acceptedAcknowledgements,
      ])
      const applied = new Set(record.appliedOperationIds)
      const observed = new Set<string>()
      let confirmedState = record.confirmedState
      const conflicts = [...record.conflicts]
      const remote = [...response.operations].sort(
        (left, right) => left.serverSequence - right.serverSequence,
      )

      for (const item of remote) {
        if (item.operation.scope !== scope) {
          throw new SyncTransportError("Sync transport returned an operation for another scope", {
            retryable: false,
          })
        }
        if (item.serverSequence > response.cursor) {
          throw new SyncTransportError("Sync transport returned an operation beyond its cursor", {
            retryable: false,
          })
        }
        if (item.serverSequence <= record.cursor || applied.has(item.operation.id)) continue
        const result = domain.apply(confirmedState, item.operation, {
          source: "remote",
          serverSequence: item.serverSequence,
        })
        confirmedState = result.state
        applied.add(item.operation.id)
        observed.add(item.operation.id)
        if (result.conflict) conflicts.push(result.conflict)
      }

      // Some transports acknowledge submitted operations without echoing them in
      // the pull result. Confirm those operations so they are not retried forever.
      for (const id of acceptedAcknowledgements) {
        if (observed.has(id)) continue
        const operation = record.pending.find((candidate) => candidate.id === id)
        if (!operation) continue
        const result = domain.apply(confirmedState, operation, { source: "remote" })
        confirmedState = result.state
        applied.add(id)
        observed.add(id)
        if (result.conflict) conflicts.push(result.conflict)
      }

      const pending = record.pending.filter((operation) => !observed.has(operation.id))
      for (const id of observed) acknowledged.delete(id)
      const cursor = Math.max(record.cursor, response.cursor)
      const state = rebuildOptimisticState(confirmedState, pending)
      const unacknowledgedPending = pending.filter(
        (operation) => !acknowledged.has(operation.id),
      ).length
      const progressed = cursor > record.cursor || acceptedAcknowledgements.length > 0 || observed.size > 0

      return {
        record: {
          ...record,
          state,
          confirmedState,
          cursor,
          pending,
          acknowledgedOperationIds: [...acknowledged],
          appliedOperationIds: [...applied].slice(-MAX_APPLIED_OPERATION_IDS),
          conflicts,
        },
        value: { unacknowledgedPending, progressed },
      }
    })

    if (outcome.unacknowledgedPending > 0 && !outcome.progressed) {
      throw new SyncTransportError("Sync transport made no progress")
    }
    return response.hasMore || outcome.unacknowledgedPending > 0
  }

  const synchronize = () => {
    syncRequested = true
    if (syncPromise) return syncPromise
    cancelRetry()
    const generation = lifecycleGeneration
    syncPromise = (async () => {
      let completed = false
      try {
        while (true) {
          syncRequested = false
          const before = await store.read()
          await updateStatus({ state: "syncing", pending: pendingCount(before) }, generation)
          let hasMore = true
          while (hasMore) hasMore = await exchangeOnce()
          retryAttempt = 0
          lastSyncedAt = now()
          const after = await store.read()
          await updateStatus({
            state: running ? "idle" : "stopped",
            pending: pendingCount(after),
            ...(running ? { lastSyncedAt } : {}),
          }, generation)
          if (!syncRequested || generation !== lifecycleGeneration) break
        }
        completed = true
      } catch (error) {
        if (error instanceof SyncTransportError && !error.retryable) {
          const current = await store.read()
          await updateStatus({ state: "error", pending: pendingCount(current), error }, generation)
        } else {
          await scheduleRetry(error, generation)
        }
        throw error
      } finally {
        syncPromise = null
        if (completed && syncRequested && running && generation === lifecycleGeneration) {
          void synchronize().catch(() => {})
        }
      }
    })()
    return syncPromise
  }

  return {
    start: async () => {
      if (running) return
      running = true
      lifecycleGeneration += 1
      const generation = lifecycleGeneration
      const record = await store.read()
      await updateStatus({ state: "idle", pending: pendingCount(record) }, generation)
      await synchronize().catch(() => {})
    },
    stop: () => {
      running = false
      lifecycleGeneration += 1
      cancelRetry()
      const generation = lifecycleGeneration
      void store.read().then((record) => updateStatus({
        state: "stopped",
        pending: pendingCount(record),
      }, generation))
    },
    mutate: async <TPayload>({
      entity,
      entityId,
      type,
      payload,
      schemaVersion = 1,
    }: {
      entity: string
      entityId: string
      type: string
      payload: TPayload
      schemaVersion?: number
    }) => {
      const operation = await store.transact((record) => {
        const next: SyncOperation<TPayload> = {
          id: createOperationId(),
          scope,
          clientId,
          sequence: record.nextSequence,
          entity,
          entityId,
          type,
          payload,
          createdAt: now(),
          schemaVersion,
        }
        if (
          record.appliedOperationIds.includes(next.id) ||
          record.pending.some((item) => item.id === next.id)
        ) {
          throw new Error(`Sync operation ID already exists: ${next.id}`)
        }
        const result = domain.apply(record.state, next, { source: "local" })
        return {
          record: {
            ...record,
            state: result.state,
            nextSequence: record.nextSequence + 1,
            pending: [...record.pending, next],
            conflicts: result.conflict
              ? [...record.conflicts, result.conflict]
              : record.conflicts,
          },
          value: next,
        }
      })
      const record = await store.read()
      await updateStatus({
        state: running ? "idle" : "stopped",
        pending: pendingCount(record),
        ...(running && lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
      })
      if (running) void synchronize().catch(() => {})
      return operation
    },
    sync: synchronize,
    getSnapshot: snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
