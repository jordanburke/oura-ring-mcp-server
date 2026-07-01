import { describe, expect, it } from "vitest"

import { parseConfig } from "../src/config"

const base = { OURA_API_KEY: "test-token" } satisfies NodeJS.ProcessEnv

describe("parseConfig", () => {
  it("fails when OURA_API_KEY is missing", () => {
    const result = parseConfig({})
    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) expect(result.value).toContain("OURA_API_KEY")
  })

  it("fails when OURA_API_KEY is blank", () => {
    expect(parseConfig({ OURA_API_KEY: "   " }).isLeft()).toBe(true)
  })

  it("returns prod defaults for a valid key", () => {
    const result = parseConfig({ ...base })
    expect(result.isRight()).toBe(true)
    if (result.isRight()) {
      expect(result.value.apiKey).toBe("test-token")
      expect(result.value.apiBase).toBe("https://api.ouraring.com/v2/usercollection")
      expect(result.value.sandbox).toBe(false)
      expect(result.value.transportType).toBe("stdio")
      expect(result.value.port).toBe(3000)
      expect(result.value.host).toBe("0.0.0.0")
    }
  })

  it("switches to the sandbox base when OURA_SANDBOX is truthy", () => {
    const result = parseConfig({ ...base, OURA_SANDBOX: "true" })
    expect(result.isRight()).toBe(true)
    if (result.isRight()) {
      expect(result.value.sandbox).toBe(true)
      expect(result.value.apiBase).toBe("https://api.ouraring.com/v2/sandbox/usercollection")
    }
  })

  it("accepts httpStream with explicit port/host", () => {
    const result = parseConfig({ ...base, TRANSPORT_TYPE: "httpStream", PORT: "8080", HOST: "127.0.0.1" })
    expect(result.isRight()).toBe(true)
    if (result.isRight()) {
      expect(result.value.transportType).toBe("httpStream")
      expect(result.value.port).toBe(8080)
      expect(result.value.host).toBe("127.0.0.1")
    }
  })

  it("rejects an unknown transport type", () => {
    const result = parseConfig({ ...base, TRANSPORT_TYPE: "grpc" })
    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) expect(result.value).toContain("TRANSPORT_TYPE")
  })

  it.each(["0", "70000", "abc", "-1"])("rejects invalid PORT %s", (port) => {
    const result = parseConfig({ ...base, PORT: port })
    expect(result.isLeft()).toBe(true)
    if (result.isLeft()) expect(result.value).toContain("PORT")
  })
})
