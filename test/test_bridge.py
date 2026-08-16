import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


SPEC = importlib.util.spec_from_file_location("bridge", Path(__file__).parents[1] / "python" / "bridge.py")
bridge = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = bridge
SPEC.loader.exec_module(bridge)


class FakePage:
    def __init__(self, url="about:blank", title="Blank"):
        self.url = url
        self._title = title
        self.closed = False
        self.click_calls = []
        self.fill_calls = []
        self.mouse = types.SimpleNamespace(click=AsyncMock())

    async def title(self): return self._title

    async def goto(self, url):
        self.url = url

    async def click(self, selector, **kwargs):
        self.click_calls.append((selector, kwargs))

    async def fill(self, selector, text, **kwargs):
        self.fill_calls.append((selector, text, kwargs))

    async def evaluate(self, script, argument=None):
        if "window.innerWidth" in script:
            return {"width": 1280, "height": 720, "devicePixelRatio": 1}
        if "visualTargets" in script:
            return [{"x": 160, "y": 105, "width": 120, "height": 50} if target.get("content") == "Search" else None for target in argument]
        return script

    @property
    def locator(self):
        return lambda _: types.SimpleNamespace(inner_text=self._inner_text)

    async def _inner_text(self): return "visible text"

    async def screenshot(self, **kwargs):
        return b"png" if kwargs.get("type") == "png" else None

    async def close(self): self.closed = True

    def is_closed(self): return self.closed


class FakeContext:
    def __init__(self, pages=None):
        self.pages = pages or []
        self.closed = False
        self.new_pages = []

    async def new_page(self):
        page = FakePage()
        self.pages.append(page)
        self.new_pages.append(page)
        return page

    async def close(self): self.closed = True

    async def cookies(self): return []

    async def add_cookies(self, cookies): self.added_cookies = cookies


class FakeRuntime:
    async def browser_start(self, **arguments): return arguments
    async def browser_close(self, **arguments): return arguments
    async def browser_open_tab(self, **arguments): return arguments
    async def browser_list_tabs(self, **arguments): return arguments
    async def browser_activate_tab(self, **arguments): return arguments
    async def browser_close_tab(self, **arguments): return arguments
    async def browser_navigate(self, **arguments): return arguments
    async def browser_click(self, **arguments): return arguments
    async def browser_click_point(self, **arguments): return arguments
    async def browser_type(self, **arguments): return arguments
    async def browser_evaluate(self, **arguments): return arguments
    async def browser_snapshot(self, **arguments): return arguments
    async def browser_screenshot(self, **arguments): return arguments
    async def browser_understand(self, **arguments): return arguments
    async def browser_get_cookies(self, **arguments): return arguments
    async def browser_set_cookies(self, **arguments): return arguments


class DispatcherTests(unittest.TestCase):
    def test_dispatches_fixed_operation(self):
        result = asyncio.run(bridge.Dispatcher(FakeRuntime()).dispatch({
            "id": "1", "operation": "browser_navigate", "arguments": {"session_id": "s1", "url": "https://example.com"},
        }))
        self.assertEqual(result["value"]["url"], "https://example.com")

    def test_rejects_unknown_operation(self):
        result = asyncio.run(bridge.Dispatcher(FakeRuntime()).dispatch({"id": "2", "operation": "__class__", "arguments": {}}))
        self.assertEqual(result["error"]["type"], "UnknownOperation")


