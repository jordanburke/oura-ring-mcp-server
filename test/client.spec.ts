import { describe, expect, it, vi } from "vitest"

import type { OuraConfig } from "../src/config"
import { buildUrl, requestOura } from "../src/oura/client"
import { ouraDataParams } from "../src/oura/params"

const config: OuraConfig = {
  apiKey: "test-token",
  apiBase: "https://api.ouraring.com/v2/usercollection",
  sandbox: false,
  transportType: "stdio",
  port: 3000,
  host: "0.0.0.0",
}

const NOW = new Date("2026-06-15T12:00:00.000Z")
const params = (input: unknown) => ouraDataParams.parse(input)

describe("buildUrl", () => {
  it("targets a singleton with no query", () => {
    expect(buildUrl(config, params({ collection: "personal_info" }), NOW)).toBe(
      "https://api.ouraring.com/v2/usercollection/personal_info",
    )
  })

  it("defaults daily collections to the last 7 days", () => {
    const url = new URL(buildUrl(config, params({ collection: "daily_sleep" }), NOW))
    expect(url.pathname).toBe("/v2/usercollection/daily_sleep")
    expect(url.searchParams.get("start_date")).toBe("2026-06-08")
    expect(url.searchParams.get("end_date")).toBe("2026-06-15")
  })

  it("passes explicit daily dates through", () => {
    const url = new URL(
      buildUrl(config, params({ collection: "workout", start_date: "2026-01-01", end_date: "2026-01-31" }), NOW),
    )
    expect(url.searchParams.get("start_date")).toBe("2026-01-01")
    expect(url.searchParams.get("end_date")).toBe("2026-01-31")
  })

  it("builds a by-id path and ignores query", () => {
    expect(buildUrl(config, params({ collection: "daily_sleep", document_id: "abc 123" }), NOW)).toBe(
      "https://api.ouraring.com/v2/usercollection/daily_sleep/abc%20123",
    )
  })

  it("defaults datetime collections to the last day", () => {
    const url = new URL(buildUrl(config, params({ collection: "heartrate" }), NOW))
    expect(url.searchParams.get("start_datetime")).toBe("2026-06-14T12:00:00.000Z")
    expect(url.searchParams.get("end_datetime")).toBe("2026-06-15T12:00:00.000Z")
  })

  it("uses latest instead of a range when requested", () => {
    const url = new URL(buildUrl(config, params({ collection: "heartrate", latest: true }), NOW))
    expect(url.searchParams.get("latest")).toBe("true")
    expect(url.searchParams.get("start_datetime")).toBeNull()
  })

  it("adds next_token for a list-only collection", () => {
    const url = new URL(buildUrl(config, params({ collection: "ring_configuration", next_token: "cursor" }), NOW))
    expect(url.pathname).toBe("/v2/usercollection/ring_configuration")
    expect(url.searchParams.get("next_token")).toBe("cursor")
  })
})

describe("requestOura", () => {
  it("returns Right with parsed JSON on success and sends the bearer token", async () => {
    const payload = { data: [{ id: "1" }], next_token: null }
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    const result = await requestOura(config, params({ collection: "daily_sleep" }), { fetchFn, now: NOW })

    expect(result.isRight()).toBe(true)
    if (result.isRight()) expect(result.value).toEqual(payload)

    const [, init] = fetchFn.mock.calls[0]
    expect(init.headers.Authorization).toBe("Bearer test-token")
  })

  it("classifies a 401 as an http error mentioning the API key", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 401 }))

    const result = await requestOura(config, params({ collection: "daily_sleep" }), { fetchFn, now: NOW })

    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) {
      expect(result.value.kind).toBe("http")
      expect(result.value.status).toBe(401)
      expect(result.value.message).toContain("OURA_API_KEY")
    }
  })

  it("classifies a thrown fetch as a network error", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))

    const result = await requestOura(config, params({ collection: "daily_sleep" }), { fetchFn, now: NOW })

    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) {
      expect(result.value.kind).toBe("network")
      expect(result.value.message).toContain("ECONNREFUSED")
    }
  })

  it("classifies an unparseable body as a parse error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }))

    const result = await requestOura(config, params({ collection: "daily_sleep" }), { fetchFn, now: NOW })

    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) expect(result.value.kind).toBe("parse")
  })
})
