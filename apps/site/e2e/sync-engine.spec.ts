import { expect, test } from "@playwright/test";
import type { SyncTestApi } from "./fixtures/guide-overlay";
import type {
  SyncApplyContext,
  SyncEngineSnapshot,
  SyncExchangeRequest,
  SyncOperation,
  SyncRecord,
  SyncRemoteOperation,
} from "../../../../packages/mesurer/core/sync/types";

type SyncTestWindow = Window & { __mesurerSyncTest: SyncTestApi };
type TestOperation = SyncOperation<Record<string, unknown>>;

test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
});

test("applies local mutations immediately and synchronizes another client", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const domain = {
      apply: (state: Record<string, string>, operation: TestOperation) => ({
        state: { ...state, [operation.entityId]: String(operation.payload.value) },
      }),
    };
    const first = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore({}),
      transport: server.createTransport(),
      domain,
      createOperationId: () => "operation-1",
      now: () => 100,
    });
    const second = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-b",
      store: api.createMemorySyncStore({}),
      transport: server.createTransport(),
      domain,
    });

    await first.mutate({
      entity: "annotation",
      entityId: "annotation-1",
      type: "annotation.updated",
      payload: { value: "local value" },
    });
    const optimistic = await first.getSnapshot();
    await first.sync();
    await second.sync();

    return {
      optimisticState: optimistic.state,
      optimisticPending: optimistic.pending,
      first: await first.getSnapshot(),
      second: await second.getSnapshot(),
    };
  });

  expect(result.optimisticState).toEqual({ "annotation-1": "local value" });
  expect(result.optimisticPending).toBe(1);
  expect(result.first.pending).toBe(0);
  expect(result.second.state).toEqual(result.first.state);
  expect(result.second.cursor).toBe(1);
});

test("retries an accepted operation without duplicating it", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const baseTransport = server.createTransport();
    let loseFirstAcknowledgement = true;
    const transport = {
      exchange: async (request: SyncExchangeRequest) => {
        const response = await baseTransport.exchange(request);
        if (loseFirstAcknowledgement) {
          loseFirstAcknowledgement = false;
          throw new api.SyncTransportError("Connection closed after server commit");
        }
        return response;
      },
    };
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport,
      domain: {
        apply: (state: string[], operation: TestOperation) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      createOperationId: () => "operation-1",
    });

    await engine.mutate({
      entity: "comment",
      entityId: "comment-1",
      type: "comment.created",
      payload: {},
    });
    await engine.sync().catch(() => {});
    const afterFailure = await engine.getSnapshot();
    await engine.sync();
    const afterRetry = await engine.getSnapshot();
    return {
      afterFailure,
      afterRetry,
      serverOperations: server.getOperations("workspace-1"),
    };
  });

  expect(result.afterFailure.pending).toBe(1);
  expect(result.afterRetry.pending).toBe(0);
  expect(result.afterRetry.state).toEqual(["operation-1"]);
  expect(result.serverOperations).toHaveLength(1);
});

test("confirms an acknowledged operation that is not echoed by the transport", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: {
        exchange: async (request: SyncExchangeRequest) => ({
          acknowledgedOperationIds: request.operations.map((operation) => operation.id),
          operations: [],
          cursor: request.cursor + request.operations.length,
          hasMore: false,
        }),
      },
      domain: {
        apply: (state: string[], operation: TestOperation) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      createOperationId: () => "operation-1",
    });
    await engine.mutate({ entity: "comment", entityId: "comment-1", type: "comment.created", payload: {} });
    await engine.sync();
    return engine.getSnapshot();
  });

  expect(result.pending).toBe(0);
  expect(result.state).toEqual(["operation-1"]);
  expect(result.cursor).toBe(1);
});

test("drains bounded push and pull batches", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness({ pullBatchSize: 2 });
    let id = 0;
    const domain = {
      apply: (state: string[], operation: TestOperation) => ({
        state: state.includes(operation.id) ? state : [...state, operation.id],
      }),
    };
    const first = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: server.createTransport(),
      domain,
      batchSize: 2,
      createOperationId: () => `operation-${++id}`,
    });
    for (let index = 0; index < 5; index += 1) {
      await first.mutate({
        entity: "annotation",
        entityId: `annotation-${index}`,
        type: "annotation.created",
        payload: { index },
      });
    }
    await first.sync();

    const second = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-b",
      store: api.createMemorySyncStore([]),
      transport: server.createTransport(),
      domain,
    });
    await second.sync();
    return {
      first: await first.getSnapshot(),
      second: await second.getSnapshot(),
      serverCount: server.getOperations("workspace-1").length,
    };
  });

  expect(result.first.pending).toBe(0);
  expect(result.serverCount).toBe(5);
  expect(result.second.state).toHaveLength(5);
  expect(result.second.cursor).toBe(5);
});

