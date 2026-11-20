# 架构说明

## 目标

给 Agent 提供「能力」：能用、能学、能失败、能自己修的东西。技术上它们是 DSH 插件；叙事上它们是数据海里漂来的工具。

三条约束：

1. **一个插件一个包**：各自独立版本、独立发布、独立安装。
2. **代码只管能力，不管解释**：能力在业务侧怎么理解，不写进插件。
3. **插件对所有工作区可见**：同一个 Harness、同一个 profile，装一次到处都能用。

## 为什么是 monorepo

- 共享一套 TypeScript 配置、构建脚本、发布流程。
- `core` 里的通用工具只维护一份，各插件按需依赖。
- 但每个包仍然可以单独 `pnpm publish`，不绑定整体版本。

## 包边界

| 包 | 角色 | 是否单独安装 |
|---|---|---|
| `packages/core` | 共享工具与类型（`loadDefineTool` 等） | 否（被插件依赖） |
| `packages/<name>` | 一个能力插件 | 是 |

规则：

- 插件之间**不互相依赖**。要共享，就放进 `core`。
- `core` 不注册任何工具，只提供函数和类型。
- 每个插件只暴露一个主题的工具（一个插件可以有多工具，但必须同一主题）。

## 插件契约

一个可安装的插件包最少需要：

```
packages/<name>/
├── package.json          # name, exports, files, dsh.bundle.patch
├── cordis.patch.yml      # 把插件行插进 profile
├── src/index.ts          # apply(ctx) + ctx.tools.register
├── locale/zh.json        # Plugin Manager 显示用
├── locale/en.json
└── icon.svg
```

构建后 `lib/` 是运行时入口。

### package.json 关键字段

```json
{
  "name": "dsh-whale-<name>",
  "type": "module",
  "main": "./lib/index.js",
  "exports": { ".": { "types": "./lib/index.d.ts", "import": "./lib/index.js" } },
  "files": ["lib", "cordis.patch.yml", "locale/*.json", "icon.svg"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

### 入口形状

```ts
export const name = 'dsh-whale-<name>'
export const inject = ['tools']
export async function apply(ctx) {
  const defineTool = await loadDefineTool()
  ctx.tools.register(defineTool({ ... }))
}
```

## 命名

| 对象 | 规范 | 例子 |
|---|---|---|
| 包名 | `dsh-whale-<name>` | `dsh-whale-draw` |
| 工具名 | `whale_<action>` | `whale_draw` |
| 插件行 id | 与包名一致 | `dsh-whale-hello` |
| 源码目录 | `src/index.ts` | — |
| 产物目录 | `lib/` | — |

## 依赖策略

- `@deepseek-ai/dsh-tools` 用 **peerDependencies**（宿主提供，可选）。
- `dsh-whale-core` 用 **workspace 协议**，发布时由 pnpm 替换成版本号。
- 第三方库尽量少；每个插件能独立跑。

## 版本与发布

- 每个包独立 `version`，从 `0.0.1` 起。
- `core` 先于依赖它的插件发布。
- 未来可加 changesets 管理多包发版；现阶段手工即可。

## 与 DSH profile 的关系

- 插件装进 profile 后，对 profile 下所有会话生效。
- 本地开发用 `plugin_manager` 的 `install_bundle` 链接目录；发布后从 npm 安装。
- **不要**手写 profile 的 `package.json` 或 `cordis.patch.yml`——交给 `install_bundle`。

## 能力清单（候选）

按实际需求来，不预先做没人要的。

| 包 | 能力 | 状态 |
|---|---|---|
| `dsh-whale-hello` | 示例：验证链路 | 框架 |
| `dsh-whale-web` | 联网搜索 / 抓取 | 候选 |
| `dsh-whale-draw` | 图像生成（接 comfy MCP 或 API） | 候选 |
| `dsh-whale-memory` | 记忆读写（如果文件工具不够） | 候选 |

## 设计约束

- **不包装技术现实**：插件报错就是报错，调用方自行处理。
- **不写调用方的专有名词**：插件代码和描述保持通用。
- **能力可失败**：插件不应该假装永远成功；失败返回真实错误。
- **一次给齐**：能力装好即可用，不设「熟练度」开关。
