# DSH 插件集

> monorepo：**一个插件一个包，各自独立发布。**

## 是什么

这里是给 DeepSeek Harness 用的插件集合。每个包把自己注册成 DSH 的工具或界面，装进 profile 后即可使用。

## 结构

```
plugins/
├── packages/
│   ├── core/      共享工具与类型（不单独安装）
│   ├── hello/     TypeScript 示例插件：验证构建与安装链路
│   ├── tts/       GPT-SoVITS 语音插件（纯 JS，无构建）
│   └── music/     MusicXML → wav 乐谱渲染插件（纯 JS）
├── docs/
│   └── architecture.md
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## 快速开始

```bash
pnpm install
pnpm build
pnpm test
```

TypeScript 包的产物在 `packages/*/lib/`；纯 JS 包（如 `tts`）直接以 `index.js` / `client.js` 作为入口，不走构建。

测试用 Node 自带的 `node:test`，不引入额外框架；细节见 [测试说明](docs/testing.md)。

## 新增一个插件

TypeScript 包（需要构建）：

1. 复制 `packages/hello` 为 `packages/<name>`。
2. 把 `package.json` 的 `name` 改成 `dsh-whale-<name>`。
3. 改 `cordis.patch.yml` 的 `id` / `name`。
4. 写 `src/index.ts`（`apply` + `ctx.tools.register`）。
5. `pnpm build`。
6. 用 `plugin_manager` 的 `install_bundle` 安装包目录。

纯 JS 包（无构建，参考 `packages/tts`）：

1. 建 `packages/<name>/`，写 `package.json`（`main` 指向 `index.js`）。
2. 写 `index.js`（导出 `name` / `inject` / `apply`）。
3. 需要设置页时，加 `client.js` 并在 `package.json` 的 `dsh.client` 里声明。
4. 写 `cordis.patch.yml`。
5. 直接安装，不需要 `pnpm build`。

## 发布

每个包独立发版：

```bash
cd packages/<name>
pnpm publish --access public
```

`core` 若被其他包依赖，先发 `core`。

## 命名

| 对象 | 规范 | 例子 |
|---|---|---|
| 包名 | `dsh-whale-<name>` | `dsh-whale-draw` |
| 工具名 | `whale_<action>` | `whale_draw` |
| 插件行 id | 与包名一致 | `dsh-whale-hello` |

## 文档

- [架构说明](docs/architecture.md)
- 各包自己的 `README.md` / `AGENTS.md`
