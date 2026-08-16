import assert from 'node:assert/strict'
import test from 'node:test'

import packageManifest from '../package.json' with { type: 'json' }
import { tools } from '../tools.js'

test('bundle manifest references the patch file', () => {
  assert.equal(packageManifest.dsh.bundle.patch, './cordis.patch.yml')
})

test('native tool set is complete for the first release', () => {
  assert.deepEqual(tools.map((tool) => tool.name), [
    'browser_start',
    'browser_close',
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
