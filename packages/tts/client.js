window.__ModuleLoader__.load({
  id: 'dsh-whale-tts',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    const BASE = 'http://127.0.0.1:9881'

    const CSS = `
      .wtts-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; }
      .wtts-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
      .wtts-btn:disabled { opacity: .5; cursor: default; }
      .wtts-btn.primary { background: var(--dsw-alias-brand-primary); color: #fff; border-color: transparent; }
      .wtts-input { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; }
      .wtts-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
      .wtts-row { display: flex; gap: 8px; align-items: center; }
      .wtts-label { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; }
      .wtts-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 14px 16px; background: var(--dsw-alias-bg-layer-1); display: flex; flex-direction: column; gap: 12px; }
      .wtts-select-wrap { position: relative; display: block; }
      .wtts-select { appearance: none; -webkit-appearance: none; padding-right: 32px; cursor: pointer; }
      .wtts-select-wrap::after { content: ''; position: absolute; right: 12px; top: 50%; width: 7px; height: 7px; margin-top: -5px; border-right: 1.5px solid var(--dsw-alias-label-secondary); border-bottom: 1.5px solid var(--dsw-alias-label-secondary); transform: rotate(45deg); pointer-events: none; }
      .wtts-select option { background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); }
    `

    const DEVICES = ['cuda', 'cpu']
    const VERSIONS = ['v2', 'v2Pro', 'v2ProPlus', 'v3', 'v4', 'v1', 'v5dev', 'v5turbo']

    function TextField({ label, value, onChange, placeholder }) {
      return h(
        'label',
        { style: { display: 'block' } },
        h('div', { className: 'wtts-label' }, label),
        h('input', {
          className: 'wtts-input',
          value: value ?? '',
          placeholder,
          onChange: (event) => onChange(event.target.value),
        }),
      )
    }

    function SelectField({ label, value, options, onChange }) {
      return h(
        'label',
        { style: { display: 'block' } },
        h('div', { className: 'wtts-label' }, label),
        h(
          'div',
          { className: 'wtts-select-wrap' },
          h(
            'select',
            {
              className: 'wtts-input wtts-select',
              value: value ?? options[0],
              onChange: (event) => onChange(event.target.value),
            },
            options.map((option) => h('option', { key: option, value: option }, option)),
          ),
        ),
      )
    }

    function PathField({ label, value, onChange, kind }) {
      const [picking, setPicking] = useState(false)
      const pick = async () => {
        setPicking(true)
        try {
          const res = await fetch(`${BASE}/pick-${kind}`, { method: 'POST' })
          const data = await res.json()
          if (data.path) onChange(data.path)
        } catch {
          // ignore
        } finally {
          setPicking(false)
        }
      }
      return h(
        'label',
        { style: { display: 'block' } },
        h('div', { className: 'wtts-label' }, label),
        h(
          'div',
          { className: 'wtts-row' },
          h('input', {
            className: 'wtts-input',
            value: value ?? '',
            onChange: (event) => onChange(event.target.value),
          }),
          h(
            'button',
            { className: 'wtts-btn', onClick: pick, disabled: picking },
            '...',
          ),
        ),
      )
    }

    function TtsSettings() {
      const [config, setConfig] = useState(null)
      const [status, setStatus] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')

      const loadConfig = useCallback(async () => {
        try {
          const data = await fetch(`${BASE}/config`).then((res) => res.json())
          setConfig(data)
        } catch (err) {
          setError(String(err))
        }
      }, [])

      const loadStatus = useCallback(async () => {
        try {
          const data = await fetch(`${BASE}/status`).then((res) => res.json())
          setStatus(data)
        } catch {
          // 状态轮询失败不打断编辑
        }
      }, [])

      useEffect(() => {
        loadConfig()
        loadStatus()
      }, [loadConfig, loadStatus])

      useEffect(() => {
        const timer = setInterval(loadStatus, 3000)
        return () => clearInterval(timer)
      }, [loadStatus])

      const post = async (path) => {
        setBusy(path)
        try {
          const res = await fetch(BASE + path, { method: 'POST' })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || String(res.status))
          await loadStatus()
          if (path === '/clear-cache') await loadStatus()
        } catch (err) {
          setError(String(err))
        } finally {
          setBusy('')
        }
      }

      const save = async () => {
        setBusy('save')
        try {
          const res = await fetch(`${BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || String(res.status))
          setError('')
          await loadConfig()
        } catch (err) {
          setError(String(err))
        } finally {
          setBusy('')
        }
      }

      if (!config) {
        return h('div', { style: { fontSize: 13 } }, error || '加载中…')
      }

      const set = (key, value) => setConfig({ ...config, [key]: value })

      return h(
        'div',
        { style: { maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 16 } },
        h('style', null, CSS),
        h('h2', { style: { margin: 0, fontSize: 18 } }, 'GPT-SoVITS 语音'),
        h(
          'div',
          { style: { fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' } },
          '用本地 GPT-SoVITS 模型生成语音，服务由插件管理，不依赖 WebUI。',
        ),
        h(
          'div',
          { className: 'wtts-card' },
          h(
            'div',
            { style: { fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 14 } },
            h('span', null, status?.running ? '服务：运行中' : '服务：未启动'),
            h('span', null, `端口 ${status?.port ?? '—'}`),
            h(
              'span',
              null,
              `缓存 ${status?.cacheFiles ?? 0} 个 / ${Math.round((status?.cacheBytes ?? 0) / 1024)} KB`,
            ),
            status?.lastError
              ? h(
                  'span',
                  { style: { color: 'var(--dsw-alias-state-error-primary)' } },
                  status.lastError,
                )
              : null,
          ),
          h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h(
              'button',
              { className: 'wtts-btn primary', onClick: () => post('/start'), disabled: Boolean(busy) },
              '启动服务',
            ),
            h(
              'button',
              { className: 'wtts-btn', onClick: () => post('/stop'), disabled: Boolean(busy) },
              '关闭服务',
            ),
            h(
              'button',
              { className: 'wtts-btn', onClick: () => post('/open-cache'), disabled: Boolean(busy) },
              '打开缓存目录',
            ),
            h(
              'button',
              { className: 'wtts-btn', onClick: () => post('/clear-cache'), disabled: Boolean(busy) },
              '清理缓存',
            ),
          ),
          error
            ? h(
                'div',
                { style: { fontSize: 13, color: 'var(--dsw-alias-state-error-primary)' } },
                error,
              )
            : null,
        ),
        h(
          'div',
          { className: 'wtts-card' },
          h(PathField, {
            label: 'Python 路径',
            value: config.pythonPath,
            onChange: (value) => set('pythonPath', value),
            kind: 'file',
          }),
          h(PathField, {
            label: 'GPT-SoVITS 根目录',
            value: config.gsvRoot,
            onChange: (value) => set('gsvRoot', value),
            kind: 'folder',
          }),
          h(PathField, {
            label: 'SoVITS 模型',
            value: config.sovitsModel,
            onChange: (value) => set('sovitsModel', value),
            kind: 'file',
          }),
          h(PathField, {
            label: 'GPT 模型',
            value: config.gptModel,
            onChange: (value) => set('gptModel', value),
            kind: 'file',
          }),
          h(PathField, {
            label: '参考音频',
            value: config.refAudio,
            onChange: (value) => set('refAudio', value),
            kind: 'file',
          }),
          h(TextField, {
            label: '参考文本',
            value: config.refText,
            onChange: (value) => set('refText', value),
            placeholder: '与参考音频逐字对应的文本',
          }),
          h(SelectField, {
            label: '设备',
            value: config.device,
            options: DEVICES,
            onChange: (value) => set('device', value),
          }),
          h(SelectField, {
            label: '模型版本',
            value: config.version,
            options: VERSIONS,
            onChange: (value) => set('version', value),
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8 } },
          h(
            'button',
            { className: 'wtts-btn primary', onClick: save, disabled: Boolean(busy) },
            busy === 'save' ? '保存中…' : '保存配置',
          ),
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'whale-tts',
              order: 40,
              label: 'GPT-SoVITS 语音',
            },
            TtsSettings,
          ),
        )
      },
    }
  },
})
