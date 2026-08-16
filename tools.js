const requiredString = { type: 'string' }

export const tools = [
  {
    name: 'browser_start',
    description: 'Start a local CloakBrowser session.',
    parameters: {
      type: 'object',
      properties: {
        headless: { type: 'boolean' },
        proxy: { type: 'string' },
        locale: { type: 'string' },
        timezone: { type: 'string' },
        user_agent: { type: 'string' },
        viewport: {
          type: 'object',
          properties: { width: { type: 'integer' }, height: { type: 'integer' } },
          additionalProperties: false,
        },
        humanize: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  { name: 'browser_close', description: 'Close a browser session.', parameters: sessionParameters() },
  { name: 'browser_navigate', description: 'Navigate the active page to a URL.', parameters: sessionParameters({ url: requiredString }, ['url']) },
  { name: 'browser_click', description: 'Click an element by CSS selector.', parameters: sessionParameters({ selector: requiredString }, ['selector']) },
  { name: 'browser_type', description: 'Type text into an element by CSS selector.', parameters: sessionParameters({ selector: requiredString, text: requiredString }, ['selector', 'text']) },
  { name: 'browser_evaluate', description: 'Evaluate JavaScript in the active page.', parameters: sessionParameters({ script: requiredString }, ['script']) },
  { name: 'browser_snapshot', description: 'Read URL, title, and visible page text.', parameters: sessionParameters() },
  { name: 'browser_screenshot', description: 'Capture a PNG screenshot and return its path.', parameters: sessionParameters({ full_page: { type: 'boolean' } }) },
  { name: 'browser_get_cookies', description: 'Read cookies for a browser session.', parameters: sessionParameters() },
  {
    name: 'browser_set_cookies',
    description: 'Set cookies for a browser session.',
    parameters: sessionParameters({ cookies: { type: 'array', items: { type: 'object', additionalProperties: true } } }, ['cookies']),
  },
]

function sessionParameters(extra = {}, extraRequired = []) {
  return {
    type: 'object',
    properties: { session_id: requiredString, ...extra },
    required: ['session_id', ...extraRequired],
    additionalProperties: false,
  }
}
