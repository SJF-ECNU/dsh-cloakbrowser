window.__ModuleLoader__.load({
  id: 'dsh-cloakbrowser',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useState } = React

    const css = `
      .cloak-vision-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;overflow:hidden}
      .cloak-vision-head{width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
      .cloak-vision-title{font-size:15px;font-weight:600}.cloak-vision-desc{margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}
      .cloak-vision-body{border-top:1px solid var(--dsw-alias-border-l2);padding:0 16px 12px}.cloak-vision-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
      .cloak-vision-field label{font-size:13px;font-weight:500}.cloak-vision-field input,.cloak-vision-field select{height:34px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;padding:0 12px}
      .cloak-vision-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.cloak-vision-status{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .cloak-vision-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:12px}.cloak-vision-actions button{font:inherit;border-radius:8px;padding:5px 14px;cursor:pointer}.cloak-vision-discard{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}.cloak-vision-save{border:1px solid var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
      .cloak-vision-error{margin:12px 0 0;color:var(--dsw-alias-label-error);font-size:12px}.cloak-vision-badge{border-radius:999px;background:var(--dsw-alias-bg-module-platform);padding:1px 8px;color:var(--dsw-alias-label-secondary);font-size:11px}
    `
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-cloakbrowser/vision"]')) {
      const style = document.createElement('style')
      style.dataset.pluginCss = 'dsh-cloakbrowser/vision'
      style.textContent = css
      document.head.appendChild(style)
    }

    const empty = { base_url: '', model: '', api_style: 'chat_completions' }

    function VisionCard({ api }) {
      const [open, setOpen] = useState(false)
      const [draft, setDraft] = useState(empty)
      const [original, setOriginal] = useState(empty)
      const [key, setKey] = useState('')
      const [keyStatus, setKeyStatus] = useState('正在读取密钥状态…')
      const [keyWritable, setKeyWritable] = useState(false)
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')

      const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
          const [configResponse, credentialResponse] = await Promise.all([
            fetch('/api/plugins/cloakbrowser/vision-config', { cache: 'no-store' }),
            api.credentials.describe({ refs: ['CLOAKBROWSER_VISION_API_KEY'] }),
          ])
          if (!configResponse.ok) throw new Error('CloakBrowser 设置暂不可用')
          if (!credentialResponse.result.ok) throw new Error(credentialResponse.result.error.message)
          const value = { ...empty, ...await configResponse.json() }
          const credential = credentialResponse.result.value.credentials.CLOAKBROWSER_VISION_API_KEY
          setOriginal(value)
          setDraft(value)
          setKey('')
          setKeyWritable(credential?.writable === true)
          setKeyStatus(credential?.configured ? (credential.writable ? '已配置' : `已配置（${credential.source ?? '只读来源'}）`) : '未配置')
        } finally {
          setLoading(false)
        }
      }, [api])

      useEffect(() => {
        load().catch((cause) => setError(cause.message))
        return api.$on?.('settings/document-updated', () => load().catch(() => {}))
      }, [api, load])

      const save = async () => {
        setSaving(true)
        setError('')
        try {
          const ops = Object.entries(draft).filter(([field, value]) => original[field] !== value).map(([field, value]) => ({ op: 'set', path: [field], value }))
          if (ops.length) {
            const response = await fetch('/api/plugins/cloakbrowser/vision-config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(draft),
            })
            if (!response.ok) throw new Error('CloakBrowser 设置保存失败')
          }
          if (key) {
            const response = await api.credentials.set({ ref: 'CLOAKBROWSER_VISION_API_KEY', value: key })
            if (!response.result.ok) throw new Error(response.result.error.message)
          }
          await load()
        } catch (cause) {
          setError(cause.message)
        } finally {
          setSaving(false)
        }
      }

      const field = (id, label, control, hint) => h('div', { className: 'cloak-vision-field', key: id }, [h('label', { htmlFor: id, key: 'label' }, label), control, h('div', { className: 'cloak-vision-hint', key: 'hint' }, hint)])
      const change = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
      const dirty = JSON.stringify(draft) !== JSON.stringify(original) || key.length > 0

      return h('section', { className: 'cloak-vision-card' }, [
        h('button', { type: 'button', className: 'cloak-vision-head', onClick: () => setOpen((value) => !value), 'aria-expanded': open, key: 'head' }, [
          h('span', { key: 'copy' }, [h('div', { className: 'cloak-vision-title', key: 'title' }, '视觉理解模型'), h('div', { className: 'cloak-vision-desc', key: 'desc' }, '为 browser_understand 配置 OpenAI 兼容的视觉模型。仅在调用该工具时发送当前截图。')]),
          h('span', { className: 'cloak-vision-badge', key: 'toggle' }, open ? '收起' : '展开'),
        ]),
        open && h('div', { className: 'cloak-vision-body', key: 'body' }, loading ? '正在加载…' : [
          field('cloak-vision-base-url', 'Base URL', h('input', { id: 'cloak-vision-base-url', value: draft.base_url, onChange: change('base_url'), placeholder: 'https://example.com/v1' }), 'OpenAI 兼容 API 的版本根路径；插件会追加 /chat/completions 或 /responses。'),
          field('cloak-vision-model', '模型', h('input', { id: 'cloak-vision-model', value: draft.model, onChange: change('model'), placeholder: 'your-vision-model' }), '填写该服务商提供的可接收图片的模型名称。'),
          field('cloak-vision-api-style', 'API 形式', h('select', { id: 'cloak-vision-api-style', value: draft.api_style, onChange: change('api_style') }, [h('option', { value: 'chat_completions', key: 'chat' }, 'Chat Completions'), h('option', { value: 'responses', key: 'responses' }, 'Responses')]), '按服务商的 OpenAI 兼容接口选择。'),
          field('cloak-vision-api-key', 'API Key', h('input', { id: 'cloak-vision-api-key', type: 'password', autoComplete: 'off', value: key, onChange: (event) => setKey(event.target.value), disabled: keyStatus.includes('只读') }), h('span', { className: 'cloak-vision-status' }, `${keyStatus}${keyStatus === '未配置' || keyWritable ? '；输入新值后保存' : ''}`)),
          error && h('p', { className: 'cloak-vision-error', key: 'error' }, error),
          h('div', { className: 'cloak-vision-actions', key: 'actions' }, [h('button', { type: 'button', className: 'cloak-vision-discard', onClick: () => { setDraft(original); setKey(''); setError('') }, disabled: saving || !dirty, key: 'discard' }, '放弃修改'), h('button', { type: 'button', className: 'cloak-vision-save', onClick: save, disabled: saving || !dirty, key: 'save' }, saving ? '保存中…' : '保存')]),
        ]),
      ])
    }

    function apply(ctx) {
      const { api } = ctx.get('connection')
      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', id: 'cloakbrowser-vision', order: 50, label: 'CloakBrowser visual understanding' }, () => h(VisionCard, { api })))
    }

    module.exports = { inject: ['slots', 'connection', 'remote', 'settingsScope'], apply }
    return module.exports
  },
})
