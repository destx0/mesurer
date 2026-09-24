# Sync engine

Mesurer includes an opt-in, framework-independent sync engine. It is not started
by the `Mesurer` component and does not change the existing local persistence
path. Applications can use it to prepare account-backed synchronization while
keeping local-only use unchanged.

## Guarantees

- Local mutations update optimistic state before network access.
- Pending operations can be stored atomically in IndexedDB.
- Operation delivery is at least once; transports and servers must be idempotent.
- Acknowledgements only apply to operations sent by that request.
- Pulled operations are applied in authoritative server order.
- Pending optimistic operations are replayed over confirmed state.
- Cursors never move backwards.
- Retryable failures use bounded exponential backoff with jitter.
- Duplicate operations and lost acknowledgements do not duplicate state.
- Scope identifiers isolate workspaces or future accounts.

The engine does not choose conflict behavior. A domain owns deterministic
operation application and can report conflicts for the product to display.

## Client

```ts
import {
  createIndexedDbSyncStore,
  createRestSyncTransport,
  createSyncEngine,
  type SyncDomain,
} from "mesurer";

type State = Record<string, string>;

const domain: SyncDomain<State> = {
  apply(state, operation) {
    if (operation.type !== "note.updated") return { state };
    return {
      state: {
        ...state,
        [operation.entityId]: (operation.payload as { text: string }).text,
      },
    };
  },
};

const store = createIndexedDbSyncStore({
  recordKey: "workspace-123:device-456",
  scope: "workspace-123",
  clientId: "device-456",
  initialState: {},
});

const engine = createSyncEngine({
  scope: "workspace-123",
  clientId: "device-456",
  store,
  domain,
  transport: createRestSyncTransport({
    url: "/api/sync",
    headers: () => ({ authorization: `Bearer ${getAccessToken()}` }),
  }),
});

await engine.start();

await engine.mutate({
  entity: "note",
  entityId: "note-1",
  type: "note.updated",
  payload: { text: "Check this spacing" },
});
```

Use `createMemorySyncStore` and `createFakeSyncServer` for deterministic tests
or local development without a backend.

## Exchange protocol

The REST adapter sends a `POST` request containing one exchange:

```json
{
  "scope": "workspace-123",
  "clientId": "device-456",
  "cursor": 18,
  "operations": []
}
```

The server responds with acknowledgements and all scoped operations after the
cursor, ordered by `serverSequence`:

```json
{
  "acknowledgedOperationIds": [],
  "operations": [],
  "cursor": 18,
  "hasMore": false
}
```

The backend must:

- Authorize access to `scope` on every exchange.
- Persist each operation and assign its server sequence transactionally.
- Deduplicate by scope and operation ID.
- Reject an operation ID reused with different immutable content.
- Return the same successful result when an operation is retried.
- Keep cursors durable and monotonic.
- Return `hasMore: true` only when the response advances the cursor.
- Include accepted operations in subsequent cursor reads, including the
  requesting client's own operations.

Authentication, billing, account storage, and a production database are not
part of the engine. They belong to the application and backend adapters.
