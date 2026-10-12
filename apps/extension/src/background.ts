import { CAPTURE_VISIBLE_MESSAGE, FETCH_IMAGE_MESSAGE, OFFSCREEN_RECORDING_ABORT_MESSAGE, OFFSCREEN_RECORDING_PREPARE_MESSAGE, OFFSCREEN_RECORDING_START_MESSAGE, OFFSCREEN_RECORDING_STOP_MESSAGE, RECORDING_ABORT_MESSAGE, RECORDING_PREPARED_MESSAGE, RECORDING_PREPARE_MESSAGE, RECORDING_READY_MESSAGE, RECORDING_STARTED_MESSAGE, RECORDING_START_MESSAGE, RECORDING_STOP_MESSAGE, SESSION_MESSAGE, type ExtensionBoot } from "./messages";
import { createActiveTabRegistry } from "./active-tabs";

const ACTIVE_TABS_KEY = "mesurer:active-tabs";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

// A review's screenshot is drawn from the page, and a page cannot read the images it shows from
// other origins unless they allow it. The extension's host permissions can, so it reads them here.
// Private networks are not read on a page's behalf: an address there is reachable from the
// browser but not from the internet, and the page could not read it itself. Loopback stays
// readable, so a site running on this machine still gets its images.
const isPrivateHost = (hostname: string) => {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (host.includes(":")) return /^(fc|fd)/.test(host) || /^fe[89ab]/.test(host);
  return host.endsWith(".local") || host.endsWith(".internal");
};

const readableImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
};

