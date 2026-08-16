## Context

DeepSeek Harness loads installable bundle packages through a `dsh.bundle.patch` manifest. CloakBrowser's public runtime is Python, whereas DSH plugins run in Node. The plugin must therefore register native DSH tools in JavaScript while delegating browser ownership to a local Python child process.

## Goals / Non-Goals

**Goals:**

- Ship one independently installable DSH bundle.
- Expose a focused browser core: start, close, navigate, click, type, evaluate, snapshot, screenshot, and cookie read/write.
- Keep sessions in one local worker and release them when DSH unloads the plugin.
- Use no MCP server, client, endpoint, or MCP dependency.

**Non-Goals:**

- Do not replicate every Playwright operation or build a web UI.
- Do not provide remote browser hosting, credential storage, proxy management, or a permissions policy.
- Do not run package-install scripts or silently install Python/browser dependencies.

## Decisions

### Prebuilt JavaScript bundle

The published entry point is plain ESM JavaScript, not TypeScript. The npm package contains `index.js`, `bridge.js`, `cordis.patch.yml`, and the Python worker. This avoids Git dependency build permissions and fulfills the DSH bundle installation contract without a `prepare` script.

### Native ToolDefinition registration

The plugin inserts one Cordis row with `inject: ['tools']` and calls `ctx.tools.register()` using raw JSON-Schema tool definitions. This is DSH's supported native registration route and introduces no MCP translation.

### Private local Python worker

`bridge.js` starts `python3 python/bridge.py` from its own package directory. The worker uses a fixed operation map, newline-delimited JSON only on inherited stdio, and imports `cloakbrowser` directly. No port is opened and no standalone service is created. The Node side terminates the worker on plugin disposal.

### Explicit prerequisites and releases

The package declares `dsh.bundle.patch`, limits npm `files` to runtime assets, uses `npm pack --dry-run` as the publish contents check, and documents `dsh plugin add` / `remove`. Python requirements remain an explicit install step so users approve dependency and browser-binary changes.

## Risks / Trade-offs

- [Python dependencies are missing] → Return an actionable worker startup error and document the exact installation command.
- [Worker exits and sessions are lost] → Reject pending calls and start a fresh worker on a later call; callers must create a new browser session.
- [Developer-preview DSH API changes] → Keep the plugin limited to stable Cordis tool registration and test loading through the official CLI.
- [Browser actions can access authenticated state] → Keep the worker local, do not log requests, and let DSH's existing tool permission policy govern tool calls.
