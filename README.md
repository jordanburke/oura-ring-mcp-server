# oura-ring-mcp-server

[![Node.js CI](https://github.com/jordanburke/oura-ring-mcp-server/actions/workflows/node.js.yml/badge.svg)](https://github.com/jordanburke/oura-ring-mcp-server/actions/workflows/node.js.yml)
[![npm version](https://img.shields.io/npm/v/oura-ring-mcp-server.svg)](https://www.npmjs.com/package/oura-ring-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Oura Ring API v2](https://cloud.ouraring.com/v2/docs). Point Claude (or any MCP client)
at your Oura data and ask about your sleep, readiness, activity, heart rate, workouts, and more.

Built with [`somamcp`](https://github.com/sapientsai/SomaMCP) (telemetry + introspection),
[`functype`](https://functype.org) (typed error handling), and `zod`.

## Design

Rather than one tool per endpoint, the server exposes a **single consolidated `oura_data` tool**
with a `collection` parameter. This keeps the tool schema small (low token cost) while covering
every Oura `usercollection` endpoint. The tool validates that the parameters you pass are legal
for the chosen collection and returns actionable messages when they are not.

## Requirements

- **Node.js 24+** (pinned in `.nvmrc`)
- An Oura **personal access token** — create one at
  [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)

## Usage

### Claude Desktop / Claude Code

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oura": {
      "command": "npx",
      "args": ["-y", "oura-ring-mcp-server"],
      "env": {
        "OURA_API_KEY": "your-personal-access-token"
      }
    }
  }
}
```

That runs the server over stdio, which is what most MCP clients expect.

### Configuration

| Env var                  | Required | Default   | Description                                                                 |
| ------------------------ | -------- | --------- | --------------------------------------------------------------------------- |
| `OURA_API_KEY`           | yes      | —         | Oura personal access token, sent as a Bearer token.                         |
| `OURA_SANDBOX`           | no       | `false`   | Use Oura's `/sandbox/` demo data instead of your real data.                 |
| `TRANSPORT_TYPE`         | no       | `stdio`   | `stdio` or `httpStream`.                                                    |
| `PORT`                   | no       | `3000`    | Port for `httpStream` transport.                                            |
| `HOST`                   | no       | `0.0.0.0` | Host for `httpStream` transport.                                            |
| `OURA_TELEMETRY_FILE`    | no       | —         | Write NDJSON telemetry events to this file path (safe under any transport). |
| `OURA_TELEMETRY_CONSOLE` | no       | `true`    | Console telemetry, `httpStream` only (never enabled under stdio).           |

### HTTP transport

For a long-running / networked deployment:

```bash
OURA_API_KEY=... TRANSPORT_TYPE=httpStream PORT=3000 npx -y oura-ring-mcp-server
```

The MCP endpoint is served at `/mcp`; `somamcp` also exposes a public `GET /health` probe.

## The `oura_data` tool

| Parameter                         | Applies to                        | Notes                                       |
| --------------------------------- | --------------------------------- | ------------------------------------------- |
| `collection`                      | all                               | Which data collection to fetch (see below). |
| `start_date` / `end_date`         | daily collections                 | `YYYY-MM-DD`. Omitted → last 7 days.        |
| `start_datetime` / `end_datetime` | `heartrate`, `ring_battery_level` | ISO-8601. Omitted → last 24 hours.          |
| `latest`                          | `heartrate`, `ring_battery_level` | Return only the most recent sample.         |
| `document_id`                     | collections with a detail route   | Fetch a single record by id.                |
| `next_token`                      | list collections                  | Pagination cursor from a previous response. |
| `fields`                          | list collections                  | Comma-separated sparse fieldset.            |

### Collections

**Daily** (`start_date`/`end_date`): `daily_activity`, `daily_sleep`, `daily_readiness`,
`daily_spo2`, `daily_stress`, `daily_resilience`, `daily_cardiovascular_age`, `vO2_max`,
`sleep`, `sleep_time`, `session`, `workout`, `tag`, `enhanced_tag`, `rest_mode_period`

**Time-series** (`start_datetime`/`end_datetime`): `heartrate`, `ring_battery_level`

**List / singleton**: `ring_configuration`, `personal_info`

### Example prompts

- "What was my average readiness score last week?"
- "Show my sleep stages for the night of 2026-06-20."
- "Get my most recent heart rate reading."
- "How many workouts did I log this month and how long were they?"

## Development

```bash
pnpm install
pnpm validate   # format + lint + typecheck + test + build
pnpm dev        # watch build
pnpm inspect    # run against the MCP Inspector
```

Try it without a ring by setting `OURA_SANDBOX=true` to hit Oura's demo dataset.

## License

MIT
