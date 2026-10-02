import {
  isPagedWorkspaceStore,
  normalizeStoredSettings,
  normalizeStoredWorkspace,
} from "../../../packages/mesurer/core/persistence";
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
  MesurerStoredWorkspace,
  PagedWorkspaceStore,
} from "mesurer";
import {
  compareRevisions,
  createNextRevision,
  createWriterId,
  isPersistenceRevision,
  type PersistenceRevision,
} from "../../../packages/mesurer/core/persistence-revision";

const SETTINGS_KEY = "mesurer:settings";
const SHORTCUTS_DEFAULT_MIGRATION_KEY = "mesurer:shortcuts-default-migrated";

const workspaceKey = (origin: string, tabId: string) =>
  `mesurer:workspace:${encodeURIComponent(origin)}:${tabId}`;

const readWorkspaceValue = (
  value: unknown,
): MesurerStoredWorkspace | PagedWorkspaceStore | null =>
  isPagedWorkspaceStore(value) ? value : normalizeStoredWorkspace(value);

export const createExtensionPersistence = async (
  origin: string,
  tabId: string,
): Promise<MesurerPersistence> => {
  const key = workspaceKey(origin, tabId);
  const revisionKey = `mesurer:revision:${encodeURIComponent(origin)}:${tabId}`;
  const stored = await chrome.storage.local.get([
    SETTINGS_KEY,
    SHORTCUTS_DEFAULT_MIGRATION_KEY,
    key,
    revisionKey,
  ]);
  let settings = normalizeStoredSettings(stored[SETTINGS_KEY]);
  // One-time: older unpacked builds often persisted shortcuts off; re-enable once.
  if (!stored[SHORTCUTS_DEFAULT_MIGRATION_KEY]) {
    if (settings.shortcutsEnabled !== true) {
      settings = { ...settings, shortcutsEnabled: true };
    }
    void chrome.storage.local
      .set({
        [SETTINGS_KEY]: settings,
        [SHORTCUTS_DEFAULT_MIGRATION_KEY]: true,
      })
      .catch(() => undefined);
  }
  let workspace = readWorkspaceValue(stored[key]);
  const writerId = createWriterId();
  let revision = isPersistenceRevision(stored[revisionKey])
    ? stored[revisionKey]
    : undefined;
  let errorHandler: ((error: unknown) => void) | undefined;
  let settingsTimer: ReturnType<typeof setTimeout> | null = null;
  let writeQueue = Promise.resolve();

  const handleAsync = (operation: Promise<unknown>) => {
    void operation.catch((error) => {
      errorHandler?.(error);
    });
  };

  const advanceRevision = () => {
    revision = createNextRevision(revision, writerId);
    return revision;
  };

  const enqueueWrite = (operation: () => Promise<void>) => {
    const queued = writeQueue.then(operation);
    writeQueue = queued.catch(() => undefined);
    handleAsync(queued);
  };

  const writeRevisioned = (values: Record<string, unknown>) => {
    enqueueWrite(() => chrome.storage.local.set({
      ...values,
      [revisionKey]: advanceRevision(),
    }));
  };

  const clearRevisioned = (keyToRemove: string) => {
    enqueueWrite(async () => {
      await chrome.storage.local.remove(keyToRemove);
      await chrome.storage.local.set({ [revisionKey]: advanceRevision() });
    });
  };

  const flushSettings = () => {
    settingsTimer = null;
    writeRevisioned({ [SETTINGS_KEY]: settings });
  };

  const scheduleSettingsSave = () => {
    if (settingsTimer !== null) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(flushSettings, 100);
  };

  const snapshot = (): MesurerPersistenceSnapshot => ({
    settings,
    workspace,
    ...(revision ? { revision } : {}),
  });

  return {
    load: snapshot,
    saveSettings: (next) => {
      settings = normalizeStoredSettings(next);
      scheduleSettingsSave();
    },
    saveWorkspace: (next) => {
      workspace = isPagedWorkspaceStore(next) ? next : normalizeStoredWorkspace(next);
      writeRevisioned({ [key]: workspace });
    },
    clearWorkspace: () => {
      workspace = null;
      clearRevisioned(key);
    },
    clearSettings: () => {
      settings = {};
      if (settingsTimer !== null) clearTimeout(settingsTimer);
      settingsTimer = null;
      clearRevisioned(SETTINGS_KEY);
    },
    setErrorHandler: (handler) => {
      errorHandler = handler;
    },
    subscribe: (listener) => {
      const handleChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area !== "local") return;
        const settingsChanged = Boolean(changes[SETTINGS_KEY]);
        const workspaceChanged = Boolean(changes[key]);
        const nextRevision = isPersistenceRevision(changes[revisionKey]?.newValue)
          ? changes[revisionKey]?.newValue
          : undefined;
        if (nextRevision && compareRevisions(nextRevision, revision) <= 0) return;
        if (nextRevision) revision = nextRevision;
        if (changes[SETTINGS_KEY]) settings = normalizeStoredSettings(changes[SETTINGS_KEY].newValue);
        if (changes[key]) workspace = readWorkspaceValue(changes[key].newValue);
        if (settingsChanged || workspaceChanged) {
          listener(snapshot(), {
            settings: settingsChanged,
            workspace: workspaceChanged,
          });
        }
      };
      chrome.storage.onChanged.addListener(handleChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleChange);
      };
    },
  };
};
