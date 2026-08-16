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
dsh web
```

DSH prints a local URL; open it in a browser. When `~/.dsh/venvs/cloakbrowser/bin/python` exists, the plugin uses it automatically. Set `CLOAKBROWSER_DSH_PYTHON` only when CloakBrowser is installed in another Python environment.

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
- `browser_open_tab`, `browser_list_tabs`, `browser_activate_tab`, `browser_close_tab`
- `browser_navigate`, `browser_click`, `browser_click_point`, `browser_type`, `browser_evaluate`
- `browser_snapshot`, `browser_screenshot`, `browser_understand`
- `browser_get_cookies`, `browser_set_cookies`

Sessions are local to one running DSH process. The Python worker is a private child process that imports `cloakbrowser` directly, owns browser contexts, and communicates only through inherited stdio.

### Tabs, profiles, CDP, virtual display, and humanized actions

`browser_start` returns an `active_tab_id` and the initial tab list. Open or select tabs with the tab tools; pass `tab_id` to page tools to target a background tab, or omit it to use the active tab.

Pass `profile_dir` to `browser_start` to use CloakBrowser's native persistent context. The folder is caller-owned: reuse it for persistent cookies and storage, and do not point an untrusted agent at a profile containing credentials.

Pass `cdp_port` to expose the session at `http://127.0.0.1:<port>`. The plugin always binds CDP to loopback, so other local Playwright/CDP clients can attach without exposing browser control to the network.

On Linux, pass `virtual_display: { width, height }` to launch a headed browser on a private Xvfb display. Xvfb must already be installed and available on `PATH`; the plugin does not install system packages and stops the Xvfb child when the session closes.

Set `humanize: true` and optionally `human_preset: "careful"` or a native `human_config` when starting a session. `browser_click` and `browser_type` accept `human_config` for an individual native action override; this override is rejected unless the session was started with `humanize: true`.

### Visual understanding

In DSH, open **Settings → Plugins → Plugin configuration → Visual understanding model**. Enter an OpenAI-compatible API Base URL (including its version path), an image-capable model name, choose **Chat Completions** or **Responses**, and enter the API key. The Base URL, model, and API style are normal DSH settings; the API key is stored through DSH's write-only credentials store and is never displayed again.

`browser_understand` is deliberately explicit: the agent calls it only when visual grounding is needed. It sends the selected tab's current viewport screenshot to the endpoint you configured and returns a summary plus CSS viewport coordinates. Use those coordinates with `browser_click_point`; normal DOM actions should continue to use selectors. The tool does not solve CAPTCHA or human-verification challenges: it reports that user action is needed.

## Security

Browser tools can access the target site's authenticated state, cookies, and any local profile passed to CloakBrowser. Install only a trusted bundle, review requests before approving browser actions, and do not put credentials into tool arguments unless the action requires them.

Visual understanding sends a screenshot to the third-party endpoint configured by the user only for an explicit `browser_understand` call. Do not invoke it on sensitive pages unless that disclosure is intended.

## Known Limitations

- CDP support exposes a session started by this plugin; attaching the bridge to an arbitrary existing CDP endpoint is not implemented.
- Virtual display support requires Linux and a pre-installed Xvfb. It is not an automatic dependency installer or a remote desktop service.
- The plugin relies on the local Python CloakBrowser installation. It does not install Python packages or browser binaries automatically.
