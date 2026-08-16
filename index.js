import { CloakBrowserBridge } from './bridge.js'
import { tools } from './tools.js'

export const name = 'cloakbrowser'
export const inject = ['tools']

export function apply(ctx) {
  const bridge = new CloakBrowserBridge()
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
