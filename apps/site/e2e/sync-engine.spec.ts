import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
});

test("applies local mutations immediately and synchronizes another client", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
    const domain = {
      apply: (state: Record<string, string>, operation: any) => ({
        state: { ...state, [operation.entityId]: operation.payload.value },
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
    const baseTransport = server.createTransport();
    let loseFirstAcknowledgement = true;
    const transport = {
      exchange: async (request: any) => {
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
        apply: (state: string[], operation: any) => ({
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

test("drains bounded push and pull batches", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer({ pullBatchSize: 2 });
    let id = 0;
    const domain = {
      apply: (state: string[], operation: any) => ({
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
    const domain = {
      apply: (state: string[], operation: any) => ({
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
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
        apply: (state: Record<string, string>, operation: any, context: any) => ({
          state: { ...state, [operation.entityId]: operation.payload.value },
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
    const api = (window as any).__mesurerSyncTest;
    const databaseName = `mesurer-sync-test-${crypto.randomUUID()}`;
    const server = api.createFakeSyncServer();
    const domain = {
      apply: (state: Record<string, string>, operation: any) => ({
        state: { ...state, [operation.entityId]: operation.payload.value },
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
    const statuses: string[] = [];
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: server.createTransport(),
      domain: {
        apply: (state: string[], operation: any) => ({
          state: state.includes(operation.id) ? state : [...state, operation.id],
        }),
      },
      retry: { initialDelayMs: 10, maxDelayMs: 10, maxAttempts: 20 },
      createOperationId: () => "retry-operation",
    });
    engine.subscribe(() => {
      throw new Error("Broken observer");
    });
    engine.subscribe((snapshot: any) => statuses.push(snapshot.status.state));
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
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
      apply: (state: string, operation: any) => ({ state: operation.payload.value }),
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
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
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
      exchange: async (request: any) => {
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
        apply: (state: string[], operation: any) => ({
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
      serverIds: server.getOperations("workspace-1").map((item: any) => item.operation.id),
      exchanges,
    };
  });

  expect(result.snapshot.pending).toBe(0);
  expect(result.serverIds).toEqual(["operation-1", "operation-2"]);
  expect(result.exchanges).toBeGreaterThanOrEqual(2);
});

test("backs off when a transport makes no progress", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    let exchanges = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: {
        exchange: async (request: any) => {
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
        apply: (state: string[], operation: any) => ({ state: [...state, operation.id] }),
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

test("adapts the exchange protocol to an authenticated REST endpoint", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    let received: any;
    const transport = api.createRestSyncTransport({
      url: "/api/sync",
      headers: async () => ({ authorization: "Bearer test-token" }),
      fetch: async (url: string, init: RequestInit) => {
        received = {
          url,
          method: init.method,
          authorization: new Headers(init.headers).get("authorization"),
          contentType: new Headers(init.headers).get("content-type"),
          body: JSON.parse(String(init.body)),
        };
        return new Response(JSON.stringify({
          acknowledgedOperationIds: ["operation-1"],
          operations: [],
          cursor: 4,
          hasMore: false,
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const response = await transport.exchange({
      scope: "workspace-1",
      clientId: "client-a",
      cursor: 3,
      operations: [],
    });
    return { received, response };
  });

  expect(result.received).toEqual({
    url: "/api/sync",
    method: "POST",
    authorization: "Bearer test-token",
    contentType: "application/json",
    body: {
      scope: "workspace-1",
      clientId: "client-a",
      cursor: 3,
      operations: [],
    },
  });
  expect(result.response.cursor).toBe(4);
});

test("classifies REST protocol and server failures", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    const exchange = async (status: number, body: unknown) => {
      const transport = api.createRestSyncTransport({
        url: "/api/sync",
        fetch: async () => new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      });
      return transport.exchange({
        scope: "workspace-1",
        clientId: "client-a",
        cursor: 0,
        operations: [],
      }).then(
        () => null,
        (error: any) => ({ message: error.message, retryable: error.retryable }),
      );
    };
    return {
      unavailable: await exchange(503, {}),
      unauthorized: await exchange(401, {}),
      invalid: await exchange(200, { cursor: "wrong" }),
    };
  });

  expect(result.unavailable).toEqual({
    message: "Sync request failed with status 503",
    retryable: true,
  });
  expect(result.unauthorized).toEqual({
    message: "Sync request failed with status 401",
    retryable: false,
  });
  expect(result.invalid).toEqual({
    message: "Sync server returned an invalid response",
    retryable: false,
  });
});

test("does not lose a sync request during final status publication", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
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
        apply: (state: string[], operation: any) => ({
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
      serverIds: server.getOperations("workspace-1").map((item: any) => item.operation.id),
    };
  });

  expect(result.pending).toBe(0);
  expect(result.serverIds).toEqual(["operation-1", "operation-2"]);
});

test("does not schedule a retry after stop", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = (window as any).__mesurerSyncTest;
    const server = api.createFakeSyncServer();
    const base = server.createTransport();
    let exchanges = 0;
    const engine = api.createSyncEngine({
      scope: "workspace-1",
      clientId: "client-a",
      store: api.createMemorySyncStore([]),
      transport: {
        exchange: async (request: any) => {
          exchanges += 1;
          return base.exchange(request);
        },
      },
      domain: {
        apply: (state: string[], operation: any) => ({ state: [...state, operation.id] }),
      },
      retry: { initialDelayMs: 5, maxDelayMs: 5, maxAttempts: 10 },
      createOperationId: () => "operation-1",
    });
    engine.subscribe((snapshot: any) => {
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
    const api = (window as any).__mesurerSyncTest;
    const databaseName = `mesurer-sync-identity-${crypto.randomUUID()}`;
    const first = api.createIndexedDbSyncStore({
      databaseName,
      recordKey: "shared-record",
      scope: "account-a",
      clientId: "client-a",
      initialState: { owner: "a" },
    });
    await first.transact((record: any) => ({
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