// Sent without cookies: an image behind the user's login is not read with it, only one anyone
// could load. The final address is checked too, since a redirect may lead onto a private network.
const fetchImageDataUrl = async (url: string) => {
  if (!readableImageUrl(url)) throw new Error("Not readable");
  const response = await fetch(url, { credentials: "omit" });
  if (!readableImageUrl(response.url)) throw new Error("Redirected to a private network");
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) throw new Error("Not an image");
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new Error("Image too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image too large");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${type.split(";")[0]};base64,${btoa(binary)}`;
};
const restoreTimers = new Map<number, ReturnType<typeof setTimeout>>();

const isInjectableUrl = (url: string | undefined) => {
  if (!url) return true;
  return (
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("edge://") &&
    !url.startsWith("about:") &&
    !url.startsWith("https://chrome.google.com/webstore") &&
    !url.startsWith("https://chromewebstore.google.com/")
  );
};

const readActiveTabs = async () => {
  try {
    const stored = await chrome.storage.session.get(ACTIVE_TABS_KEY);
    const ids = stored[ACTIVE_TABS_KEY];
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
};

const writeActiveTabs = async (ids: number[]) => {
  try {
    await chrome.storage.session.set({ [ACTIVE_TABS_KEY]: ids });
  } catch {
    // session storage may be unavailable in older browsers
  }
};

const activeTabRegistry = createActiveTabRegistry(readActiveTabs, writeActiveTabs);
let offscreenReady: Promise<void> | null = null;

const ensureOffscreen = () => {
  if (!offscreenReady) {
    offscreenReady = chrome.offscreen.hasDocument().then(async (hasDocument) => {
      if (!hasDocument) await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Record the selected browser tab region.",
      });
    }).catch((error) => {
      offscreenReady = null;
      throw error;
    });
  }
  return offscreenReady;
};

// Mesurer's stylesheet, read once from the file it ships as. The content script is handed it
// instead of carrying a copy of its own.
let styles: Promise<string> | null = null;
const readStyles = () => {
  styles ??= fetch(chrome.runtime.getURL("mesurer.css"))
    .then((response) => response.text())
    .catch((error) => {
      styles = null;
      throw error;
    });
  return styles;
};

const inject = async (tabId: number, boot: ExtensionBoot) => {
  const css = await readStyles();
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    injectImmediately: true,
    files: ["keyboard-gate.js"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    func: (mode: ExtensionBoot, css: string) => {
      const extensionGlobal = globalThis as typeof globalThis & {
        __MESURER_BOOT__?: ExtensionBoot;
        __MESURER_STYLES__?: string;
      };
      extensionGlobal.__MESURER_BOOT__ = mode;
      extensionGlobal.__MESURER_STYLES__ = css;
    },
    args: [boot, css],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    files: ["content.js"],
  });
};

const pingAlive = async (tabId: number) => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const state = (
          globalThis as typeof globalThis & {
            __MESURER_EXTENSION_STATE__?: { mounted?: boolean; recover?: () => void };
          }
        ).__MESURER_EXTENSION_STATE__;
        if (!state?.mounted) return false;
        state.recover?.();
        return true;
      },
    });
    return results[0]?.result === true;
  } catch {
    return false;
  }
};

const restoreTab = (tabId: number, url?: string) => {
  if (!isInjectableUrl(url)) return;
  const previous = restoreTimers.get(tabId);
  if (previous) clearTimeout(previous);
  restoreTimers.set(
    tabId,
    setTimeout(() => {
      restoreTimers.delete(tabId);
      void activeTabRegistry.ready
        .then(async () => {
          if (!activeTabRegistry.isActive(tabId)) return;
          const alive = await pingAlive(tabId);
          if (!activeTabRegistry.isActive(tabId)) return;
          if (alive) {
            await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              injectImmediately: true,
              files: ["keyboard-gate.js"],
            });
            return;
          }
          return inject(tabId, "restore");
        })
        .catch((error) => {
          console.error("Mesurer failed to restore", error);
        });
    }, 50),
  );
};

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return;
  if (!isInjectableUrl(tab.url)) return;
  inject(tab.id, "toggle").catch((error) => {
    console.error("Mesurer failed to inject", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === RECORDING_PREPARE_MESSAGE) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No tab to record" });
      return true;
    }
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message ?? "Tab capture unavailable" });
        return;
      }
      void ensureOffscreen()
        .then(() => chrome.runtime.sendMessage({ type: OFFSCREEN_RECORDING_PREPARE_MESSAGE, streamId, tabId }))
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Recording failed" }));
    });
    return true;
  }
  if (message?.type === RECORDING_START_MESSAGE) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No tab to record" });
      return true;
    }
    void ensureOffscreen().then(() => chrome.runtime.sendMessage({ ...message, type: OFFSCREEN_RECORDING_START_MESSAGE, tabId })).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Recording failed" }));
    return true;
  }
  if (message?.type === RECORDING_STOP_MESSAGE || message?.type === RECORDING_ABORT_MESSAGE) {
    const type = message.type === RECORDING_STOP_MESSAGE ? OFFSCREEN_RECORDING_STOP_MESSAGE : OFFSCREEN_RECORDING_ABORT_MESSAGE;
    void ensureOffscreen().then(() => chrome.runtime.sendMessage({ type })).catch(() => undefined);
    return false;
  }
  if (message?.type === RECORDING_READY_MESSAGE || message?.type === RECORDING_STARTED_MESSAGE || message?.type === RECORDING_PREPARED_MESSAGE) {
    const tabId = sender.tab?.id;
    const targetTabId = typeof message.tabId === "number" ? message.tabId : tabId;
    if (typeof targetTabId === "number") void chrome.tabs.sendMessage(targetTabId, message).catch(() => undefined);
    return false;
  }
  if (message?.type === SESSION_MESSAGE) {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number" && typeof message.open === "boolean") {
      void activeTabRegistry.setActive(tabId, message.open);
    }
    return false;
  }

  if (message?.type === FETCH_IMAGE_MESSAGE) {
    if (sender.tab?.id === undefined || typeof message.url !== "string" || !/^https?:\/\//i.test(message.url)) {
      sendResponse({ ok: false });
      return false;
    }
    void fetchImageDataUrl(message.url).then(
      (dataUrl) => sendResponse({ ok: true, dataUrl }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }

  if (message?.type !== CAPTURE_VISIBLE_MESSAGE) return false;
  const windowId = sender.tab?.windowId;
  const senderTabId = sender.tab?.id;
  if (windowId === undefined || senderTabId === undefined) {
    sendResponse({ ok: false, error: "No window to capture" });
    return false;
  }

  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (chrome.runtime.lastError || tabs[0]?.id !== senderTabId) {
      sendResponse({ ok: false, error: "Capture request came from an inactive tab" });
      return;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message ?? "Capture failed",
        });
        return;
      }
      sendResponse({ ok: true, dataUrl });
    });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" && !changeInfo.url) return;
  restoreTab(tabId, changeInfo.url ?? tab.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = restoreTimers.get(tabId);
  if (timer) clearTimeout(timer);
  restoreTimers.delete(tabId);
  void activeTabRegistry.setActive(tabId, false);
});
