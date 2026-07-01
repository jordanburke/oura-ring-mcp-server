#!/usr/bin/env node
import "dotenv/config"

import { createServer } from "somamcp"

import { parseConfig } from "./config"
import { buildTelemetry } from "./telemetry"
import { createOuraDataTool } from "./tools/ouraData"

const NAME = "oura-ring-mcp-server"
const VERSION = "0.1.0"

const stderr = (message: string): void => {
  process.stderr.write(`[${NAME}] ${message}\n`)
}

const main = async (): Promise<void> => {
  const configResult = parseConfig(process.env)
  if (configResult.isLeft()) {
    stderr(configResult.value)
    process.exit(1)
  }
  const config = configResult.value

  const server = createServer({
    name: NAME,
    version: VERSION,
    telemetry: buildTelemetry(config, process.env),
    enableIntrospection: true,
  })

  server.addTool(createOuraDataTool(config))

  if (config.transportType === "httpStream") {
    await server.start({
      transportType: "httpStream",
      httpStream: { port: config.port, host: config.host },
    })
    stderr(`listening on http://${config.host}:${config.port} (sandbox=${config.sandbox})`)
  } else {
    await server.start({ transportType: "stdio" })
  }
}

main().catch((err: unknown) => {
  stderr(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
  process.exit(1)
})
