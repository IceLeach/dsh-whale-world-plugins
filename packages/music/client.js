window.__ModuleLoader__.load({
  id: 'dsh-whale-music',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    const BASE = 'http://127.0.0.1:9882'

    const CSS = `
      .wmus-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; }
      .wmus-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
      .wmus-btn:disabled { opacity: .5; cursor: default; }
      .wmus-btn.primary { background: var(--dsw-alias-brand-primary); color: #fff; border-color: transparent; }
      .wmus-input { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; }
      .wmus-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
      .wmus-row { display: flex; gap: 8px; align-items: center; }
      .wmus-label { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; }
      .wmus-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 14px 16px; background: var(--dsw-alias-bg-layer-1); display: flex; flex-direction: column; gap: 12px; }
    `

    function MusicSettings() {
      const [config, setConfig] = useState(null)
      const [status, setStatus] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [testResult, setTestResult] = useState('')

      const load = useCallback(async () => {
        try {
          const [nextConfig, nextStatus] = await Promise.all([
            fetch(`${BASE}/config`).then((res) => res.json()),
            fetch(`${BASE}/status`).then((res) => res.json()),
          ])
          setConfig(nextConfig)
          setStatus(nextStatus)
          setError('')
        } catch (err) {
          setError(String(err))
        }
      }, [])

      useEffect(() => {
        load()
      }, [load])

      if (!config) {
        return h('div', { style: { fontSize: 13 } }, error || '加载中…')
      }

      const set = (key, value) => setConfig({ ...config, [key]: value })

      const pick = async () => {
        setBusy('pick')
        try {
          const res = await fetch(`${BASE}/pick-file`, { method: 'POST' })
          const data = await res.json()
          if (data.path) set('musescorePath', data.path)
        } catch (err) {
          setError(String(err))
        } finally {
          setBusy('')
        }
      }

      const test = async () => {
        setBusy('test')
        setTestResult('')
        try {
          const res = await fetch(`${BASE}/test`, { method: 'POST' })
          const data = await res.json()
          setTestResult(data.ok ? `可用：${data.version}` : `不可用：${data.error}`)
          await load()
        } catch (err) {
          setTestResult(`不可用：${String(err)}`)
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
          await load()
        } catch (err) {
          setError(String(err))
        } finally {
          setBusy('')
        }
      }

      return h(
        'div',
        { style: { maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 } },
        h('style', null, CSS),
        h('h2', { style: { margin: 0, fontSize: 18 } }, '乐谱渲染'),
        h(
          'div',
          { style: { fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' } },
          '把 MusicXML 渲染成 wav。插件只负责调用 MuseScore，不缓存、不复制音频。',
        ),
        h(
          'div',
          { className: 'wmus-card' },
          h(
            'div',
            { style: { fontSize: 13, display: 'flex', gap: 14, flexWrap: 'wrap' } },
            h('span', null, status?.exists ? 'MuseScore：已找到' : 'MuseScore：未配置或路径无效'),
          ),
          h(
            'label',
            { style: { display: 'block' } },
            h('div', { className: 'wmus-label' }, 'MuseScore 可执行文件'),
            h(
              'div',
              { className: 'wmus-row' },
              h('input', {
                className: 'wmus-input',
                value: config.musescorePath ?? '',
                placeholder: 'MuseScore4.exe 的完整路径',
                onChange: (event) => set('musescorePath', event.target.value),
              }),
              h('button', { className: 'wmus-btn', onClick: pick, disabled: Boolean(busy) }, '...'),
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h(
              'button',
              { className: 'wmus-btn', onClick: test, disabled: Boolean(busy) },
              busy === 'test' ? '测试中…' : '测试 MuseScore',
            ),
            h(
              'button',
              { className: 'wmus-btn primary', onClick: save, disabled: Boolean(busy) },
              busy === 'save' ? '保存中…' : '保存配置',
            ),
          ),
          testResult
            ? h('div', { style: { fontSize: 13 } }, testResult)
            : null,
          error
            ? h('div', { style: { fontSize: 13, color: 'var(--dsw-alias-state-error-primary)' } }, error)
            : null,
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
              id: 'whale-music',
              order: 45,
              label: '乐谱渲染',
            },
            MusicSettings,
          ),
        )
      },
    }
  },
})
