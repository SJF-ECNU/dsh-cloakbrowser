import { CloakBrowserBridge } from './bridge.js'
import { tools } from './tools.js'

export const name = 'cloakbrowser'
export const inject = ['tools', 'settings', 'credentials', 'webServer']

const VISION_SETTINGS_NAMESPACE = 'cloakbrowser'
const VISION_API_KEY_REF = 'CLOAKBROWSER_VISION_API_KEY'
const VISION_CONFIG_PATH = '/api/plugins/cloakbrowser/vision-config'

const visionSettingsSchema = Object.assign((value) => {
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new TypeError('cloakbrowser settings must be an object')
  }
  const source = value ?? {}
  const base_url = source.base_url ?? ''
  const model = source.model ?? ''
  const api_style = source.api_style ?? 'chat_completions'
  if (typeof base_url !== 'string' || typeof model !== 'string') {
    throw new TypeError('cloakbrowser base_url and model must be strings')
  }
  if (!['chat_completions', 'responses'].includes(api_style)) {
    throw new TypeError('cloakbrowser api_style must be chat_completions or responses')
  }
  return { base_url, model, api_style }
}, {
  toJSON() {
    return {
      type: 'object',
      properties: {
        base_url: { type: 'string' },
        model: { type: 'string' },
        api_style: { type: 'string', enum: ['chat_completions', 'responses'] },
      },
      additionalProperties: false,
    }
  },
})

export function apply(ctx, config = {}) {
  let settingsScope
  let credentials

  ctx.inject(['settings', 'credentials', 'webServer'], (runtime) => {
    settingsScope = runtime.settings.register(VISION_SETTINGS_NAMESPACE, visionSettingsSchema, { base: config })
    credentials = runtime.credentials
    runtime.effect(() => runtime.webServer.register({
      kind: 'exact',
      path: VISION_CONFIG_PATH,
      async handler(request, response) {
        if (request.method === 'GET') {
          return sendJson(response, 200, settingsScope.get())
        }
        if (request.method !== 'PUT') {
          response.writeHead(405, { Allow: 'GET, PUT' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          return sendJson(response, 403, { error: 'same-origin request required' })
        }
        const next = visionSettingsSchema(await readJsonBody(request))
        await settingsScope.replace(next)
        return sendJson(response, 200, settingsScope.get())
      },
    }), 'cloakbrowser: vision configuration route')
  })

  const bridge = new CloakBrowserBridge({
    async vision() {
      if (!settingsScope || !credentials) {
        throw new Error('The CloakBrowser visual-model configuration service is unavailable')
      }
      const settings = settingsScope.get()
      if (!settings.base_url.trim() || !settings.model.trim()) {
        throw new Error('Configure the visual model Base URL and model in Plugins settings before using browser_understand')
      }
      const credential = await credentials.resolve(VISION_API_KEY_REF)
      if (!credential) {
        throw new Error('Configure the visual model API key in Plugins settings before using browser_understand')
      }
      return { ...settings, api_key: credential.value }
    },
  })
  ctx.effect(() => () => bridge.stop())
  for (const tool of tools) {
    ctx.tools.register({
      ...tool,
      output: {
        schema: {},
        render: (_arguments, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(arguments_, exec) {
        return bridge.call(tool.name, arguments_, exec.signal)
      },
    })
  }
}

function sameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8 * 1024) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new TypeError('request body must be JSON')
  }
}
