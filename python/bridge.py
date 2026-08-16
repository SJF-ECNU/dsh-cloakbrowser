from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any


class CloakBrowserRuntime:
    def __init__(self) -> None:
        self.sessions: dict[str, tuple[Any, Any]] = {}

    async def browser_start(
        self,
        headless: bool = True,
        proxy: str | None = None,
        locale: str | None = None,
        timezone: str | None = None,
        user_agent: str | None = None,
        viewport: dict[str, int] | None = None,
        humanize: bool = False,
    ) -> dict[str, Any]:
        from cloakbrowser import launch_context_async

        options = {
            "headless": headless,
            "proxy": proxy,
            "locale": locale,
            "timezone": timezone,
            "user_agent": user_agent,
            "viewport": viewport,
            "humanize": humanize,
        }
        context = await launch_context_async(**{key: value for key, value in options.items() if value is not None})
        page = await context.new_page()
        session_id = uuid.uuid4().hex
        self.sessions[session_id] = (context, page)
        return {"session_id": session_id}

    async def browser_close(self, session_id: str) -> dict[str, Any]:
        context, _ = self._session(session_id)
        await context.close()
        del self.sessions[session_id]
        return {"ok": True, "session_id": session_id}

    async def browser_navigate(self, session_id: str, url: str) -> dict[str, Any]:
        _, page = self._session(session_id)
        await page.goto(url)
        return {"session_id": session_id, "url": page.url, "title": await page.title()}

    async def browser_click(self, session_id: str, selector: str) -> dict[str, Any]:
        _, page = self._session(session_id)
        await page.click(selector)
        return {"ok": True, "session_id": session_id}

    async def browser_type(self, session_id: str, selector: str, text: str) -> dict[str, Any]:
        _, page = self._session(session_id)
        await page.fill(selector, text)
        return {"ok": True, "session_id": session_id}

    async def browser_evaluate(self, session_id: str, script: str) -> Any:
        _, page = self._session(session_id)
        return await page.evaluate(script)

    async def browser_snapshot(self, session_id: str) -> dict[str, Any]:
        _, page = self._session(session_id)
        return {
            "session_id": session_id,
            "url": page.url,
            "title": await page.title(),
            "text": await page.locator("body").inner_text(),
        }

    async def browser_screenshot(self, session_id: str, full_page: bool = False) -> dict[str, Any]:
        _, page = self._session(session_id)
        output = Path(tempfile.gettempdir()) / "dsh-cloakbrowser" / f"{session_id}.png"
        output.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(output), full_page=full_page)
        return {"session_id": session_id, "path": str(output)}

    async def browser_get_cookies(self, session_id: str) -> dict[str, Any]:
        context, _ = self._session(session_id)
        return {"session_id": session_id, "cookies": await context.cookies()}

    async def browser_set_cookies(self, session_id: str, cookies: list[dict[str, Any]]) -> dict[str, Any]:
        context, _ = self._session(session_id)
        await context.add_cookies(cookies)
        return {"ok": True, "session_id": session_id}

    async def close_all(self) -> None:
        for session_id in list(self.sessions):
            await self.browser_close(session_id)

    def _session(self, session_id: str) -> tuple[Any, Any]:
        try:
            return self.sessions[session_id]
        except KeyError as exc:
            raise ValueError(f"Unknown session: {session_id}") from exc


class Dispatcher:
    def __init__(self, runtime: Any) -> None:
        self.runtime = runtime
        self.operations = {
            "browser_start": runtime.browser_start,
            "browser_close": runtime.browser_close,
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
