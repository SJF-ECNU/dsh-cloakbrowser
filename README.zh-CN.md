# dsh-cloakbrowser

[English](README.md)

`dsh-cloakbrowser` 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，让智能体能够使用本机已安装的 CloakBrowser。

## CloakBrowser 说明与许可

本插件将 [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) 接入 DeepSeek Harness。CloakBrowser 由 CloakHQ 开发和维护；本项目不是 CloakBrowser 官方插件。

请通过 CloakHQ 的官方流程单独安装 CloakBrowser。本仓库只包含 DSH 集成，不包含或分发 CloakBrowser 浏览器二进制。Python wrapper 使用 MIT 许可证；浏览器二进制适用其单独的 [Binary License](https://github.com/CloakHQ/CloakBrowser/blob/main/BINARY-LICENSE.md)。

## 从 GitHub 安装

前提条件：Node.js 22.19 或更新版本、Python 3.11 或更新版本，以及 Git。

### 1. 安装 DSH 和 pnpm

```bash
npm install --global @deepseek-ai/dsh pnpm
```

### 2. 创建 CloakBrowser 的 Python 环境

```bash
python3 -m venv ~/.dsh/venvs/cloakbrowser
~/.dsh/venvs/cloakbrowser/bin/python -m pip install 'cloakbrowser>=0.4,<1' playwright
~/.dsh/venvs/cloakbrowser/bin/python -m cloakbrowser install
```

### 3. 克隆本仓库，并将插件加入 DSH 的 web profile

```bash
git clone https://github.com/SJF-ECNU/dsh-cloakbrowser.git
cd dsh-cloakbrowser
dsh plugin --profile web add "$PWD"
```

也可以不克隆仓库，直接从 GitHub 安装：

```bash
dsh plugin --profile web add github:SJF-ECNU/dsh-cloakbrowser
```

### 4. 启动 DSH

```bash
export CLOAKBROWSER_DSH_PYTHON="$HOME/.dsh/venvs/cloakbrowser/bin/python"
dsh web
```

DSH 会输出本地访问地址，在浏览器中打开即可。之后每次启动也需要这个环境变量；如需长期使用，可将它写入 shell 配置文件。

### 5. 验证插件已加载

```bash
dsh --profile web --dump-config | grep -A3 'dsh-cloakbrowser'
```

输出中应包含 `dsh-cloakbrowser` 层和 `cloakbrowser` 插件条目。

## 更新或卸载

更新通过本地仓库安装的插件：

```bash
cd /path/to/dsh-cloakbrowser
git pull --ff-only
dsh plugin --profile web update dsh-cloakbrowser
```

卸载插件：

```bash
dsh plugin --profile web remove dsh-cloakbrowser
```

若直接从 GitHub 安装，也可以固定到指定提交：

```bash
dsh plugin --profile web add github:SJF-ECNU/dsh-cloakbrowser#COMMIT_SHA
```

## 本地开发

本地开发时，在计划使用的 Python 解释器中安装依赖：

```bash
python3 -m pip install 'cloakbrowser>=0.4,<1' playwright
python3 -m cloakbrowser install
```

若该解释器不是 `python3`，请设置 `CLOAKBROWSER_DSH_PYTHON`。

## 工具

- `browser_start`、`browser_close`
- `browser_open_tab`、`browser_list_tabs`、`browser_activate_tab`、`browser_close_tab`
- `browser_navigate`、`browser_click`、`browser_type`、`browser_evaluate`
- `browser_snapshot`、`browser_screenshot`
- `browser_get_cookies`、`browser_set_cookies`

会话仅存在于一个运行中的 DSH 进程内。Python worker 是私有子进程：它直接导入 `cloakbrowser`、持有浏览器上下文，并通过继承的标准输入输出与插件通信。

### 标签页、profile、CDP、虚拟显示与拟人化操作

`browser_start` 会返回 `active_tab_id` 和初始标签页列表。使用标签页工具创建或切换标签页；页面工具可传入 `tab_id` 操作后台标签页，省略时操作当前活动标签页。

向 `browser_start` 传入 `profile_dir` 会使用 CloakBrowser 原生持久 context。该目录归调用方所有；重复使用即可保留 Cookie 和存储数据，请勿让不可信智能体指向含有凭据的 profile。

传入 `cdp_port` 会暴露 `http://127.0.0.1:<port>`。插件始终将 CDP 绑定到回环地址，因此本机 Playwright/CDP 客户端可以接入，而不会把浏览器控制权限暴露到网络。

在 Linux 上，传入 `virtual_display: { width, height }` 会在私有 Xvfb 显示器上以有头模式运行浏览器。Xvfb 必须已安装并在 `PATH` 中；插件不会安装系统软件包，并会在会话关闭时停止它启动的 Xvfb 子进程。

启动会话时设置 `humanize: true`，并可选传 `human_preset: "careful"` 或原生 `human_config`。`browser_click` 和 `browser_type` 也接受单次操作的 `human_config` 覆盖；未以 `humanize: true` 启动的会话会明确拒绝该覆盖。

## 发布

该包是 DSH bundle：`package.json` 声明了 `dsh.bundle.patch`，`cordis.patch.yml` 按包名插入插件。仓库发布纯 JavaScript 和 Python 文件，因此通过 Git 安装时不需要执行 `prepare` 构建。

发布前执行：

```bash
npm test
python3 test/test_bridge.py
npm pack --dry-run
```

确认 tarball 包含 `cordis.patch.yml` 和 `python/bridge.py` 后，发布预构建产物：

```bash
npm publish --access public
```

## 安全提示

浏览器工具可以访问目标网站的登录状态、Cookie，以及传给 CloakBrowser 的本地 profile。请只安装可信插件，在批准浏览器操作前审查请求；除非操作确有需要，不要把凭据放进工具参数。

## 已知限制

- CDP 仅暴露由本插件启动的会话；暂不支持让 bridge 附着到任意既有 CDP endpoint。
- 虚拟显示需要 Linux 和预先安装的 Xvfb；它不是自动依赖安装器，也不是远程桌面服务。
- 插件依赖本地 Python CloakBrowser 安装，不会自动安装 Python 包或浏览器二进制。
