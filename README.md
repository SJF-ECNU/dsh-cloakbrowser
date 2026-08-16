# dsh-cloakbrowser

`dsh-cloakbrowser` is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that lets an agent use a locally installed CloakBrowser.

## CloakBrowser attribution and licensing

This plugin connects [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) to DeepSeek Harness. CloakBrowser itself is developed and maintained by CloakHQ; this is not an official CloakBrowser plugin.

You install CloakBrowser separately through CloakHQ's official flow. This repository only contains the DSH integration and does not include or redistribute the CloakBrowser browser binary. The Python wrapper is MIT-licensed; the browser binary has its own [Binary License](https://github.com/CloakHQ/CloakBrowser/blob/main/BINARY-LICENSE.md).

## Prerequisites

- DeepSeek Harness and Node.js 22.19 or newer.
- Python 3.11 or newer.
- A Python environment containing CloakBrowser and Playwright:

```bash
python3 -m pip install 'cloakbrowser>=0.4,<1' playwright
python3 -m playwright install chromium
```

Set `CLOAKBROWSER_DSH_PYTHON` when the required Python interpreter is not `python3`.

## Install

Install the bundle into a DSH profile:

```bash
dsh plugin --profile web add dsh-cloakbrowser
dsh --profile web --dump-config
```

The config output must contain a `# == dsh-cloakbrowser` layer and the `cloakbrowser` plugin row. Start the profile normally after that:

```bash
dsh --profile web
```

For a local checkout, use its absolute path:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-cloakbrowser
```

Remove it with:

```bash
dsh plugin --profile web remove dsh-cloakbrowser
```

## Tools

- `browser_start`, `browser_close`
- `browser_navigate`, `browser_click`, `browser_type`, `browser_evaluate`
- `browser_snapshot`, `browser_screenshot`
- `browser_get_cookies`, `browser_set_cookies`

Sessions are local to one running DSH process. The Python worker is a private child process that imports `cloakbrowser` directly, owns browser contexts, and communicates only through inherited stdio. It opens no network listener and uses no MCP protocol.

## Publish

The package is a DSH bundle: its `package.json` declares `dsh.bundle.patch`, and `cordis.patch.yml` inserts the plugin by package name. It ships plain JavaScript and Python files, so Git installs do not require a `prepare` build permission.

Before publishing:

```bash
npm test
python3 -m unittest test/test_bridge.py
npm pack --dry-run
```

Check that the tarball includes `cordis.patch.yml` and `python/bridge.py`, then publish prebuilt assets:

```bash
npm publish --access public
```

For a Git install, users can pin the exact commit:

```bash
dsh plugin --profile web add github:OWNER/dsh-cloakbrowser#COMMIT_SHA
```

## Security

Browser tools can access the target site's authenticated state, cookies, and any local profile passed to CloakBrowser. Install only a trusted bundle, review requests before approving browser actions, and do not put credentials into tool arguments unless the action requires them.

## Known Limitations and Deferred Work

- This first release exposes the core single-page session workflow only; tabs, persistent profiles, CDP attachment, virtual display, and humanized per-action operations are intentionally deferred.
- The plugin relies on the local Python CloakBrowser installation. It does not install Python packages or browser binaries automatically.