test("keeps scopes isolated", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const domain = {
      apply: (state: string[], operation: TestOperation) => ({
        state: [...state, operation.entityId],
      }),
    };
    const create = (scope: string, clientId: string, operationId: string) => api.createSyncEngine({
      scope,
      clientId,
      store: api.createMemorySyncStore([]),
      transport: server.createTransport(),
      domain,
      createOperationId: () => operationId,
    });
    const first = create("account-a", "client-a", "operation-a");
    const second = create("account-b", "client-b", "operation-b");
    await first.mutate({ entity: "review", entityId: "review-a", type: "created", payload: {} });
    await second.mutate({ entity: "review", entityId: "review-b", type: "created", payload: {} });
    await first.sync();
    await second.sync();
    await first.sync();
    await second.sync();
    return {
      first: await first.getSnapshot(),
      second: await second.getSnapshot(),
    };
  });

  expect(result.first.state).toEqual(["review-a"]);
  expect(result.second.state).toEqual(["review-b"]);
});

test("records domain conflicts while continuing synchronization", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    server.append({
      id: "remote-operation",
      scope: "workspace-1",
      clientId: "client-b",
      sequence: 1,
      entity: "annotation",
      entityId: "annotation-1",
      type: "annotation.updated",
      payload: { value: "remote" },
      createdAt: 10,
      schemaVersion: 1,
    });
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore({ "annotation-1": "local" }),
      transport: server.createTransport(),
      domain: {
        apply: (state: Record<string, string>, operation: TestOperation, context: SyncApplyContext) => ({
          state: { ...state, [operation.entityId]: String(operation.payload.value) },
          ...(context.source === "remote" && state[operation.entityId]
            ? {
                conflict: {
                  operationId: operation.id,
                  entity: operation.entity,
                  entityId: operation.entityId,
                  reason: "Concurrent edit",
                },
              }
            : {}),
        }),
      },
    });
    await engine.sync();
    return engine.getSnapshot();
  });

  expect(result.state).toEqual({ "annotation-1": "remote" });
  expect(result.conflicts).toEqual([{
    operationId: "remote-operation",
    entity: "annotation",
    entityId: "annotation-1",
    reason: "Concurrent edit",
  }]);
});

test("restores optimistic state and pending operations from IndexedDB", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const databaseName = `mesurer-sync-test-${crypto.randomUUID()}`;
    const server = api.createSyncTestHarness();
    const domain = {
      apply: (state: Record<string, string>, operation: TestOperation) => ({
        state: { ...state, [operation.entityId]: String(operation.payload.value) },
      }),
    };
    const firstStore = api.createIndexedDbSyncStore({
      databaseName,
      recordKey: "workspace-1:client-a",
      scope: "workspace-1",
      clientId: "client-a",
      initialState: {},
    });
    const first = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: firstStore,
      transport: server.createTransport(),
      domain,
      createOperationId: () => "durable-operation",
    });
    await first.mutate({
      entity: "annotation",
      entityId: "annotation-1",
      type: "annotation.updated",
      payload: { value: "survives reload" },
    });
    await firstStore.close();

    const secondStore = api.createIndexedDbSyncStore({
      databaseName,
      recordKey: "workspace-1:client-a",
      scope: "workspace-1",
      clientId: "client-a",
      initialState: {},
    });
    const second = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: secondStore,
      transport: server.createTransport(),
      domain,
    });
    const restored = await second.getSnapshot();
    await second.sync();
    const synchronized = await second.getSnapshot();
    const serverCount = server.getOperations("workspace-1").length;
    await secondStore.deleteDatabase();
    return { restored, synchronized, serverCount };
  });

  expect(result.restored.state).toEqual({ "annotation-1": "survives reload" });
  expect(result.restored.pending).toBe(1);
  expect(result.synchronized.pending).toBe(0);
  expect(result.serverCount).toBe(1);
});

