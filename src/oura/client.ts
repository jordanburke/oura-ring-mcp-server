import { Either, Left, tryCatchAsync } from "functype"

import type { OuraConfig } from "../config"
import { getCollection } from "./collections"
import type { OuraDataParams } from "./params"

export type OuraErrorKind = "network" | "http" | "parse" | "config"

export type OuraError = {
  readonly kind: OuraErrorKind
  readonly message: string
  readonly status?: number
  readonly detail?: unknown
}

export type FetchLike = typeof fetch

export type RequestDeps = {
  readonly fetchFn?: FetchLike
  /** Injectable clock so default date ranges are deterministic in tests. */
  readonly now?: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const fmtDate = (d: Date): string => d.toISOString().slice(0, 10)

const httpMessage = (status: number, detail: unknown): string => {
  const suffix = detail !== undefined && detail !== null ? ` ${JSON.stringify(detail)}` : ""
  switch (status) {
    case 400:
      return `Oura rejected the request as invalid (400).${suffix}`
    case 401:
      return `Oura authentication failed (401). Verify OURA_API_KEY is a valid personal access token.${suffix}`
    case 403:
      return `Oura denied access (403). The token may lack the required scope for this collection.${suffix}`
    case 404:
      return `Oura returned not found (404). The document_id may be wrong or unavailable.${suffix}`
    case 422:
      return `Oura could not process the parameters (422).${suffix}`
    case 429:
      return `Oura rate limit exceeded (429). Wait and retry with a narrower date range.${suffix}`
    default:
      return `Oura request failed with HTTP ${status}.${suffix}`
  }
}

const safeBody = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    try {
      return await res.text()
    } catch {
      return undefined
    }
  }
}

/** Build the fully-qualified Oura request URL for the given (already-validated) params. */
export const buildUrl = (config: OuraConfig, params: OuraDataParams, now: Date): string => {
  const descriptor = getCollection(params.collection)
  if (!descriptor) throw new Error(`Unknown collection "${params.collection}"`)

  const base = `${config.apiBase}/${descriptor.name}`

  if (descriptor.kind === "singleton") return base
  if (params.document_id) return `${base}/${encodeURIComponent(params.document_id)}`

  const q = new URLSearchParams()

  if (descriptor.kind === "daily") {
    if (params.start_date === undefined && params.end_date === undefined) {
      q.set("start_date", fmtDate(new Date(now.getTime() - 7 * DAY_MS)))
      q.set("end_date", fmtDate(now))
    } else {
      if (params.start_date !== undefined) q.set("start_date", params.start_date)
      if (params.end_date !== undefined) q.set("end_date", params.end_date)
    }
  } else if (descriptor.kind === "datetime") {
    if (params.start_datetime === undefined && params.end_datetime === undefined && !params.latest) {
      q.set("start_datetime", new Date(now.getTime() - DAY_MS).toISOString())
      q.set("end_datetime", now.toISOString())
    } else {
      if (params.start_datetime !== undefined) q.set("start_datetime", params.start_datetime)
      if (params.end_datetime !== undefined) q.set("end_datetime", params.end_datetime)
    }
    if (params.latest) q.set("latest", "true")
  }

  if (params.next_token !== undefined) q.set("next_token", params.next_token)
  if (params.fields !== undefined) q.set("fields", params.fields)

  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Perform an Oura API request and return the parsed JSON as `Right`, or a classified
 * {@link OuraError} as `Left`. Never throws for network/HTTP/parse failures.
 */
export const requestOura = async (
  config: OuraConfig,
  params: OuraDataParams,
  deps: RequestDeps = {},
): Promise<Either<OuraError, unknown>> => {
  const doFetch = deps.fetchFn ?? fetch
  const now = deps.now ?? new Date()
  const url = buildUrl(config, params, now)

  const fetched = await tryCatchAsync<OuraError, Response>(
    () =>
      doFetch(url, {
        headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
      }),
    (e) => ({ kind: "network", message: `Network request to Oura failed: ${errMessage(e)}` }),
  )

  if (fetched.isLeft()) return Left<OuraError, unknown>(fetched.value)

  const res = fetched.value
  if (!res.ok) {
    const detail = await safeBody(res)
    return Left<OuraError, unknown>({
      kind: "http",
      status: res.status,
      message: httpMessage(res.status, detail),
      detail,
    })
  }

  return tryCatchAsync<OuraError, unknown>(
    () => res.json(),
    (e) => ({ kind: "parse", message: `Failed to parse Oura response as JSON: ${errMessage(e)}` }),
  )
}
