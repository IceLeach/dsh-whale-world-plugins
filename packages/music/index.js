import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

export const name = 'dsh-whale-music'
export const inject = ['tools']

const execFileAsync = promisify(execFile)

const DEFAULTS = {
  musescorePath: '',
  controlPort: 9882,
}

export async function apply(ctx, rawConfig) {
  const cfg = { ...DEFAULTS, ...(rawConfig ?? {}) }

  async function testMuseScore() {
    if (!cfg.musescorePath) throw new Error('MuseScore 路径未配置')
    if (!existsSync(cfg.musescorePath)) throw new Error(`找不到 MuseScore：${cfg.musescorePath}`)
    const { stdout } = await execFileAsync(cfg.musescorePath, ['--version'], {
      timeout: 30_000,
      windowsHide: true,
    })
    return stdout.trim()
  }

  function pickExecutable() {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$d = New-Object System.Windows.Forms.OpenFileDialog',
      "$d.Filter = '可执行文件|*.exe|所有文件|*.*';",
      "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }",
    ].join('; ')
    return new Promise((resolve) => {
      const proc = spawn('powershell', ['-NoProfile', '-STA', '-Command', script], {
        windowsHide: true,
      })
      let out = ''
      proc.stdout.on('data', (chunk) => {
        out += chunk
      })
      proc.on('close', () => resolve(out.trim()))
      proc.on('error', () => resolve(''))
    })
  }

  async function render(musicxml, outPath, options) {
    const dir = await mkdtemp(path.join(tmpdir(), 'whale-music-'))
    try {
      const xmlPath = path.join(dir, 'score.musicxml')
      await writeFile(xmlPath, musicxml, 'utf8')
      const resolved = path.resolve(outPath)
      await mkdir(path.dirname(resolved), { recursive: true })

      const args = ['-o', resolved]
      if (options.unrollRepeats) args.push('--unroll-repeats')
      if (options.force) args.push('-f')
      args.push(xmlPath)

      try {
        await execFileAsync(cfg.musescorePath, args, {
          timeout: options.timeoutMs ?? 300_000,
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024,
        })
      } catch (err) {
        const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : ''
        throw new Error(`MuseScore 导出失败${stderr ? `：${stderr.slice(0, 500)}` : ''}`)
      }

      const info = await stat(resolved)
      return { file: resolved, bytes: info.size }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  ctx.tools.register({
    name: 'whale_compose',
    description:
      '把 MusicXML 渲染成 wav 音频。目标文件夹和文件名由 out_path 决定；插件不缓存、不复制、不保存其他文件。' +
      'musicxml 传乐谱全文；out_path 传完整输出路径（父目录不存在会自动创建）。',
    parameters: {
      musicxml: { type: 'string', description: 'MusicXML 全文（score-partwise 或 score-timewise）' },
      musicxml_path: { type: 'string', description: 'MusicXML 文件路径；与 musicxml 二选一' },
      out_path: { type: 'string', description: '输出 wav 的完整路径（含文件名）' },
      unroll_repeats: { type: 'boolean', description: '展开反复记号，默认不展开' },
      force: { type: 'boolean', description: '忽略损坏/版本警告，强制导出' },
      timeout_ms: { type: 'number', description: '渲染超时（毫秒），默认 300000' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [
        { type: 'text', text: value?.file ? `已生成：${value.file}` : JSON.stringify(value) },
      ],
    },
    async execute(args) {
      let musicxml = String(args?.musicxml ?? '').trim()
      const musicxmlPath = String(args?.musicxml_path ?? '').trim()
      if (!musicxml && musicxmlPath) {
        musicxml = await readFile(musicxmlPath, 'utf8')
      }
      if (!musicxml) throw new Error('musicxml 或 musicxml_path 至少给一个')
      const outPath = String(args?.out_path ?? '').trim()
      if (!outPath) throw new Error('out_path 不能为空')

      await testMuseScore()
      const result = await render(musicxml, outPath, {
        unrollRepeats: args?.unroll_repeats === true,
        force: args?.force === true,
        timeoutMs: Number(args?.timeout_ms) || undefined,
      })

      return { ok: true, file: result.file, bytes: result.bytes }
    },
    timeoutMs: 360_000,
  })

  async function saveConfig(patch) {
    const entry = ctx.fiber?.entry
    const editor = ctx.get?.('configEditor')
    if (!entry || !editor) throw new Error('当前 profile 不支持保存配置')
    await editor.edit(entry, (current) => ({ ...current, ...patch }))
    Object.assign(cfg, patch)
    return cfg
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    const send = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...cors })
      res.end(JSON.stringify(data))
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      res.end()
      return
    }
    try {
      if (req.method === 'GET' && url.pathname === '/status') {
        return send(200, {
          musescorePath: cfg.musescorePath,
          exists: Boolean(cfg.musescorePath && existsSync(cfg.musescorePath)),
          controlPort: cfg.controlPort,
        })
      }
      if (req.method === 'GET' && url.pathname === '/config') {
        return send(200, cfg)
      }
      if (req.method === 'POST' && url.pathname === '/config') {
        const body = await new Promise((resolve) => {
          let raw = ''
          req.on('data', (chunk) => {
            raw += chunk
          })
          req.on('end', () => resolve(raw))
        })
        const patch = JSON.parse(body || '{}')
        Object.assign(cfg, patch)
        send(200, cfg)
        setImmediate(() => {
          const entry = ctx.fiber?.entry
          const editor = ctx.get?.('configEditor')
          if (entry && editor) {
            editor.edit(entry, (current) => ({ ...current, ...patch })).catch(() => {})
          }
        })
        return
      }
      if (req.method === 'POST' && url.pathname === '/test') {
        try {
          const version = await testMuseScore()
          return send(200, { ok: true, version })
        } catch (err) {
          return send(200, { ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      }
      if (req.method === 'POST' && url.pathname === '/pick-file') {
        return send(200, { path: await pickExecutable() })
      }
      return send(404, { error: 'not found' })
    } catch (err) {
      return send(500, { error: err instanceof Error ? err.message : String(err) })
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(cfg.controlPort, '127.0.0.1', resolve)
  })

  ctx.effect?.(() => () => {
    try {
      server.close()
    } catch {
      // ignore
    }
  })
}
