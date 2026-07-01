import { Either, Left, Right } from "functype"

/**
 * Resolved runtime configuration for the Oura MCP server.
 *
 * Auth is a personal access token (PAT) from https://cloud.ouraring.com/personal-access-tokens,
 * sent as a Bearer token. `apiBase` already includes the `usercollection` segment and switches
 * to Oura's `/sandbox/` demo data when `OURA_SANDBOX` is truthy.
 */
export type OuraConfig = {
  readonly apiKey: string
  readonly apiBase: string
  readonly sandbox: boolean
  readonly transportType: "stdio" | "httpStream"
  readonly port: number
  readonly host: string
}

const PROD_BASE = "https://api.ouraring.com/v2/usercollection"
const SANDBOX_BASE = "https://api.ouraring.com/v2/sandbox/usercollection"

const isTruthy = (value: string | undefined): boolean =>
  value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())

/**
 * Parse process env into an {@link OuraConfig}, or an error message describing the first problem.
 * Pure over its `env` argument so it is trivially testable.
 */
export const parseConfig = (env: NodeJS.ProcessEnv): Either<string, OuraConfig> => {
  const apiKey = env.OURA_API_KEY?.trim()
  if (!apiKey) {
    return Left(
      "OURA_API_KEY is required. Create a personal access token at " +
        "https://cloud.ouraring.com/personal-access-tokens and set it as OURA_API_KEY.",
    )
  }

  const rawTransport = (env.TRANSPORT_TYPE ?? "stdio").trim()
  if (rawTransport !== "stdio" && rawTransport !== "httpStream") {
    return Left(`TRANSPORT_TYPE must be "stdio" or "httpStream" (got "${rawTransport}").`)
  }

  const rawPort = env.PORT?.trim()
  const port = rawPort ? Number(rawPort) : 3000
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return Left(`PORT must be an integer between 1 and 65535 (got "${rawPort}").`)
  }

  const sandbox = isTruthy(env.OURA_SANDBOX)

  return Right({
    apiKey,
    apiBase: sandbox ? SANDBOX_BASE : PROD_BASE,
    sandbox,
    transportType: rawTransport,
    port,
    host: env.HOST?.trim() || "0.0.0.0",
  })
}