test("retries automatically after reconnecting without trusting observers", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const statuses: string[] = [];
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: server.createTransport(),
      domain: {
        apply: (state: string[], operation: TestOperation) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      retry: { initialDelayMs: 10, maxDelayMs: 10, maxAttempts: 20 },
      createOperationId: () => "retry-operation",
    });
    engine.subscribe(() => {
      throw new Error("Broken observer");
    });
    engine.subscribe((snapshot: SyncEngineSnapshot<string[]>) => statuses.push(snapshot.status.state));
    await engine.start();
    server.setOnline(false);
    await engine.mutate({
      entity: "comment",
      entityId: "comment-1",
      type: "comment.created",
      payload: {},
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    server.setOnline(true);
    const deadline = Date.now() + 2_000;
    while ((await engine.getSnapshot()).pending > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const snapshot = await engine.getSnapshot();
    engine.stop();
    return { snapshot, statuses, serverCount: server.getOperations("workspace-1").length };
  });

  expect(result.snapshot.pending).toBe(0);
  expect(result.statuses).toContain("retrying");
  expect(result.serverCount).toBe(1);
});

test("rebuilds optimistic state in authoritative server order", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    server.append({
      id: "remote-first",
      scope: "workspace-1",
      clientId: "client-b",
      sequence: 1,
      entity: "annotation",
      entityId: "annotation-1",
      type: "annotation.updated",
      payload: { value: "remote first" },
      createdAt: 1,
      schemaVersion: 1,
    });
    const domain = {
        apply: (state: string, operation: TestOperation) => ({ state: String(operation.payload.value) }),
    };
    const first = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore("initial"),
      transport: server.createTransport(),
      domain,
      createOperationId: () => "local-second",
    });
    await first.mutate({
      entity: "annotation",
      entityId: "annotation-1",
      type: "annotation.updated",
      payload: { value: "local second" },
    });
    await first.sync();

    const fresh = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-c",
      store: api.createMemorySyncStore("initial"),
      transport: server.createTransport(),
      domain,
    });
    await fresh.sync();
    return {
      first: await first.getSnapshot(),
      fresh: await fresh.getSnapshot(),
    };
  });

  expect(result.first.state).toBe("local second");
  expect(result.fresh.state).toBe("local second");
  expect(result.first.cursor).toBe(result.fresh.cursor);
});

test("never accepts acknowledgements for unsent concurrent mutations", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const base = server.createTransport();
    let releaseFirstRequest: (() => void) | undefined;
    let firstRequestStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      firstRequestStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    let exchanges = 0;
    const transport = {
      exchange: async (request: SyncExchangeRequest) => {
        exchanges += 1;
        if (exchanges === 1) {
          firstRequestStarted?.();
          await release;
          const response = await base.exchange(request);
          return {
            ...response,
            acknowledgedOperationIds: [...response.acknowledgedOperationIds, "operation-2"],
          };
        }
        return base.exchange(request);
      },
    };
    let id = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport,
      domain: {
        apply: (state: string[], operation: TestOperation) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      createOperationId: () => `operation-${++id}`,
    });
    await engine.mutate({ entity: "item", entityId: "1", type: "created", payload: {} });
    const syncing = engine.sync();
    await started;
    await engine.mutate({ entity: "item", entityId: "2", type: "created", payload: {} });
    releaseFirstRequest?.();
    await syncing;
    return {
      snapshot: await engine.getSnapshot(),
      serverIds: server.getOperations("workspace-1").map((item: SyncRemoteOperation) => item.operation.id),
      exchanges,
    };
  });

  expect(result.snapshot.pending).toBe(0);
  expect(result.serverIds).toEqual(["operation-1", "operation-2"]);
  expect(result.exchanges).toBeGreaterThanOrEqual(2);
});

test("backs off when a transport makes no progress", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    let exchanges = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: {
        exchange: async (request: SyncExchangeRequest) => {
          exchanges += 1;
          return {
            acknowledgedOperationIds: [],
            operations: [],
            cursor: request.cursor,
            hasMore: false,
          };
        },
      },
      domain: {
        apply: (state: string[], operation: TestOperation) => ({ state: [...state, operation.id] }),
      },
      createOperationId: () => "operation-1",
    });
    await engine.mutate({ entity: "item", entityId: "1", type: "created", payload: {} });
    const error = await engine.sync().then(
      () => null,
      (reason: Error) => reason.message,
    );
    return { error, exchanges, snapshot: await engine.getSnapshot() };
  });

  expect(result.error).toBe("Sync transport made no progress");
  expect(result.exchanges).toBe(1);
  expect(result.snapshot.pending).toBe(1);
  expect(result.snapshot.status.state).toBe("error");
});

