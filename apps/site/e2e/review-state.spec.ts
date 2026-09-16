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
  expect(result.restored.review.textStyle).toEqual({ font: "code", color: "#ff00aa" });
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

test("exposes the review save tool from the toolbar", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  await expect(page.getByRole("button", { name: "Save review" })).toBeVisible();
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
  await page.getByRole("button", { name: "Save review" }).click();
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
  await expect(page.getByRole("button", { name: "Save review" })).toBeVisible();
  const overlay = page.locator("[data-mesurer-overlay]").first();
  await expect(overlay).toBeAttached();

  const result = await overlay.evaluate(async (overlay) => {
    const api = (window as any).__mesurerReviewStateTest;
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

test("captures the full document with SnapDOM without scrolling", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const overlay = page.locator("[data-mesurer-overlay]").first();
  await expect(overlay).toBeAttached();

  const result = await overlay.evaluate(async (overlay) => {
    const api = (window as any).__mesurerReviewStateTest;
    document.body.style.height = "1800px";
    window.scrollTo(0, 240);
    const snapshot = await api.captureReviewSnapshot({
      ownerDocument: document,
      ownerWindow: window,
      overlay,
      captureDom: true,
    });
    return { scrollY: window.scrollY, width: snapshot.width, height: snapshot.height };
  });

  expect(result.scrollY).toBe(240);
  expect(result.width).toBeGreaterThan(1);
  expect(result.height).toBeGreaterThan(result.width);
});

test("opens a temporary viewer containing the screenshot and review state", async ({ page, context }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const url = await page.evaluate(async (value) => {
    const api = (window as any).__mesurerReviewStateTest;
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
