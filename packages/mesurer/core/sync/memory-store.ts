import type { SyncRecord, SyncStore, SyncTransactionResult } from "./types"

const clone = <T>(value: T): T => structuredClone(value)

export const createMemorySyncStore = <TState>(initialState: TState): SyncStore<TState> => {
  let record: SyncRecord<TState> = {
    state: clone(initialState),
    confirmedState: clone(initialState),
    nextSequence: 1,
    cursor: 0,
    pending: [],
    acknowledgedOperationIds: [],
    appliedOperationIds: [],
    conflicts: [],
  }
  let transactionQueue = Promise.resolve()

  return {
    read: async () => {
      await transactionQueue
      return clone(record)
    },
    transact: async <TValue>(
      transaction: (
        current: SyncRecord<TState>,
      ) => SyncTransactionResult<TState, TValue>,
    ) => {
      let resolveResult: (value: TValue) => void
      let rejectResult: (reason: unknown) => void
      const result = new Promise<TValue>((resolve, reject) => {
        resolveResult = resolve
        rejectResult = reject
      })
      transactionQueue = transactionQueue.then(async () => {
        try {
          const next = transaction(clone(record))
          record = clone(next.record)
          resolveResult(next.value)
        } catch (error) {
          rejectResult(error)
        }
      })
      return result
    },
  }
}
