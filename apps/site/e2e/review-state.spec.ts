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

test("restores comment targets from the version in which they were created", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const restoredTarget = await page.evaluate((value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    const workspace = value.review.workspace;
    if (!workspace) throw new Error("Expected review workspace");
    const oldTarget = document.createElement("button");
    oldTarget.textContent = "Old target";
    const newTarget = document.createElement("button");
    newTarget.textContent = "New target";
    document.body.append(oldTarget, newTarget);
    const oldFingerprint = api.captureDomFingerprint(oldTarget);
    const newFingerprint = api.captureDomFingerprint(newTarget);
    const review = {
      ...value,
      versions: [{
        ...value.versions[0],
        id: "version-1",
        domContext: { fingerprints: { "comment:comment-1": oldFingerprint } },
      }, {
        ...value.versions[0],
        id: "version-2",
        number: 2,
        domContext: { fingerprints: { "comment:comment-1": newFingerprint } },
      }],
      review: {
        ...value.review,
        workspace: {
          ...workspace,
          comments: [{
            ...workspace.comments[0],
            targetId: "comment:comment-1",
            createdVersion: "version-1",
          }],
        },
      },
    };
    return api.restoreReviewWorkspace(review).comments?.[0]?.target.textSnippet;
  }, stateWithWorkspace);

  expect(restoredTarget).toBe("Old target");
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

test("saves a real toolbar annotation and opens it in the viewer", async ({ page, context }) => {
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

  const viewerPage = context.waitForEvent("page");
  await (await openReviewSettings(page)).click();
  const viewerTab = await viewerPage;
  await viewerTab.waitForURL(/\/[0-9a-f-]{36}$/);

  await expect(viewerTab.locator("iframe[title='Mesurer review']")).toBeVisible();
  const viewer = viewerTab.frameLocator("iframe[title='Mesurer review']");
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
      captureDom: false,
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
  await expect(viewer.locator("#live-snapshot")).toHaveCount(0);
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

test("keeps earlier saved review viewers available", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");

  const viewers = await page.evaluate(async () => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    await api.saveReviewViewer(window, "review-one", "<p>first</p>");
    await api.saveReviewViewer(window, "review-two", "<p>second</p>");
    return Promise.all([
      api.loadReviewViewer(window, "review-one"),
      api.loadReviewViewer(window, "review-two"),
    ]);
  });

  expect(viewers).toEqual(["<p>first</p>", "<p>second</p>"]);
});

test("shows a missing review instead of leaving the UUID route blank", async ({ page }) => {
  await page.goto("/00000000-0000-4000-8000-000000000000");
  await expect(page.locator("iframe[title='Mesurer review']")).toHaveAttribute("srcdoc", /Review not found/);
});

test("draws the page's text on the first capture, in its web font", async ({ page }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const inked = await page.evaluate(async () => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: "Review Test"; src: url("/inter-latin.woff2") format("woff2"); }`;
    document.head.append(style);
    const heading = document.createElement("h1");
    heading.textContent = "MMMMMMMM";
    heading.style.cssText = "position:fixed;left:400px;top:300px;margin:0;font:600 80px 'Review Test';color:#000;background:#fff;z-index:2147483647";
    document.body.append(heading);
    await document.fonts.load("600 80px 'Review Test'");
    const rect = heading.getBoundingClientRect();
    // The first capture of the page: a font embedded in it has never been painted yet.
    const capture = await api.captureDocumentWithSnapdom(document, window);
    const bitmap = await createImageBitmap(capture.blob);
    const scale = bitmap.width / capture.cssWidth;
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index] < 80 && data[index + 3] > 200) dark++;
    return dark / (data.length / 4);
  });
  expect(inked).toBeGreaterThan(0.1);
});

test("draws the images another origin serves without CORS, read through the host's loader", async ({ page }) => {
  // Allowed to another origin only: the page shows them, but its scripts cannot read them.
  await page.route("https://images.mesurer.test/**", (route) => route.fulfill({
    contentType: "image/svg+xml",
    headers: { "access-control-allow-origin": "https://elsewhere.mesurer.test" },
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#00f"/></svg>`,
  }));
  // The colour at the middle of an <img>, then of an element with a CSS background, both blue
  // on the page. A loader, when there is one, answers red. Each capture runs on a fresh page.
  // `live` is the capture as a document that loads the images nothing could read.
  const capture = async (withLoader: boolean) => {
    await page.goto("/e2e/fixtures/guide-overlay.html");
    return page.evaluate(async (useLoader) => {
      const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
      const fetchBefore = window.fetch;
      const box = "position:fixed;top:300px;width:120px;height:120px;z-index:2147483647";
      const image = document.createElement("img");
      image.src = "https://images.mesurer.test/photo.svg";
      image.style.cssText = `${box};left:400px`;
      const backdrop = document.createElement("div");
      backdrop.style.cssText = `${box};left:600px;background:url(https://images.mesurer.test/backdrop.svg) center / cover`;
      document.body.append(image, backdrop);
      await image.decode();
      const swatch = document.createElement("canvas");
      swatch.width = swatch.height = 8;
      const swatchContext = swatch.getContext("2d")!;
      swatchContext.fillStyle = "#f00";
      swatchContext.fillRect(0, 0, 8, 8);
      const red = swatch.toDataURL("image/png");
      const asked = new Set<string>();
      let captured = false;
      const pending = api.captureDocumentWithSnapdom(
        document,
        window,
        useLoader ? { loadImage: async (url) => { asked.add(url); return red; } } : undefined,
      ).finally(() => { captured = true; });
      // A request of the page's own, for something it does not show, made while the capture runs.
      while (window.fetch === fetchBefore && !captured) await new Promise((resolve) => setTimeout(resolve, 0));
      const duringCapture = !captured;
      const ownFetch = await fetch("https://images.mesurer.test/not-shown.svg").then(() => "answered", () => "failed");
      const result = await pending;
      const bitmap = await createImageBitmap(result.blob);
      const scale = bitmap.width / result.cssWidth;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return {
        centres: [460, 660].map((x) => [...context.getImageData(x * scale, 360 * scale, 1, 1).data.slice(0, 3)]),
        asked: [...asked].sort(),
        fetchRestored: window.fetch === fetchBefore,
        ownFetch: duringCapture ? ownFetch : "not during the capture",
        live: result.live === undefined ? null : {
          photo: result.live.includes(`src="https://images.mesurer.test/photo.svg"`),
          backdrop: result.live.includes("url(&quot;https://images.mesurer.test/backdrop.svg&quot;)"),
          placeholders: result.live.includes("data-image="),
          fills: /^<svg\b[^>]* width="100%" height="100%"/.test(result.live),
        },
      };
    }, withLoader);
  };

  // With nothing to read them, the screenshot has placeholders and the live document their addresses.
  const alone = await capture(false);
  for (const pixel of alone.centres) {
    expect(pixel).not.toEqual([0, 0, 255]);
    expect(pixel).not.toEqual([255, 0, 0]);
  }
  expect(alone.live).toEqual({ photo: true, backdrop: true, placeholders: false, fills: true });
  expect(alone.fetchRestored).toBe(true);
  // The page's other requests are never answered for it.
  expect(alone.ownFetch).toBe("failed");

  const loaded = await capture(true);
  expect(loaded.asked).toEqual(["https://images.mesurer.test/backdrop.svg", "https://images.mesurer.test/photo.svg"]);
  expect(loaded.centres).toEqual([[255, 0, 0], [255, 0, 0]]);
  expect(loaded.live).toBeNull();
  expect(loaded.ownFetch).toBe("failed");
  expect(loaded.fetchRestored).toBe(true);
});

test("shows a capture's live document over the screenshot, in a frame that runs nothing", async ({ page, context }) => {
  await page.goto("/e2e/fixtures/guide-overlay.html");
  const url = await page.evaluate(async (value) => {
    const api = (window as ReviewStateTestWindow).__mesurerReviewStateTest;
    const png = await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=").then((response) => response.blob());
    const result = await api.createEphemeralReviewUrl(value, {
      blob: png,
      width: 1,
      height: 1,
      mimeType: "image/png",
      live: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1 1"><rect id="mark" width="1" height="1" fill="#0a0"/></svg>`,
    }, window);
    return result.url;
  }, state);

  const viewer = await context.newPage();
  await viewer.goto(url);
  const live = viewer.locator("#live-snapshot");
  await expect(live).toHaveAttribute("sandbox", "");
  await expect(live).toHaveAttribute("src", /^blob:/);
  await expect(viewer.frameLocator("#live-snapshot").locator("#mark")).toHaveCount(1);
  // The screenshot stays under it, and the pins over it.
  await expect(viewer.locator("#screenshot")).toHaveAttribute("src", /^data:image\/png/);
  await expect(viewer.locator(".comment-pin")).toHaveCount(1);
});
