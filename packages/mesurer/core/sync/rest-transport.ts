import type {
  SyncExchangeRequest,
  SyncExchangeResponse,
  SyncRemoteOperation,
  SyncTransport,
} from "./types"
import { SyncTransportError } from "./types"

export type RestSyncTransportOptions = {
  url: string
  fetch?: typeof globalThis.fetch
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  credentials?: RequestCredentials
  timeoutMs?: number
}

const isRemoteOperation = (value: unknown): value is SyncRemoteOperation => {
  if (!value || typeof value !== "object") return false
  const input = value as Record<string, unknown>
  return Boolean(input.operation) && Number.isSafeInteger(input.serverSequence)
}

const parseResponse = (value: unknown): SyncExchangeResponse => {
  if (!value || typeof value !== "object") {
    throw new SyncTransportError("Sync server returned an invalid response", { retryable: false })
  }
  const input = value as Record<string, unknown>
  if (
    !Array.isArray(input.acknowledgedOperationIds) ||
    !input.acknowledgedOperationIds.every((id) => typeof id === "string") ||
    !Array.isArray(input.operations) ||
    !input.operations.every(isRemoteOperation) ||
    !Number.isSafeInteger(input.cursor) ||
    typeof input.hasMore !== "boolean"
  ) {
    throw new SyncTransportError("Sync server returned an invalid response", { retryable: false })
  }
  return input as SyncExchangeResponse
}

export const createRestSyncTransport = ({
  url,
  fetch: fetchImplementation = globalThis.fetch,
  headers,
  credentials = "same-origin",
  timeoutMs = 15_000,
}: RestSyncTransportOptions): SyncTransport => {
  if (!url) throw new Error("Sync transport URL is required")
  if (!fetchImplementation) throw new Error("Fetch is unavailable")
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Sync transport timeout must be positive")
  }

  return {
    exchange: async (request: SyncExchangeRequest) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const configuredHeaders = typeof headers === "function" ? await headers() : headers
        const requestHeaders = new Headers(configuredHeaders)
        if (!requestHeaders.has("content-type")) {
          requestHeaders.set("content-type", "application/json")
        }
        const response = await fetchImplementation(url, {
          method: "POST",
          headers: requestHeaders,
          credentials,
          signal: controller.signal,
          body: JSON.stringify(request),
        })
        if (!response.ok) {
          const retryable = response.status === 408 || response.status === 425 ||
            response.status === 429 || response.status >= 500
          throw new SyncTransportError(`Sync request failed with status ${response.status}`, {
            retryable,
          })
        }
        return parseResponse(await response.json())
      } catch (error) {
        if (error instanceof SyncTransportError) throw error
        throw new SyncTransportError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Sync request timed out"
            : "Sync request failed",
          { cause: error },
        )
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
