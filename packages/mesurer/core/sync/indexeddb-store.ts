import type { SyncRecord, SyncStore, SyncTransactionResult } from "./types"

const DATABASE_VERSION = 1
const OBJECT_STORE = "sync-records"
const RECORD_VERSION = 1

type StoredSyncRecord<TState> = {
  version: number
  scope: string
  clientId: string
  record: SyncRecord<TState>
}

export type IndexedDbSyncStoreOptions<TState> = {
  databaseName?: string
  recordKey: string
  scope: string
  clientId: string
  initialState: TState
  indexedDB?: IDBFactory
}

export type IndexedDbSyncStore<TState> = SyncStore<TState> & {
  close: () => Promise<void>
  deleteDatabase: () => Promise<void>
}

const clone = <T>(value: T): T => structuredClone(value)

const initialRecord = <TState>(state: TState): SyncRecord<TState> => ({
  state: clone(state),
  confirmedState: clone(state),
  nextSequence: 1,
  cursor: 0,
  pending: [],
  acknowledgedOperationIds: [],
  appliedOperationIds: [],
  conflicts: [],
})

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result), { once: true })
  request.addEventListener("error", () => reject(request.error), { once: true })
})

const transactionComplete = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true })
  transaction.addEventListener("abort", () => reject(transaction.error), { once: true })
  transaction.addEventListener("error", () => reject(transaction.error), { once: true })
})

export const createIndexedDbSyncStore = <TState>({
  databaseName = "mesurer-sync",
  recordKey,
  scope,
  clientId,
  initialState,
  indexedDB = globalThis.indexedDB,
}: IndexedDbSyncStoreOptions<TState>): IndexedDbSyncStore<TState> => {
  if (!indexedDB) throw new Error("IndexedDB is unavailable")
  if (!recordKey || !scope || !clientId) {
    throw new Error("IndexedDB sync store requires a record key, scope, and client ID")
  }
  let databasePromise: Promise<IDBDatabase> | null = null
  let operationQueue = Promise.resolve()

  const enqueue = <T>(operation: () => Promise<T>) => {
    const result = operationQueue.then(operation, operation)
    operationQueue = result.then(() => undefined, () => undefined)
    return result
  }

  const getDatabase = () => {
    if (databasePromise) return databasePromise
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, DATABASE_VERSION)
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
          request.result.createObjectStore(OBJECT_STORE)
        }
      })
      request.addEventListener("success", () => {
        const database = request.result
        database.addEventListener("versionchange", () => {
          database.close()
          databasePromise = null
        })
        resolve(database)
      }, { once: true })
      request.addEventListener("error", () => {
        databasePromise = null
        reject(request.error)
      }, { once: true })
    })
    return databasePromise
  }

  const readStoredRecord = async () => {
    const database = await getDatabase()
    const transaction = database.transaction(OBJECT_STORE, "readonly")
    const stored = await requestResult(
      transaction.objectStore(OBJECT_STORE).get(recordKey),
    ) as StoredSyncRecord<TState> | undefined
    await transactionComplete(transaction)
    if (!stored) return initialRecord(initialState)
    if (stored.version !== RECORD_VERSION) {
      throw new Error(`Unsupported sync record version: ${stored.version}`)
    }
    if (stored.scope !== scope || stored.clientId !== clientId) {
      throw new Error("IndexedDB sync record identity does not match the requested scope")
    }
    return clone(stored.record)
  }

  return {
    read: () => enqueue(readStoredRecord),
    transact: <TValue>(
      operation: (record: SyncRecord<TState>) => SyncTransactionResult<TState, TValue>,
    ) => enqueue(async () => {
      const database = await getDatabase()
      const transaction = database.transaction(OBJECT_STORE, "readwrite")
      const objectStore = transaction.objectStore(OBJECT_STORE)
      try {
        const stored = await requestResult(objectStore.get(recordKey)) as
          | StoredSyncRecord<TState>
          | undefined
        if (stored && stored.version !== RECORD_VERSION) {
          throw new Error(`Unsupported sync record version: ${stored.version}`)
        }
        if (stored && (stored.scope !== scope || stored.clientId !== clientId)) {
          throw new Error("IndexedDB sync record identity does not match the requested scope")
        }
        const current = stored?.record ?? initialRecord(initialState)
        const result = operation(clone(current))
        objectStore.put({
          version: RECORD_VERSION,
          scope,
          clientId,
          record: clone(result.record),
        }, recordKey)
        await transactionComplete(transaction)
        return result.value
      } catch (error) {
        try {
          transaction.abort()
        } catch {
          // The transaction may already have aborted after a request failure.
        }
        throw error
      }
    }),
    close: () => enqueue(async () => {
      const database = await databasePromise
      database?.close()
      databasePromise = null
    }),
    deleteDatabase: () => enqueue(async () => {
      const database = await databasePromise
      database?.close()
      databasePromise = null
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName)
        request.addEventListener("success", () => resolve(), { once: true })
        request.addEventListener("error", () => reject(request.error), { once: true })
        request.addEventListener("blocked", () => {
          reject(new Error(`IndexedDB deletion blocked: ${databaseName}`))
        }, { once: true })
      })
    }),
  }
}
