export type SyncOperation<TPayload = unknown> = {
  id: string
  scope: string
  clientId: string
  sequence: number
  entity: string
  entityId: string
  type: string
  payload: TPayload
  createdAt: number
  schemaVersion: number
}

export type SyncRemoteOperation<TPayload = unknown> = {
  operation: SyncOperation<TPayload>
  serverSequence: number
}

export type SyncConflict = {
  operationId: string
  entity: string
  entityId: string
  reason: string
}

export type SyncApplyContext = {
  source: "local" | "remote"
  serverSequence?: number
}

export type SyncApplyResult<TState> = {
  state: TState
  conflict?: SyncConflict
}

export type SyncDomain<TState> = {
  apply: (
    state: TState,
    operation: SyncOperation,
    context: SyncApplyContext,
  ) => SyncApplyResult<TState>
}

export type SyncRecord<TState> = {
  state: TState
  confirmedState: TState
  nextSequence: number
  cursor: number
  pending: SyncOperation[]
  acknowledgedOperationIds: string[]
  appliedOperationIds: string[]
  conflicts: SyncConflict[]
}

export type SyncTransactionResult<TState, TValue> = {
  record: SyncRecord<TState>
  value: TValue
}

export type SyncStore<TState> = {
  read: () => Promise<SyncRecord<TState>>
  transact: <TValue>(
    transaction: (
      record: SyncRecord<TState>,
    ) => SyncTransactionResult<TState, TValue>,
  ) => Promise<TValue>
}

export type SyncExchangeRequest = {
  scope: string
  clientId: string
  cursor: number
  operations: SyncOperation[]
}

export type SyncExchangeResponse = {
  acknowledgedOperationIds: string[]
  operations: SyncRemoteOperation[]
  cursor: number
  hasMore: boolean
}

export type SyncTransport = {
  exchange: (request: SyncExchangeRequest) => Promise<SyncExchangeResponse>
}

export type SyncStatus =
  | { state: "stopped"; pending: number }
  | { state: "idle"; pending: number; lastSyncedAt?: number }
  | { state: "syncing"; pending: number }
  | { state: "retrying"; pending: number; attempt: number; retryAt: number; error: unknown }
  | { state: "error"; pending: number; error: unknown }

export type SyncEngineSnapshot<TState> = {
  state: TState
  cursor: number
  pending: number
  conflicts: SyncConflict[]
  status: SyncStatus
}

export type SyncMutation<TPayload = unknown> = {
  entity: string
  entityId: string
  type: string
  payload: TPayload
  schemaVersion?: number
}

export type SyncRetryOptions = {
  initialDelayMs?: number
  maxDelayMs?: number
  maxAttempts?: number
}

export type SyncEngineOptions<TState> = {
  scope: string
  clientId: string
  store: SyncStore<TState>
  transport: SyncTransport
  domain: SyncDomain<TState>
  batchSize?: number
  retry?: SyncRetryOptions
  now?: () => number
  createOperationId?: () => string
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

export type SyncEngine<TState> = {
  start: () => Promise<void>
  stop: () => void
  mutate: <TPayload>(mutation: SyncMutation<TPayload>) => Promise<SyncOperation<TPayload>>
  sync: () => Promise<void>
  getSnapshot: () => Promise<SyncEngineSnapshot<TState>>
  subscribe: (listener: (snapshot: SyncEngineSnapshot<TState>) => void) => () => void
}

export class SyncTransportError extends Error {
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(message: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(message)
    this.name = "SyncTransportError"
    this.retryable = options?.retryable ?? true
    if (options?.cause !== undefined) this.cause = options.cause
  }
}
