window.__ModuleLoader__.load({
  id: 'dsh-cloakbrowser',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const { IconChevronDownOutline14 } = require('@deepseek-ai/dsh-client-ui-primitives')
    const { createElement: h, useCallback, useEffect, useState } = React

    const css = `
      .cloak-vision-card{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;transition:border-color .16s,background .16s}
      .cloak-vision-card:hover{border-color:var(--dsw-alias-label-dimmed)}.cloak-vision-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
      .cloak-vision-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.cloak-vision-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .cloak-vision-head-text{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.cloak-vision-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.cloak-vision-desc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}
      .cloak-vision-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.cloak-vision-chevron-open{transform:rotate(180deg)}.cloak-vision-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}
      .cloak-vision-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.cloak-vision-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.cloak-vision-field+.cloak-vision-field{border-top:1px solid var(--dsw-alias-border-l2)}.cloak-vision-field-head{align-items:center;gap:8px;display:flex}
      .cloak-vision-field label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.cloak-vision-field input,.cloak-vision-field select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.cloak-vision-field input:focus-visible,.cloak-vision-field select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
      .cloak-vision-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}.cloak-vision-status{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.cloak-vision-status-muted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}
      .cloak-vision-actions{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.cloak-vision-actions button{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.cloak-vision-discard{border-color:var(--dsw-alias-border-l2)!important;color:var(--dsw-alias-label-secondary);background:0 0}.cloak-vision-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)!important}.cloak-vision-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.cloak-vision-actions button:disabled{opacity:.4;cursor:default}.cloak-vision-actions button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .cloak-vision-error{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}
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

      const field = (id, label, control, hint, status) => h('div', { className: 'cloak-vision-field', key: id }, [h('div', { className: 'cloak-vision-field-head', key: 'head' }, [h('label', { htmlFor: id, key: 'label' }, label), status]), control, h('p', { className: 'cloak-vision-hint', key: 'hint' }, hint)])
      const change = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
      const dirty = JSON.stringify(draft) !== JSON.stringify(original) || key.length > 0

      return h('li', { className: `cloak-vision-card${open ? ' cloak-vision-card-open' : ''}` }, [
        h('button', { type: 'button', className: 'cloak-vision-head', onClick: () => setOpen((value) => !value), 'aria-expanded': open, 'aria-label': `${open ? '收起设置' : '展开设置'}: 视觉理解模型`, key: 'head' }, [
          h('span', { className: 'cloak-vision-head-text', key: 'copy' }, [h('span', { className: 'cloak-vision-title', key: 'title' }, '视觉理解模型'), h('span', { className: 'cloak-vision-desc', key: 'desc' }, '为 browser_understand 配置 OpenAI 兼容的视觉模型。仅在调用该工具时发送当前截图。')]),
          dirty && h('span', { className: 'cloak-vision-pending', key: 'pending' }, '未保存'),
          h(IconChevronDownOutline14, { className: `cloak-vision-chevron${open ? ' cloak-vision-chevron-open' : ''}`, key: 'toggle' }),
        ]),
        open && h('div', { className: 'cloak-vision-body', key: 'body' }, loading ? '正在加载…' : [
          field('cloak-vision-base-url', 'Base URL', h('input', { id: 'cloak-vision-base-url', value: draft.base_url, onChange: change('base_url'), placeholder: 'https://example.com/v1' }), 'OpenAI 兼容 API 的版本根路径；插件会追加 /chat/completions 或 /responses。'),
          field('cloak-vision-model', '模型', h('input', { id: 'cloak-vision-model', value: draft.model, onChange: change('model'), placeholder: 'your-vision-model' }), '填写该服务商提供的可接收图片的模型名称。'),
          field('cloak-vision-api-style', 'API 形式', h('select', { id: 'cloak-vision-api-style', value: draft.api_style, onChange: change('api_style') }, [h('option', { value: 'chat_completions', key: 'chat' }, 'Chat Completions'), h('option', { value: 'responses', key: 'responses' }, 'Responses')]), '按服务商的 OpenAI 兼容接口选择。'),
          field('cloak-vision-api-key', 'API Key', h('input', { id: 'cloak-vision-api-key', type: 'password', autoComplete: 'off', value: key, onChange: (event) => setKey(event.target.value), disabled: keyStatus.includes('只读') }), '留空表示保持当前密钥。', h('span', { className: keyStatus === '未配置' ? 'cloak-vision-status-muted' : 'cloak-vision-status', key: 'status' }, keyStatus)),
          h('div', { className: 'cloak-vision-actions', key: 'actions' }, [error && h('p', { className: 'cloak-vision-error', role: 'status', key: 'error' }, error), h('button', { type: 'button', className: 'cloak-vision-discard', onClick: () => { setDraft(original); setKey(''); setError('') }, disabled: saving || !dirty, key: 'discard' }, '放弃修改'), h('button', { type: 'button', className: 'cloak-vision-save', onClick: save, disabled: saving || !dirty, key: 'save' }, saving ? '保存中…' : '保存')]),
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
