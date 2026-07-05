#!/usr/bin/env node
import "dotenv/config"

import { readFileSync } from "node:fs"

import { createServer } from "somamcp"

import { parseConfig } from "./config"
import { buildTelemetry } from "./telemetry"
import { createOuraDataTool } from "./tools/ouraData"

// Single source of truth for identity: package.json sits at the package root in every
// layout we ship (npm install and the .mcpb bundle both keep it one level above dist/).
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  name: string
  version: `${number}.${number}.${number}`
}
const NAME = pkg.name
const VERSION = pkg.version

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
