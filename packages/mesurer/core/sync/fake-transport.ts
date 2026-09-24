import type {
  SyncExchangeRequest,
  SyncExchangeResponse,
  SyncOperation,
  SyncRemoteOperation,
  SyncTransport,
} from "./types"
import { SyncTransportError } from "./types"

type StoredOperation = SyncRemoteOperation & { scope: string }

export type FakeSyncServerOptions = {
  pullBatchSize?: number
}

export type FakeSyncServer = {
  createTransport: () => SyncTransport
  setOnline: (online: boolean) => void
  failNext: (count?: number) => void
  append: (operation: SyncOperation) => void
  getOperations: (scope: string) => SyncRemoteOperation[]
}

export const createFakeSyncServer = ({
  pullBatchSize = 100,
}: FakeSyncServerOptions = {}): FakeSyncServer => {
  if (!Number.isInteger(pullBatchSize) || pullBatchSize <= 0) {
    throw new Error("Fake sync server pull batch size must be a positive integer")
  }
  const operations: StoredOperation[] = []
  const operationsById = new Map<string, SyncOperation>()
  let nextServerSequence = 1
  let online = true
  let remainingFailures = 0

  const append = (operation: SyncOperation) => {
    const key = `${operation.scope}\u0000${operation.id}`
    const existing = operationsById.get(key)
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(operation)) {
        throw new SyncTransportError("Sync operation ID collision", { retryable: false })
      }
      return
    }
    operationsById.set(key, structuredClone(operation))
    operations.push({
      operation: structuredClone(operation),
      serverSequence: nextServerSequence,
      scope: operation.scope,
    })
    nextServerSequence += 1
  }

  const exchange = async (request: SyncExchangeRequest): Promise<SyncExchangeResponse> => {
    if (!online) throw new SyncTransportError("Fake sync server is offline")
    if (remainingFailures > 0) {
      remainingFailures -= 1
      throw new SyncTransportError("Injected sync failure")
    }

    for (const operation of request.operations) {
      if (operation.scope !== request.scope) {
        throw new SyncTransportError("Cannot push an operation to another scope", {
          retryable: false,
        })
      }
      append(operation)
    }

    const available = operations
      .filter((item) => item.scope === request.scope && item.serverSequence > request.cursor)
      .slice(0, pullBatchSize)
    const cursor = available.length > 0
      ? available[available.length - 1].serverSequence
      : request.cursor
    const hasMore = operations.some(
      (item) => item.scope === request.scope && item.serverSequence > cursor,
    )
    return {
      acknowledgedOperationIds: request.operations.map((operation) => operation.id),
      operations: structuredClone(available),
      cursor,
      hasMore,
    }
  }

  return {
    createTransport: () => ({ exchange }),
    setOnline: (next) => {
      online = next
    },
    failNext: (count = 1) => {
      remainingFailures += count
    },
    append,
    getOperations: (scope) => structuredClone(
      operations.filter((item) => item.scope === scope),
    ),
  }
}
