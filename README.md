# dsh-cloakbrowser

[中文文档](README.zh-CN.md)

`dsh-cloakbrowser` is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that lets an agent use a locally installed CloakBrowser.

## CloakBrowser attribution and licensing

This plugin connects [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) to DeepSeek Harness. CloakBrowser itself is developed and maintained by CloakHQ; this is not an official CloakBrowser plugin.

You install CloakBrowser separately through CloakHQ's official flow. This repository only contains the DSH integration and does not include or redistribute the CloakBrowser browser binary. The Python wrapper is MIT-licensed; the browser binary has its own [Binary License](https://github.com/CloakHQ/CloakBrowser/blob/main/BINARY-LICENSE.md).

## Install from GitHub

Requirements: Node.js 22.19 or newer, Python 3.11 or newer, and Git.

### 1. Install DSH and pnpm

```bash
npm install --global @deepseek-ai/dsh pnpm
```

### 2. Create a Python environment for CloakBrowser

```bash
python3 -m venv ~/.dsh/venvs/cloakbrowser
~/.dsh/venvs/cloakbrowser/bin/python -m pip install 'cloakbrowser>=0.4,<1' playwright
~/.dsh/venvs/cloakbrowser/bin/python -m cloakbrowser install
```

### 3. Clone this repository and add the plugin to DSH's web profile

```bash
git clone https://github.com/SJF-ECNU/dsh-cloakbrowser.git
cd dsh-cloakbrowser
dsh plugin --profile web add "$PWD"
```

You can also install directly from GitHub without a checkout:

```bash
dsh plugin --profile web add github:SJF-ECNU/dsh-cloakbrowser
```

### 4. Start DSH

```bash
export CLOAKBROWSER_DSH_PYTHON="$HOME/.dsh/venvs/cloakbrowser/bin/python"
dsh web
```

DSH prints a local URL; open it in a browser. The environment variable must also be present on later launches. Add it to your shell configuration if you want it to persist.

### 5. Verify the plugin

```bash
dsh --profile web --dump-config | grep -A3 'dsh-cloakbrowser'
```

The output should contain the `dsh-cloakbrowser` layer and the `cloakbrowser` plugin row.

## Upgrade or remove

To update a checkout installation:

```bash
cd /path/to/dsh-cloakbrowser
git pull --ff-only
dsh plugin --profile web update dsh-cloakbrowser
```

To remove the plugin:

```bash
dsh plugin --profile web remove dsh-cloakbrowser
```

To pin a direct GitHub installation to an exact commit:

```bash
dsh plugin --profile web add github:SJF-ECNU/dsh-cloakbrowser#COMMIT_SHA
```

## Local development

For local development, install the Python dependencies in the interpreter you plan to use:

```bash
python3 -m pip install 'cloakbrowser>=0.4,<1' playwright
python3 -m cloakbrowser install
```

Set `CLOAKBROWSER_DSH_PYTHON` when the required Python interpreter is not `python3`.

## Tools

- `browser_start`, `browser_close`
- `browser_navigate`, `browser_click`, `browser_type`, `browser_evaluate`
- `browser_snapshot`, `browser_screenshot`
- `browser_get_cookies`, `browser_set_cookies`

Sessions are local to one running DSH process. The Python worker is a private child process that imports `cloakbrowser` directly, owns browser contexts, and communicates only through inherited stdio.

## Publish

The package is a DSH bundle: its `package.json` declares `dsh.bundle.patch`, and `cordis.patch.yml` inserts the plugin by package name. It ships plain JavaScript and Python files, so Git installs do not require a `prepare` build permission.

Before publishing:

```bash
npm test
python3 test/test_bridge.py
npm pack --dry-run
```

Check that the tarball includes `cordis.patch.yml` and `python/bridge.py`, then publish prebuilt assets:

```bash
npm publish --access public
```

## Security

Browser tools can access the target site's authenticated state, cookies, and any local profile passed to CloakBrowser. Install only a trusted bundle, review requests before approving browser actions, and do not put credentials into tool arguments unless the action requires them.

## Known Limitations and Deferred Work

- This first release exposes the core single-page session workflow only; tabs, persistent profiles, CDP attachment, virtual display, and humanized per-action operations are intentionally deferred.
- The plugin relies on the local Python CloakBrowser installation. It does not install Python packages or browser binaries automatically.