class RuntimeTests(unittest.TestCase):
    def _start_with(self, context, **arguments):
        launch_context = unittest.mock.AsyncMock(return_value=context)
        launch_persistent = unittest.mock.AsyncMock(return_value=context)
        cloakbrowser = types.SimpleNamespace(
            launch_context_async=launch_context,
            launch_persistent_context_async=launch_persistent,
        )
        runtime = bridge.CloakBrowserRuntime()
        with patch.dict(sys.modules, {"cloakbrowser": cloakbrowser}):
            result = asyncio.run(runtime.browser_start(**arguments))
        return runtime, result, launch_context, launch_persistent

    def test_persistent_start_returns_loopback_cdp_endpoint(self):
        context = FakeContext([FakePage("https://start.example", "Start")])
        _, result, launch_context, launch_persistent = self._start_with(
            context,
            profile_dir="/tmp/profile",
            cdp_port=9222,
            humanize=True,
            human_preset="careful",
            human_config={"typing_speed": 10},
        )

        launch_context.assert_not_awaited()
        launch_persistent.assert_awaited_once()
        args, kwargs = launch_persistent.await_args
        self.assertEqual(args, ("/tmp/profile",))
        self.assertIn("--remote-debugging-port=9222", kwargs["args"])
        self.assertIn("--remote-debugging-address=127.0.0.1", kwargs["args"])
        self.assertEqual(kwargs["human_preset"], "careful")
        self.assertEqual(result["cdp_url"], "http://127.0.0.1:9222")
        self.assertEqual(len(result["tabs"]), 1)

    def test_tab_lifecycle_and_explicit_target(self):
        runtime, start, _, _ = self._start_with(FakeContext())
        session_id = start["session_id"]
        first_tab = start["active_tab_id"]
        opened = asyncio.run(runtime.browser_open_tab(session_id, "https://second.example"))

        asyncio.run(runtime.browser_navigate(session_id, "https://first.example", tab_id=first_tab))
        self.assertEqual(asyncio.run(runtime.browser_snapshot(session_id, tab_id=first_tab))["url"], "https://first.example")
        self.assertEqual(opened["url"], "https://second.example")
        self.assertEqual(asyncio.run(runtime.browser_list_tabs(session_id))["active_tab_id"], opened["tab_id"])

        asyncio.run(runtime.browser_close_tab(session_id, opened["tab_id"]))
        self.assertEqual(asyncio.run(runtime.browser_list_tabs(session_id))["active_tab_id"], first_tab)

    def test_per_action_human_config_requires_humanized_session(self):
        runtime, start, _, _ = self._start_with(FakeContext())
        result = asyncio.run(bridge.Dispatcher(runtime).dispatch({
            "id": "3", "operation": "browser_click", "arguments": {
                "session_id": start["session_id"], "selector": "button", "human_config": {"typing_speed": 10},
            },
        }))
        self.assertEqual(result["error"]["type"], "ValueError")

    def test_per_action_human_config_reaches_page(self):
        runtime, start, _, _ = self._start_with(FakeContext(), humanize=True)
        session = runtime.sessions[start["session_id"]]
        page = session.tabs[start["active_tab_id"]]
        asyncio.run(runtime.browser_click(start["session_id"], "button", human_config={"click_delay": 1}))
        self.assertEqual(page.click_calls, [("button", {"human_config": {"click_delay": 1}})])

    def test_visual_understanding_filters_invalid_coordinates(self):
        runtime, start, _, _ = self._start_with(FakeContext())
        runtime._understand_image = unittest.mock.MagicMock(return_value={
            "summary": "found it",
            "requires_user_action": False,
            "targets": [
                {"label": "search", "content": "Search", "x": 100, "y": 200, "confidence": 0.9},
                {"label": "offscreen", "x": 2000, "y": 200},
            ],
        })
        result = asyncio.run(runtime.browser_understand(
            start["session_id"], "locate search", {"base_url": "https://example.test/v1", "model": "vision", "api_style": "chat_completions", "api_key": "secret"},
        ))
        self.assertEqual(result["viewport"]["width"], 1280)
        self.assertEqual(result["targets"], [{"label": "search", "content": "Search", "x": 160, "y": 105, "width": 120, "height": 50, "confidence": 0.9}])

    def test_point_click_requires_current_viewport_coordinates(self):
        runtime, start, _, _ = self._start_with(FakeContext())
        session = runtime.sessions[start["session_id"]]
        page = session.tabs[start["active_tab_id"]]
        asyncio.run(runtime.browser_click_point(start["session_id"], 20, 30))
        page.mouse.click.assert_awaited_once_with(20, 30)
        with self.assertRaisesRegex(ValueError, "inside the current CSS viewport"):
            asyncio.run(runtime.browser_click_point(start["session_id"], 1280, 30))

    def test_visual_response_parser_accepts_a_python_style_object(self):
        self.assertEqual(bridge.CloakBrowserRuntime._parse_analysis("{'summary': 'ok', 'targets': []}"), {"summary": "ok", "targets": []})

    def test_virtual_display_forces_a_headed_launch_and_is_cleaned_up(self):
        context = FakeContext()
        launch_context = AsyncMock(return_value=context)
        cloakbrowser = types.SimpleNamespace(
            launch_context_async=launch_context,
            launch_persistent_context_async=AsyncMock(),
        )
        runtime = bridge.CloakBrowserRuntime()
        process = object()
        runtime._start_virtual_display = AsyncMock(return_value=(":99", process))
        runtime._stop_display = AsyncMock()
        with patch.dict(sys.modules, {"cloakbrowser": cloakbrowser}):
            started = asyncio.run(runtime.browser_start(virtual_display={"width": 1920, "height": 1080}))
        self.assertFalse(launch_context.await_args.kwargs["headless"])
        asyncio.run(runtime.browser_close(started["session_id"]))
        runtime._stop_display.assert_awaited_once_with(process)


if __name__ == "__main__":
    unittest.main()
