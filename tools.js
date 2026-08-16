const requiredString = { type: 'string' }
const humanConfig = { type: 'object', additionalProperties: true }

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
        viewport: viewportSchema(),
        profile_dir: { type: 'string', description: 'Persistent CloakBrowser profile directory.' },
        cdp_port: { type: 'integer', minimum: 1, maximum: 65535, description: 'Expose CDP on this loopback-only port.' },
        virtual_display: {
          type: 'object',
          properties: { width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 } },
          required: ['width', 'height'],
          additionalProperties: false,
          description: 'Start a private Linux Xvfb display and run headed.',
        },
        humanize: { type: 'boolean' },
        human_preset: { type: 'string', enum: ['default', 'careful'] },
        human_config: humanConfig,
      },
      additionalProperties: false,
    },
  },
  { name: 'browser_close', description: 'Close a browser session.', parameters: sessionParameters() },
  { name: 'browser_open_tab', description: 'Open a new tab and make it active.', parameters: sessionParameters({ url: requiredString }) },
  { name: 'browser_list_tabs', description: 'List the tabs in a browser session.', parameters: sessionParameters() },
  { name: 'browser_activate_tab', description: 'Make a session tab active.', parameters: tabParameters() },
  { name: 'browser_close_tab', description: 'Close a session tab.', parameters: tabParameters() },
  { name: 'browser_navigate', description: 'Navigate the selected or active tab to a URL.', parameters: pageParameters({ url: requiredString }, ['url']) },
  { name: 'browser_click', description: 'Click an element in the selected or active tab.', parameters: pageParameters({ selector: requiredString, human_config: humanConfig }, ['selector']) },
  {
    name: 'browser_click_point',
    description: 'Click CSS viewport coordinates in the selected or active tab. Use coordinates returned by browser_understand.',
    parameters: pageParameters({ x: { type: 'number' }, y: { type: 'number' } }, ['x', 'y']),
  },
  { name: 'browser_type', description: 'Type text in an element in the selected or active tab.', parameters: pageParameters({ selector: requiredString, text: requiredString, human_config: humanConfig }, ['selector', 'text']) },
  { name: 'browser_evaluate', description: 'Evaluate JavaScript in the selected or active tab.', parameters: pageParameters({ script: requiredString }, ['script']) },
  { name: 'browser_snapshot', description: 'Read URL, title, and visible page text from the selected or active tab.', parameters: pageParameters() },
  { name: 'browser_screenshot', description: 'Capture a PNG screenshot from the selected or active tab.', parameters: pageParameters({ full_page: { type: 'boolean' } }) },
  {
    name: 'browser_understand',
    description: 'Use the user-configured visual model to understand visible page content, layout, and images, or locate actionable elements. Content requests return a description and image observations; locating requests also return CSS viewport coordinates. It identifies CAPTCHA challenges for user handoff and does not solve them.',
    parameters: pageParameters({ request: requiredString }, ['request']),
  },
  { name: 'browser_get_cookies', description: 'Read cookies for a browser session.', parameters: sessionParameters() },
  {
    name: 'browser_set_cookies',
    description: 'Set cookies for a browser session.',
    parameters: sessionParameters({ cookies: { type: 'array', items: { type: 'object', additionalProperties: true } } }, ['cookies']),
  },
]

function viewportSchema() {
  return {
    type: 'object',
    properties: { width: { type: 'integer' }, height: { type: 'integer' } },
    additionalProperties: false,
  }
}

function sessionParameters(extra = {}, extraRequired = []) {
  return {
    type: 'object',
    properties: { session_id: requiredString, ...extra },
    required: ['session_id', ...extraRequired],
    additionalProperties: false,
  }
}

function pageParameters(extra = {}, extraRequired = []) {
  return sessionParameters({ tab_id: requiredString, ...extra }, extraRequired)
}

function tabParameters() {
  return sessionParameters({ tab_id: requiredString }, ['tab_id'])
}
