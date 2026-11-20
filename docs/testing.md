# 自动化测试

## 为什么用 node:test

- **零依赖**：Node 自带，不引入 vitest / vite。
- **沙箱友好**：本机 DSH 沙箱禁止子进程管道，`node --test` 默认会 spawn 隔离进程（报 `EPERM`），加 `--test-isolation=none` 即可单进程运行。
- **Node 24 能直接跑 `.ts`**：不需要额外转译。

## 怎么跑

```bash
pnpm test
```

`pretest` 会先 `pnpm build`（`hello` 依赖 `core` 的 `lib/`），然后 `node --test --test-isolation=none` 自动发现 `**/*.test.ts`。

单独跑某个包：

```bash
node --test --test-isolation=none packages/core/src/index.test.ts
```

## 测试分层

| 层 | 测什么 | 例子 |
|---|---|---|
| 单元 | 纯函数 | `readString` / `readBoolean` |
| 契约 | 插件导出形状 | `name` / `inject` / `apply` 存在 |
| 行为 | 工具注册与执行 | mock ctx → `apply` → `whale_hello.execute()` |

## 怎么写

测试文件放 `packages/<name>/src/*.test.ts`，用 `node:test` + `node:assert/strict`：

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('xxx', () => {
  it('...', () => {
    assert.equal(...)
  })
})
```

## mock ctx

插件只依赖 `ctx.tools.register`，最小 mock：

```ts
function createContext() {
  const tools = new Map<string, any>()
  return {
    tools,
    ctx: { tools: { register: (d: any) => tools.set(d.name, d) } },
  }
}
```

## 不做的事

- 不测 DSH 本身。
- 端到端（真装进 profile）只做手工 smoke，不进 CI。
- 外部网络调用用 mock 或注入，测试不联网。

## CI

`.github/workflows/ci.yml`：install → build → typecheck → test。
