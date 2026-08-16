import assert from 'node:assert/strict'
import test from 'node:test'

import packageManifest from '../package.json' with { type: 'json' }
import { tools } from '../tools.js'

test('bundle manifest references the patch file', () => {
  assert.equal(packageManifest.dsh.bundle.patch, './cordis.patch.yml')
})

test('native tool set includes the requested browser capabilities', () => {
  assert.deepEqual(tools.map((tool) => tool.name), [
    'browser_start',
    'browser_close',
    'browser_open_tab',
    'browser_list_tabs',
    'browser_activate_tab',
    'browser_close_tab',
    'browser_navigate',
    'browser_click',
    'browser_type',
    'browser_evaluate',
    'browser_snapshot',
    'browser_screenshot',
    'browser_get_cookies',
    'browser_set_cookies',
  ])
})

test('tool schemas expose launch modes and tab-targeted actions', () => {
  const start = tools.find((tool) => tool.name === 'browser_start')
  const click = tools.find((tool) => tool.name === 'browser_click')
  const navigate = tools.find((tool) => tool.name === 'browser_navigate')

  assert.equal(start.parameters.properties.profile_dir.type, 'string')
  assert.equal(start.parameters.properties.cdp_port.type, 'integer')
  assert.equal(start.parameters.properties.virtual_display.type, 'object')
  assert.equal(start.parameters.properties.human_preset.enum.includes('careful'), true)
  assert.equal(click.parameters.properties.human_config.type, 'object')
  assert.equal(navigate.parameters.properties.tab_id.type, 'string')
})
