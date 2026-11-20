import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-whale-tts'
export const inject = ['tools']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(HERE, 'cache')
const SERVER_SCRIPT = path.join(HERE, 'python', 'tts_server.py')

const DEFAULTS = {
  pythonPath: '',
  gsvRoot: '',
  sovitsModel: '',
  gptModel: '',
  refAudio: '',
  refText: '',
  device: 'cuda',
  version: 'v4',
  servicePort: 9880,
  controlPort: 9881,
  autoPlay: false,
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apply(ctx, rawConfig) {
  const cfg = { ...DEFAULTS, ...(rawConfig ?? {}) }
  let child = null
  let lastError = ''

  const serviceRunning = () => child !== null && child.exitCode === null

  function resolveCacheDir() {
    mkdirSync(CACHE_DIR, { recursive: true })
    return CACHE_DIR
  }

  async function waitHealth(timeoutMs = 60_000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${cfg.servicePort}/health`)
        if (res.ok) return true
      } catch {
        // 还没起来
      }
      await sleep(500)
    }
    throw new Error('TTS 服务启动超时')
  }

  async function startService() {
    if (serviceRunning()) return { ok: true, already: true }
    if (!cfg.pythonPath || !cfg.gsvRoot) {
      throw new Error('pythonPath / gsvRoot 未配置')
    }
    if (!existsSync(SERVER_SCRIPT)) {
      throw new Error(`找不到推理脚本：${SERVER_SCRIPT}`)
    }
    lastError = ''
    child = spawn(
      cfg.pythonPath,
      [SERVER_SCRIPT, '--gsv-root', cfg.gsvRoot, '--port', String(cfg.servicePort)],
      { cwd: cfg.gsvRoot, stdio: 'ignore', windowsHide: true },
    )
    child.on('exit', (code) => {
      child = null
      if (code !== 0) lastError = `服务退出，code=${code}`
    })
    await waitHealth()
    return { ok: true }
  }

  async function stopService() {
    if (!serviceRunning()) {
      child = null
      return { ok: true, already: true }
    }
    const current = child
    try {
      current.kill()
    } catch {
      // ignore
    }
    for (let i = 0; i < 20 && serviceRunning(); i += 1) await sleep(200)
    child = null
    return { ok: true }
  }

  async function requestTts(text, speed) {
    const body = JSON.stringify({
      text,
      text_lang: 'zh',
      sovits: cfg.sovitsModel,
      gpt: cfg.gptModel,
      ref_audio: cfg.refAudio,
      ref_text: cfg.refText,
      device: cfg.device,
      version: cfg.version,
      speed,
    })
    const res = await fetch(`http://127.0.0.1:${cfg.servicePort}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`TTS 失败（${res.status}）：${detail.slice(0, 500)}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  function playWav(file) {
    if (process.platform === 'win32') {
      const safe = String(file).replace(/'/g, "''")
      spawn(
        'powershell',
        ['-NoProfile', '-Command', `(New-Object Media.SoundPlayer '${safe}').PlaySync()`],
        { stdio: 'ignore', windowsHide: true },
      )
      return true
    }
    return false
  }

  function pickDialog(kind) {
    const type = kind === 'folder' ? 'FolderBrowserDialog' : 'OpenFileDialog'
    const filter =
      kind === 'folder'
        ? ''
        : "$d.Filter = '模型与音频|*.pth;*.ckpt;*.wav;*.mp3;*.json|所有文件|*.*';"
    const value = kind === 'folder' ? '$d.SelectedPath' : '$d.FileName'
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      `$d = New-Object System.Windows.Forms.${type}`,
      filter,
      `if ($d.ShowDialog() -eq 'OK') { Write-Output (${value}) }`,
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

  function cacheStats() {
    const dir = resolveCacheDir()
    const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.wav'))
    let bytes = 0
    for (const f of files) {
      try {
        bytes += statSync(path.join(dir, f)).size
      } catch {
        // ignore
      }
    }
    return { dir, files: files.length, bytes }
  }

  ctx.tools.register({
    name: 'whale_speak',
    description:
      '用本地 GPT-SoVITS 模型把文本说成语音。play=true 直接播放；keep_dir 指定保存目录（不播放时必填）。' +
      '只播放不保留：play=true 不传 keep_dir；只保留不播放：play=false 传 keep_dir；' +
      '既播放又保留：play=true 传 keep_dir。返回的 file 是可用音频路径，cache_file 仅在播放或未保留时出现。',
    parameters: {
      text: { type: 'string', description: '要说的文本' },
      play: { type: 'boolean', description: '是否直接播放' },
      keep_dir: { type: 'string', description: '保存目录（不播放时必填；播放时可选）' },
      speed: { type: 'number', description: '语速，默认 1.0' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [
        { type: 'text', text: value?.file ? `已生成音频：${value.file}` : JSON.stringify(value) },
      ],
    },
    async execute(args) {
      const text = String(args?.text ?? '').trim()
      if (!text) throw new Error('text 不能为空')
      const play = args?.play === true
      const keepDir = typeof args?.keep_dir === 'string' ? args.keep_dir : ''
      const speed = Number(args?.speed) || 1.0

      if (!play && !keepDir) throw new Error('不播放时必须提供 keep_dir')

      await startService()
      const wav = await requestTts(text, speed)

      const dir = resolveCacheDir()
      const fileName = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`
      const cacheFile = path.join(dir, fileName)
      writeFileSync(cacheFile, wav)

      let keptFile
      if (keepDir) {
        mkdirSync(keepDir, { recursive: true })
        keptFile = path.join(keepDir, fileName)
        copyFileSync(cacheFile, keptFile)
      }

      const played = play ? playWav(cacheFile) : false

      const result = {
        ok: true,
        file: keptFile ?? cacheFile,
        played,
        kept: Boolean(keptFile),
        bytes: wav.length,
      }
      if (play || !keepDir) result.cache_file = cacheFile
      return result
    },
    timeoutMs: 180_000,
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
        const stats = cacheStats()
        return send(200, {
          running: serviceRunning(),
          port: cfg.servicePort,
          controlPort: cfg.controlPort,
          lastError,
          cacheDir: stats.dir,
          cacheFiles: stats.files,
          cacheBytes: stats.bytes,
        })
      }
      if (req.method === 'GET' && url.pathname === '/config') {
        return send(200, cfg)
      }
      if (req.method === 'POST' && url.pathname === '/config') {
        const body = await new Promise((resolve) => {
          let raw = ''
          req.on('data', (chunk) => { raw += chunk })
          req.on('end', () => resolve(raw))
        })
        const patch = JSON.parse(body || '{}')
        const saved = await saveConfig(patch)
        return send(200, saved)
      }
      if (req.method === 'POST' && url.pathname === '/start') {
        return send(200, await startService())
      }
      if (req.method === 'POST' && url.pathname === '/stop') {
        return send(200, await stopService())
      }
      if (req.method === 'POST' && url.pathname === '/clear-cache') {
        const dir = resolveCacheDir()
        for (const f of readdirSync(dir)) {
          if (f.toLowerCase().endsWith('.wav')) rmSync(path.join(dir, f), { force: true })
        }
        return send(200, cacheStats())
      }
      if (req.method === 'POST' && url.pathname === '/open-cache') {
        const dir = resolveCacheDir()
        if (process.platform === 'win32') {
          spawn('cmd', ['/c', 'start', '', dir], { stdio: 'ignore', windowsHide: true })
        }
        return send(200, { ok: true, dir })
      }
      if (req.method === 'POST' && url.pathname === '/pick-file') {
        return send(200, { path: await pickDialog('file') })
      }
      if (req.method === 'POST' && url.pathname === '/pick-folder') {
        return send(200, { path: await pickDialog('folder') })
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
    if (serviceRunning()) {
      try {
        child.kill()
      } catch {
        // ignore
      }
    }
  })

  if (cfg.autoPlay) {
    // 仅记录配置；自动播放由工具参数控制
  }
}