test("does not lose a sync request during final status publication", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const memory = api.createMemorySyncStore([]);
    let reads = 0;
    let releaseFinalRead: (() => void) | undefined;
    let finalReadStarted: (() => void) | undefined;
    const finalRead = new Promise<void>((resolve) => {
      finalReadStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFinalRead = resolve;
    });
    const store = {
      transact: memory.transact,
      read: async () => {
        reads += 1;
        if (reads === 4) {
          finalReadStarted?.();
          await release;
        }
        return memory.read();
      },
    };
    let id = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store,
      transport: server.createTransport(),
      domain: {
        apply: (state: string[], operation: TestOperation) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      createOperationId: () => `operation-${++id}`,
    });
    await engine.mutate({ entity: "item", entityId: "1", type: "created", payload: {} });
    const firstSync = engine.sync();
    await finalRead;
    await engine.mutate({ entity: "item", entityId: "2", type: "created", payload: {} });
    const secondSync = engine.sync();
    releaseFinalRead?.();
    await Promise.all([firstSync, secondSync]);
    return {
      pending: (await engine.getSnapshot()).pending,
      serverIds: server.getOperations("workspace-1").map((item: SyncRemoteOperation) => item.operation.id),
    };
  });

  expect(result.pending).toBe(0);
  expect(result.serverIds).toEqual(["operation-1", "operation-2"]);
});

test("does not schedule a retry after stop", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const server = api.createSyncTestHarness();
    const base = server.createTransport();
    let exchanges = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: {
        exchange: async (request: SyncExchangeRequest) => {
          exchanges += 1;
          return base.exchange(request);
        },
      },
      domain: {
        apply: (state: string[], operation: TestOperation) => ({ state: [...state, operation.id] }),
      },
      retry: { initialDelayMs: 5, maxDelayMs: 5, maxAttempts: 10 },
      createOperationId: () => "operation-1",
    });
    engine.subscribe((snapshot: SyncEngineSnapshot<string[]>) => {
      if (snapshot.status.state === "retrying") engine.stop();
    });
    await engine.start();
    server.setOnline(false);
    await engine.mutate({ entity: "item", entityId: "1", type: "created", payload: {} });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { exchanges, status: (await engine.getSnapshot()).status.state };
  });

  expect(result.exchanges).toBe(2);
  expect(result.status).toBe("stopped");
});

test("rejects IndexedDB records reused across sync identities", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const databaseName = `mesurer-sync-identity-${crypto.randomUUID()}`;
    const first = api.createIndexedDbSyncStore({
      databaseName,
      recordKey: "shared-record",
      scope: "account-a",
      clientId: "client-a",
      initialState: { owner: "a" },
    });
    await first.transact((record: SyncRecord<{ owner: string }>) => ({
      record: { ...record, state: { owner: "account-a" } },
      value: null,
    }));
    await first.close();

    const second = api.createIndexedDbSyncStore({
      databaseName,
      recordKey: "shared-record",
      scope: "account-b",
      clientId: "client-b",
      initialState: { owner: "b" },
    });
    const error = await second.read().then(
      () => null,
      (reason: Error) => reason.message,
    );
    await second.deleteDatabase();
    return error;
  });

  expect(result).toBe("IndexedDB sync record identity does not match the requested scope");
});

test("keeps monotonic revision metadata in the existing local persistence", async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = (window as SyncTestWindow).__mesurerSyncTest;
    const first = api.createLocalStoragePersistence(window, "sync-revision-test");
    first.saveSettings({ theme: "light" });
    const firstRevision = first.load()?.revision;
    first.saveSettings({ theme: "dark" });
    const secondRevision = first.load()?.revision;
    first.clearSettings();
    window.localStorage.removeItem("sync-revision-test");
    return { firstRevision, secondRevision };
  });

  expect(result.firstRevision.counter).toBe(1);
  expect(result.secondRevision.counter).toBe(2);
  expect(result.firstRevision.writerId).toBe(result.secondRevision.writerId);
  expect(result.firstRevision.mutationId).not.toBe(result.secondRevision.mutationId);
});
