import { expect, test } from "@playwright/test";

const state = {
  schemaVersion: 1 as const,
  project: { id: "project-1", name: "Local project" },
  page: {
    id: "page-1",
    projectId: "project-1",
    url: "http://127.0.0.1:4173/e2e/fixtures/guide-overlay.html",
    versionIds: ["version-1"],
  },
  versions: [
    {
      id: "version-1",
      pageId: "page-1",
      number: 1,
      createdAt: 1,
      snapshot: {
        url: "http://127.0.0.1:4173/e2e/fixtures/guide-overlay.html",
        capturedAt: 1,
        viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
        scroll: { x: 0, y: 0 },
      },
      domContext: { fingerprints: {} },
    },
  ],
  review: {
    id: "review-1",
    pageId: "page-1",
    createdAt: 1,
    updatedAt: 1,
    comments: [],
    annotations: [],
  },
};

test("serializes and restores a review state through local storage", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const result = await page.evaluate((value) => {
    const api = (window as any).__mesurerReviewStateTest;
    const storage = api.createLocalReviewStateStorage(window);
    storage.save("review:test", value);
    const restored = storage.load("review:test");
    storage.remove("review:test");
    return {
      serialized: api.serializeReviewState(value),
      restored,
      removed: window.localStorage.getItem("review:test"),
    };
  }, state);

  expect(JSON.parse(result.serialized).schemaVersion).toBe(1);
  expect(result.restored).toEqual(state);
  expect(result.removed).toBeNull();
});

test("captures a DOM fingerprint and reattaches after replacement", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const result = await page.evaluate(() => {
    const api = (window as any).__mesurerReviewStateTest;
    const element = document.querySelector("button");
    if (!element) throw new Error("Expected fixture target");
    const fingerprint = api.captureDomFingerprint(element);
    element.replaceWith(element.cloneNode(true));
    const resolution = api.resolveDomFingerprint(fingerprint);
    return { fingerprint, resolution: resolution.status };
  });

  expect(result.fingerprint.tagName).toBe("button");
  expect(result.resolution).toBe("attached");
});

test("logs the current review state from the toolbar", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "log") logs.push(message.text());
  });

  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.getByRole("button", { name: "Log review state" }).click();

  expect(logs.some((message) => message.includes('"schemaVersion":1'))).toBe(true);
});
