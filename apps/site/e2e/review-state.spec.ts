import { expect, test } from "@playwright/test";
import type { ReviewStateTestApi } from "./fixtures/guide-overlay";
import type { ReviewState } from "../../../packages/mesurer/core/review";

type ReviewStateTestWindow = Window & { __mesurerReviewStateTest: ReviewStateTestApi };

const openReviewSettings = async (page: import("@playwright/test").Page) => {
  const saveReview = page.getByRole("button", { name: "Save review" });
  if (!(await saveReview.isVisible())) {
    await page.getByRole("button", { name: /Settings/ }).click();
  }
  return saveReview;
};

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
    comments: [{
      id: "comment-1",
      text: "Check this area",
      messages: [],
      position: { x: 120, y: 80 },
      status: "open" as const,
      createdVersion: "version-1",
      createdAt: 1,
      updatedAt: 1,
    }],
    annotations: [{
      type: "arrow" as const,
      id: "arrow-1",
      start: { x: 20, y: 20 },
      end: { x: 180, y: 120 },
      color: "#ff0000",
      width: 2,
    }, {
      type: "text" as const,
      id: "text-1",
      x: 240,
      y: 140,
      text: "Styled note",
      scale: 1.5,
    }],
    textStyle: { font: "code" as const, color: "#ff00aa" },
  },
};

const stateWithWorkspace: ReviewState = {
  ...state,
  review: {
    ...state.review,
    workspace: {
      guides: [{ id: "guide-1", orientation: "vertical", position: 96 }],
      arrows: [{ id: "arrow-1", start: { x: 20, y: 20 }, end: { x: 180, y: 120 }, color: "#ff0000", width: 2 }],
      penStrokes: [{ id: "pen-1", points: [{ x: 10, y: 10 }, { x: 40, y: 40 }], color: "#0d99ff", width: 2 }],
      textAnnotations: [{ id: "text-1", x: 240, y: 140, text: "Styled note", scale: 1.5 }],
      measurements: [{ id: "measurement-1", rect: { left: 10, top: 20, width: 30, height: 40 }, normalizedRect: { left: 10, top: 20, width: 30, height: 40 }, deltaX: 3, deltaY: 4, snapped: true }],
      heldDistances: [{ id: "distance-1", rectA: { left: 10, top: 10, width: 10, height: 10 }, rectB: { left: 40, top: 40, width: 10, height: 10 }, normalizedRectA: { left: 10, top: 10, width: 10, height: 10 }, normalizedRectB: { left: 40, top: 40, width: 10, height: 10 }, horizontal: null, vertical: null, connectors: [] }],
      comments: state.review.comments,
      layoutGuides: [{ id: "layout-1", kind: "columns", visible: true, color: "#ff0000", opacity: 0.1, count: 5, size: 72, gutter: 20, offset: 0, align: "stretch" }],
      textStyle: { font: "code", color: "#ff00aa" },
    },
  },
};

test("serializes and restores a review state through local storage", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const result = await page.evaluate((value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
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
  expect(result.restored.review.textStyle).toEqual({ font: "code", color: "#ff00aa" });
  expect(result.removed).toBeNull();
});

test("preserves the complete recoverable workspace in a review", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const restored = await page.evaluate((value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    return api.deserializeReviewState(api.serializeReviewState(value));
  }, stateWithWorkspace);

  expect(restored?.review.workspace).toEqual(stateWithWorkspace.review.workspace);
});

test("restores review workspace state for Mesurer", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const restored = await page.evaluate((value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    return api.restoreReviewWorkspace(value);
  }, stateWithWorkspace);

  expect(restored).toMatchObject({
    guides: [{ id: "guide-1" }],
    arrows: [{ id: "arrow-1" }],
    penStrokes: [{ id: "pen-1" }],
    textAnnotations: [{ id: "text-1" }],
  });
  expect(restored.layoutGuides).toHaveLength(1);
  expect(restored.heldDistances).toHaveLength(1);
});

