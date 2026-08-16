## ADDED Requirements

### Requirement: Native browser tool registration
The bundle SHALL register its browser operations directly in the DeepSeek Harness tool registry and SHALL NOT start, call, or require an MCP server.

#### Scenario: Bundle loads in a profile
- **WHEN** a DSH profile enables the bundle
- **THEN** the `browser_start`, `browser_close`, `browser_navigate`, `browser_click`, `browser_type`, `browser_evaluate`, `browser_snapshot`, `browser_screenshot`, `browser_get_cookies`, and `browser_set_cookies` tools are registered

### Requirement: Persistent local browser runtime
The bundle SHALL send operations to one private Python worker process that imports CloakBrowser directly and retains a session until `browser_close` or plugin disposal.

#### Scenario: Follow-up operation uses a session
- **WHEN** `browser_start` returns a session id and a later browser tool supplies it
- **THEN** the worker SHALL apply the operation to that same session

#### Scenario: Plugin unloads
- **WHEN** DSH disposes the bundle plugin
- **THEN** the worker SHALL close all active browser contexts before exit

### Requirement: Bounded worker dispatch
The worker SHALL dispatch only its documented operation names and SHALL return structured errors for unknown names or invalid arguments.

#### Scenario: Unknown operation
- **WHEN** the worker receives an operation outside its fixed map
- **THEN** it SHALL reject the request without evaluating an attribute name supplied by the caller
