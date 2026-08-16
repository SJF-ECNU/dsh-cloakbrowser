import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

export function resolveCloakBrowserPython({ env = process.env, home = homedir(), exists = existsSync } = {}) {
  if (env.CLOAKBROWSER_DSH_PYTHON) return env.CLOAKBROWSER_DSH_PYTHON
  const managedPython = join(home, '.dsh', 'venvs', 'cloakbrowser', 'bin', 'python')
  return exists(managedPython) ? managedPython : 'python3'
}

export class CloakBrowserBridge {
  #child
  #lines
  #nextId = 0
  #pending = new Map()

  constructor({ vision } = {}) {
    this.vision = vision
  }

  async call(operation, arguments_, signal) {
    if (signal.aborted) throw signal.reason
    if (operation === 'browser_understand') {
      if (!this.vision) throw new Error('Visual understanding is not configured')
      arguments_ = { ...arguments_, vision: await this.vision() }
    }
    this.#start()
    const id = String(++this.#nextId)
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.#pending.delete(id)
        reject(signal.reason instanceof Error ? signal.reason : new Error('Tool call cancelled'))
      }
      this.#pending.set(id, { resolve, reject, signal, abort })
      signal.addEventListener('abort', abort, { once: true })
      this.#child.stdin.write(`${JSON.stringify({ id, operation, arguments: arguments_ })}\n`, (error) => {
        if (error) this.#reject(id, error)
      })
    })
  }

  stop() {
    if (!this.#child) return
    const child = this.#child
    child.stdin.write(`${JSON.stringify({ id: 'shutdown', operation: 'shutdown', arguments: {} })}\n`)
    const timeout = setTimeout(() => child.kill(), 1000)
    child.once('exit', () => clearTimeout(timeout))
  }

  #start() {
    if (this.#child) return
    const python = resolveCloakBrowserPython()
    const worker = fileURLToPath(new URL('./python/bridge.py', import.meta.url))
    const child = spawn(python, [worker], { stdio: ['pipe', 'pipe', 'ignore'] })
    this.#child = child
    this.#lines = createInterface({ input: child.stdout })
    this.#lines.on('line', (line) => this.#handleLine(line))
    child.on('error', (error) => this.#fail(child, error))
    child.on('exit', () => this.#fail(child, new Error('CloakBrowser worker exited')))
  }

  #handleLine(line) {
    let response
    try {
      response = JSON.parse(line)
    } catch {
      this.#rejectAll(new Error('CloakBrowser worker returned invalid JSON'))
      return
    }
    const pending = this.#pending.get(response.id)
    if (!pending) return
    this.#pending.delete(response.id)
    pending.signal.removeEventListener('abort', pending.abort)
    if (response.ok) pending.resolve(response.value)
    else pending.reject(new Error(`${response.error.type}: ${response.error.message}`))
  }

  #reject(id, error) {
    const pending = this.#pending.get(id)
    if (!pending) return
    this.#pending.delete(id)
    pending.signal.removeEventListener('abort', pending.abort)
    pending.reject(error)
  }

  #fail(child, error) {
    if (this.#child !== child) return
    this.#child = undefined
    this.#lines?.close()
    this.#lines = undefined
    this.#rejectAll(error)
  }

  #rejectAll(error) {
    for (const [id, pending] of this.#pending) {
      this.#pending.delete(id)
      pending.signal.removeEventListener('abort', pending.abort)
      pending.reject(error)
    }
  }
}
