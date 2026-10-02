export const CAPTURE_VISIBLE_MESSAGE = "mesurer:capture-visible";
export const SESSION_MESSAGE = "mesurer:session";
export const RECORDING_START_MESSAGE = "mesurer:recording-start";
export const RECORDING_PREPARE_MESSAGE = "mesurer:recording-prepare";
export const RECORDING_PREPARED_MESSAGE = "mesurer:recording-prepared";
export const RECORDING_STOP_MESSAGE = "mesurer:recording-stop";
export const RECORDING_ABORT_MESSAGE = "mesurer:recording-abort";
export const RECORDING_READY_MESSAGE = "mesurer:recording-ready";
export const RECORDING_STARTED_MESSAGE = "mesurer:recording-started";
export const OFFSCREEN_RECORDING_START_MESSAGE = "mesurer:offscreen-recording-start";
export const OFFSCREEN_RECORDING_PREPARE_MESSAGE = "mesurer:offscreen-recording-prepare";
export const OFFSCREEN_RECORDING_STOP_MESSAGE = "mesurer:offscreen-recording-stop";
export const OFFSCREEN_RECORDING_ABORT_MESSAGE = "mesurer:offscreen-recording-abort";
export const BOOT_KEY = "__MESURER_BOOT__";
export const STYLES_KEY = "__MESURER_STYLES__";
// Set to false by the test page, whose tests start from Persist being off. Nothing else sets it.
export const PERSIST_DEFAULT_KEY = "__MESURER_PERSIST_DEFAULT__";

export type ExtensionBoot = "toggle" | "restore";

export type SessionMessage = {
  type: typeof SESSION_MESSAGE;
  open: boolean;
};
