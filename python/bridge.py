from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class BrowserSession:
    context: Any
    tabs: dict[str, Any]
    active_tab_id: str | None
    humanize: bool
    cdp_url: str | None = None
    display_process: asyncio.subprocess.Process | None = None


class CloakBrowserRuntime:
    def __init__(self) -> None:
        self.sessions: dict[str, BrowserSession] = {}

    async def browser_start(
        self,
        headless: bool = True,
        proxy: str | None = None,
        locale: str | None = None,
        timezone: str | None = None,
        user_agent: str | None = None,
        viewport: dict[str, int] | None = None,
        profile_dir: str | None = None,
        cdp_port: int | None = None,
        virtual_display: dict[str, int] | None = None,
        humanize: bool = False,
        human_preset: str = "default",
        human_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if cdp_port is not None and not 1 <= cdp_port <= 65535:
            raise ValueError("cdp_port must be between 1 and 65535")

        display = None
        display_process = None
        if virtual_display is not None:
            display, display_process = await self._start_virtual_display(virtual_display)
            headless = False

        args = []
        cdp_url = None
        if cdp_port is not None:
            args = ["--remote-debugging-address=127.0.0.1", f"--remote-debugging-port={cdp_port}"]
            cdp_url = f"http://127.0.0.1:{cdp_port}"

        options = {
            "headless": headless,
            "proxy": proxy,
            "locale": locale,
            "timezone": timezone,
            "user_agent": user_agent,
            "viewport": viewport,
            "humanize": humanize,
            "human_preset": human_preset,
            "human_config": human_config,
        }
        if args:
            options["args"] = args
        options = {key: value for key, value in options.items() if value is not None}

        try:
            from cloakbrowser import launch_context_async, launch_persistent_context_async

            if profile_dir is None:
                context = await self._launch_with_display(launch_context_async, display, **options)
            else:
                context = await self._launch_with_display(launch_persistent_context_async, display, profile_dir, **options)
        except BaseException:
            await self._stop_display(display_process)
            raise

        tabs: dict[str, Any] = {}
        for page in context.pages:
            tabs[self._new_tab_id()] = page
        if not tabs:
            tabs[self._new_tab_id()] = await context.new_page()
        active_tab_id = next(reversed(tabs))
        session_id = uuid.uuid4().hex
        session = BrowserSession(context, tabs, active_tab_id, humanize, cdp_url, display_process)
        self.sessions[session_id] = session
        return {
            "session_id": session_id,
            "active_tab_id": active_tab_id,
            "tabs": [await self._tab_descriptor(session, tab_id) for tab_id in tabs],
            "cdp_url": cdp_url,
        }

    async def browser_close(self, session_id: str) -> dict[str, Any]:
        session = self._session(session_id)
        try:
            await session.context.close()
        finally:
            await self._stop_display(session.display_process)
            del self.sessions[session_id]
        return {"ok": True, "session_id": session_id}

    async def browser_open_tab(self, session_id: str, url: str | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        page = await session.context.new_page()
        tab_id = self._new_tab_id()
        session.tabs[tab_id] = page
        session.active_tab_id = tab_id
        if url is not None:
            await page.goto(url)
        return await self._tab_descriptor(session, tab_id)

    async def browser_list_tabs(self, session_id: str) -> dict[str, Any]:
        session = self._session(session_id)
        self._discard_closed_tabs(session)
        return {
            "session_id": session_id,
            "active_tab_id": session.active_tab_id,
            "tabs": [await self._tab_descriptor(session, tab_id) for tab_id in session.tabs],
        }

    async def browser_activate_tab(self, session_id: str, tab_id: str) -> dict[str, Any]:
        session = self._session(session_id)
        self._page(session, tab_id)
        session.active_tab_id = tab_id
        return await self._tab_descriptor(session, tab_id)

    async def browser_close_tab(self, session_id: str, tab_id: str) -> dict[str, Any]:
        session = self._session(session_id)
        page = self._page(session, tab_id)
        await page.close()
        del session.tabs[tab_id]
        if session.active_tab_id == tab_id:
            session.active_tab_id = next(iter(session.tabs), None)
        return {"ok": True, "session_id": session_id, "active_tab_id": session.active_tab_id}

    async def browser_navigate(self, session_id: str, url: str, tab_id: str | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        page = self._page(session, tab_id)
        await page.goto(url)
        return {"session_id": session_id, "tab_id": self._selected_tab_id(session, tab_id), "url": page.url, "title": await page.title()}

    async def browser_click(self, session_id: str, selector: str, tab_id: str | None = None, human_config: dict[str, Any] | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        page = self._page(session, tab_id)
        await page.click(selector, **self._human_action_options(session, human_config))
        return {"ok": True, "session_id": session_id, "tab_id": self._selected_tab_id(session, tab_id)}

    async def browser_type(self, session_id: str, selector: str, text: str, tab_id: str | None = None, human_config: dict[str, Any] | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        page = self._page(session, tab_id)
        await page.fill(selector, text, **self._human_action_options(session, human_config))
        return {"ok": True, "session_id": session_id, "tab_id": self._selected_tab_id(session, tab_id)}

    async def browser_evaluate(self, session_id: str, script: str, tab_id: str | None = None) -> Any:
        return await self._page(self._session(session_id), tab_id).evaluate(script)

    async def browser_snapshot(self, session_id: str, tab_id: str | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        page = self._page(session, tab_id)
        return {
            "session_id": session_id,
            "tab_id": self._selected_tab_id(session, tab_id),
            "url": page.url,
            "title": await page.title(),
            "text": await page.locator("body").inner_text(),
        }

    async def browser_screenshot(self, session_id: str, full_page: bool = False, tab_id: str | None = None) -> dict[str, Any]:
        session = self._session(session_id)
        tab = self._selected_tab_id(session, tab_id)
        output = Path(tempfile.gettempdir()) / "dsh-cloakbrowser" / f"{session_id}-{tab}.png"
        output.parent.mkdir(parents=True, exist_ok=True)
        await self._page(session, tab).screenshot(path=str(output), full_page=full_page)
        return {"session_id": session_id, "tab_id": tab, "path": str(output)}

    async def browser_get_cookies(self, session_id: str) -> dict[str, Any]:
        session = self._session(session_id)
        return {"session_id": session_id, "cookies": await session.context.cookies()}

    async def browser_set_cookies(self, session_id: str, cookies: list[dict[str, Any]]) -> dict[str, Any]:
        session = self._session(session_id)
        await session.context.add_cookies(cookies)
        return {"ok": True, "session_id": session_id}

    async def close_all(self) -> None:
        for session_id in list(self.sessions):
            await self.browser_close(session_id)

    async def _launch_with_display(self, launcher: Any, display: str | None, *args: Any, **kwargs: Any) -> Any:
        if display is None:
            return await launcher(*args, **kwargs)
        previous_display = os.environ.get("DISPLAY")
        os.environ["DISPLAY"] = display
        try:
            return await launcher(*args, **kwargs)
        finally:
            if previous_display is None:
                os.environ.pop("DISPLAY", None)
            else:
                os.environ["DISPLAY"] = previous_display

    async def _start_virtual_display(self, virtual_display: dict[str, int]) -> tuple[str, asyncio.subprocess.Process]:
        if sys.platform != "linux":
            raise RuntimeError("virtual_display requires Linux with Xvfb installed")
        xvfb = shutil.which("Xvfb")
        if xvfb is None:
            raise RuntimeError("virtual_display requires Xvfb on PATH")
        width = virtual_display.get("width")
        height = virtual_display.get("height")
        if not isinstance(width, int) or not isinstance(height, int) or width < 1 or height < 1:
            raise ValueError("virtual_display width and height must be positive integers")
        display = self._available_display()
        process = await asyncio.create_subprocess_exec(
            xvfb, display, "-screen", "0", f"{width}x{height}x24", "-nolisten", "tcp",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.sleep(0.05)
        if process.returncode is not None:
            raise RuntimeError("Xvfb failed to start")
        return display, process

    async def _stop_display(self, process: asyncio.subprocess.Process | None) -> None:
        if process is None or process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=1)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()

    @staticmethod
    def _available_display() -> str:
        for number in range(90, 200):
            if not Path(f"/tmp/.X11-unix/X{number}").exists():
                return f":{number}"
        raise RuntimeError("no free Xvfb display number is available")

    @staticmethod
    def _new_tab_id() -> str:
        return uuid.uuid4().hex

    def _session(self, session_id: str) -> BrowserSession:
        try:
            return self.sessions[session_id]
        except KeyError as exc:
            raise ValueError(f"Unknown session: {session_id}") from exc

    def _selected_tab_id(self, session: BrowserSession, tab_id: str | None) -> str:
        selected = tab_id or session.active_tab_id
        if selected is None:
            raise ValueError("Session has no active tab; open a tab first")
        return selected

    def _page(self, session: BrowserSession, tab_id: str | None) -> Any:
        self._discard_closed_tabs(session)
        selected = self._selected_tab_id(session, tab_id)
        try:
            return session.tabs[selected]
        except KeyError as exc:
            raise ValueError(f"Unknown tab: {selected}") from exc

    def _discard_closed_tabs(self, session: BrowserSession) -> None:
        for tab_id, page in list(session.tabs.items()):
            if page.is_closed():
                del session.tabs[tab_id]
        if session.active_tab_id not in session.tabs:
            session.active_tab_id = next(iter(session.tabs), None)

    async def _tab_descriptor(self, session: BrowserSession, tab_id: str) -> dict[str, Any]:
        page = self._page(session, tab_id)
        return {"tab_id": tab_id, "url": page.url, "title": await page.title(), "active": tab_id == session.active_tab_id}

    @staticmethod
    def _human_action_options(session: BrowserSession, human_config: dict[str, Any] | None) -> dict[str, Any]:
        if human_config is None:
            return {}
        if not session.humanize:
            raise ValueError("human_config requires browser_start(humanize=True)")
        return {"human_config": human_config}


class Dispatcher:
    def __init__(self, runtime: Any) -> None:
        self.runtime = runtime
        self.operations = {
            "browser_start": runtime.browser_start,
            "browser_close": runtime.browser_close,
            "browser_open_tab": runtime.browser_open_tab,
            "browser_list_tabs": runtime.browser_list_tabs,
            "browser_activate_tab": runtime.browser_activate_tab,
            "browser_close_tab": runtime.browser_close_tab,
            "browser_navigate": runtime.browser_navigate,
            "browser_click": runtime.browser_click,
            "browser_type": runtime.browser_type,
            "browser_evaluate": runtime.browser_evaluate,
            "browser_snapshot": runtime.browser_snapshot,
            "browser_screenshot": runtime.browser_screenshot,
            "browser_get_cookies": runtime.browser_get_cookies,
            "browser_set_cookies": runtime.browser_set_cookies,
        }

    async def dispatch(self, request: dict[str, Any]) -> dict[str, Any]:
        request_id = request.get("id")
        operation = request.get("operation")
        arguments = request.get("arguments")
        handler = self.operations.get(operation)
        if handler is None:
            return _error(request_id, "UnknownOperation", f"Unsupported operation: {operation}")
        if not isinstance(arguments, dict):
            return _error(request_id, "InvalidArguments", "arguments must be an object")
        try:
            return {"id": request_id, "ok": True, "value": await handler(**arguments)}
        except Exception as exc:
            return _error(request_id, type(exc).__name__, str(exc))


def _error(request_id: Any, error_type: str, message: str) -> dict[str, Any]:
    return {"id": request_id, "ok": False, "error": {"type": error_type, "message": message}}


async def serve() -> None:
    runtime = CloakBrowserRuntime()
    dispatcher = Dispatcher(runtime)
    try:
        for line in sys.stdin:
            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                response = _error(None, "InvalidRequest", "request must be valid JSON")
            else:
                if request.get("operation") == "shutdown":
                    response = {"id": request.get("id"), "ok": True, "value": None}
                    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
                    sys.stdout.flush()
                    break
                response = await dispatcher.dispatch(request)
            sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    finally:
        await runtime.close_all()


if __name__ == "__main__":
    asyncio.run(serve())
