import asyncio
import importlib.util
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location("bridge", Path(__file__).parents[1] / "python" / "bridge.py")
bridge = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(bridge)


class FakeRuntime:
    async def browser_start(self, **arguments): return arguments
    async def browser_close(self, **arguments): return arguments
    async def browser_navigate(self, **arguments): return arguments
    async def browser_click(self, **arguments): return arguments
    async def browser_type(self, **arguments): return arguments
    async def browser_evaluate(self, **arguments): return arguments
    async def browser_snapshot(self, **arguments): return arguments
    async def browser_screenshot(self, **arguments): return arguments
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


if __name__ == "__main__":
    unittest.main()