test("captures a DOM fingerprint and reattaches after replacement", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const result = await page.evaluate(() => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
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

test("exposes the review save tool in Settings", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(await openReviewSettings(page)).toBeVisible();
});

test("saves a real toolbar annotation and restores it in the viewer", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await page.keyboard.press("2");
  const textTool = page.getByRole("button", { name: "Text (T)" });
  if (!(await textTool.isVisible())) {
    await page.getByRole("button", { name: "Annotate tools (2)" }).click();
  }
  await textTool.click();
  await page.mouse.click(220, 180);
  await page.getByRole("textbox", { name: "Text annotation" }).fill("Saved from toolbar");
  await page.keyboard.press("Escape");

  const savedUrl = new Promise<string>((resolve) => {
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("Temporary review URL")) resolve(text);
    });
  });
  await (await openReviewSettings(page)).click();
  const consoleText = await savedUrl;
  const reviewUrl = consoleText.match(/https?:\/\/[^\s]+/)?.[0];
  expect(reviewUrl).toBeTruthy();

  await page.goto(reviewUrl!);
  await expect(page.locator("iframe[title='Mesurer review']")).toBeVisible();
  const viewer = page.frameLocator("iframe[title='Mesurer review']");
  await expect(viewer.getByText("Review state")).toBeVisible();
  await expect(viewer.locator(".annotation-text")).toHaveText("Saved from toolbar");
});

test("captures the visible tab while hiding only interactive comments", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const overlay = page.locator("[data-mesurer-overlay]").first();
  await expect(overlay).toBeAttached();

  const result = await overlay.evaluate(async (overlay) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    const commentLayer = document.createElement("div");
    commentLayer.setAttribute("data-mesurer-comments-layer", "");
    overlay.append(commentLayer);
    const png = await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=").then((response) => response.blob());
    let visibilityDuringCapture = "";
    const capture = await api.captureReviewSnapshot({
      ownerDocument: document,
      ownerWindow: window,
      overlay,
      captureVisibleTab: async () => {
        visibilityDuringCapture = commentLayer.style.visibility;
        return png;
      },
    });
    return {
      visibilityDuringCapture,
      visibilityAfterCapture: commentLayer.style.visibility,
      width: capture.width,
      height: capture.height,
    };
  });

  expect(result.visibilityDuringCapture).toBe("hidden");
  expect(result.visibilityAfterCapture).toBe("");
  expect(result.width).toBe(1);
  expect(result.height).toBe(1);
});

test("opens a temporary viewer containing the screenshot and review state", async ({ page, context }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const url = await page.evaluate(async (value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    const png = await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=").then((response) => response.blob());
    const result = await api.createEphemeralReviewUrl(value, {
      blob: png,
      width: 1,
      height: 1,
      mimeType: "image/png",
    }, window);
    return result.url;
  }, state);

  const viewer = await context.newPage();
  await viewer.goto(url);
  await expect(viewer.getByText("Review state")).toBeVisible();
  await expect(viewer.locator("#screenshot")).toHaveAttribute("src", /^data:image\/png/);
  await expect(viewer.locator("#state")).toContainText('"schemaVersion": 1');
  await expect(viewer.locator(".comment-pin")).toHaveCount(1);
  await expect(viewer.locator(".comment-pin")).toHaveAttribute("style", /left: 9\.375%/);
  await expect(viewer.locator(".annotations line")).toHaveCount(1);
  await expect(viewer.locator(".annotation-text")).toHaveCSS("color", "rgb(255, 0, 170)");
  await expect(viewer.locator(".annotation-text")).toHaveCSS("font-family", /ui-monospace/);
  await expect(viewer.locator(".annotation-text")).toHaveCSS("font-size", "24px");
  await viewer.locator(".comment-pin").click();
  await viewer.getByRole("textbox", { name: "Reply to comment" }).fill("Follow-up note");
  await viewer.getByRole("button", { name: "Reply" }).click();
  await expect(viewer.locator(".comment-message p")).toContainText("Follow-up note");
});

test("opens a saved review from its local UUID URL", async ({ page }) => {
  // Demo-only route coverage; production links should use server-backed review storage.
  const reviewId = "89da9c3e-d01f-42bd-aa60-dda3fbab239f";
  await page.goto("/");
  await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mesurer-reviews", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("viewers");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction("viewers", "readwrite").objectStore("viewers").put("<!doctype html><title>Saved review</title><p id='saved'>comments and annotations</p>", id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    database.close();
  }, reviewId);
  await page.goto(`/${reviewId}`);
  await expect(page.locator("iframe[title='Mesurer review']")).toHaveAttribute("srcdoc", /comments and annotations/);
  const viewer = page.frameLocator("iframe[title='Mesurer review']");
  await expect(viewer.locator("#saved")).toHaveText("comments and annotations");
});

test("shows a missing review instead of leaving the UUID route blank", async ({ page }) => {
  await page.goto("/00000000-0000-4000-8000-000000000000");
  await expect(page.locator("iframe[title='Mesurer review']")).toHaveAttribute("srcdoc", /Review not found/);
});
