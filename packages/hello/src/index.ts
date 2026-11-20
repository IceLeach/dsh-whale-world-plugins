import { loadDefineTool } from 'dsh-whale-core'

export const name = 'dsh-whale-hello'
export const inject = ['tools']

interface ToolContext {
  tools: {
    register(definition: unknown): void
  }
}

export async function apply(ctx: ToolContext): Promise<void> {
  const defineTool = await loadDefineTool()

  ctx.tools.register(
    defineTool({
      name: 'whale_hello',
      description: '打个招呼。用于验证插件链路（构建、安装、注册）是否正常。',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
      },
      async execute() {
        return 'hello from dsh-whale-hello'
      },
      timeoutMs: 10_000,
    }),
  )
}
