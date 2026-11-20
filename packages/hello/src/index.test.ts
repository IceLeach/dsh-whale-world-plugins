import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apply, inject, name } from './index.ts'

/** 最小的假 ctx：只记录 register 了什么。 */
function createContext() {
  const tools = new Map<string, any>()
  return {
    tools,
    ctx: {
      tools: {
        register(definition: any) {
          tools.set(definition.name, definition)
        },
      },
    },
  }
}

describe('hello 插件', () => {
  it('导出 name 与 inject', () => {
    assert.equal(name, 'dsh-whale-hello')
    assert.deepEqual(inject, ['tools'])
  })

  it('apply 注册 whale_hello', async () => {
    const { tools, ctx } = createContext()
    await apply(ctx as any)
    assert.equal(tools.has('whale_hello'), true)
  })

  it('whale_hello 返回问候', async () => {
    const { tools, ctx } = createContext()
    await apply(ctx as any)
    const tool = tools.get('whale_hello')
    const result = await tool.execute({})
    assert.match(result, /hello/)
  })

  it('工具带描述和超时', async () => {
    const { tools, ctx } = createContext()
    await apply(ctx as any)
    const tool = tools.get('whale_hello')
    assert.ok(tool.description)
    assert.ok(tool.timeoutMs > 0)
  })

  it('工具参数声明为空对象', async () => {
    const { tools, ctx } = createContext()
    await apply(ctx as any)
    assert.deepEqual(tools.get('whale_hello').parameters, {})
  })
})
