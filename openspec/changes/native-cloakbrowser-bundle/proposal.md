## Why

DeepSeek Harness users need CloakBrowser browser automation as native tools, without installing or routing through an MCP server. A standalone DSH bundle makes that capability installable with `dsh plugin` and keeps the browser runtime local to the user's machine.

## What Changes

- Add an installable `dsh-cloakbrowser` bundle with a `dsh.bundle.patch` manifest.
- Register native Cordis browser tools directly through `ctx.tools.register()`.
- Ship a private Python worker that imports `cloakbrowser` directly and maintains browser sessions over the plugin process lifetime.
- Document profile installation, Python prerequisites, Git/tarball release paths, and plugin removal.

## Capabilities

### New Capabilities

- `native-cloakbrowser-tools`: DSH-native CloakBrowser session and page operations without MCP.
- `installable-dsh-bundle`: DSH bundle metadata and installation guidance for the standalone plugin.

### Modified Capabilities

- None.

## Impact

- New standalone repository with an npm bundle, local Python worker, and tests.
- Runtime prerequisites: Node.js for DSH plus Python with `cloakbrowser` and Playwright Chromium installed.
- No dependencies on the existing CloakBrowser MCP repository or on MCP transports.
