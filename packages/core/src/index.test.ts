import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PLUGIN_PREFIX, readBoolean, readString } from './index.ts'

describe('readString', () => {
  it('没有配置时返回默认值', () => {
    assert.equal(readString(undefined, 'x', '默认'), '默认')
  })

  it('有字符串时返回它', () => {
    assert.equal(readString({ x: '值' }, 'x', '默认'), '值')
  })

  it('空字符串仍返回默认值', () => {
    assert.equal(readString({ x: '' }, 'x', '默认'), '默认')
  })

  it('非字符串返回默认值', () => {
    assert.equal(readString({ x: 42 }, 'x', '默认'), '默认')
  })
})

describe('readBoolean', () => {
  it('没有配置时返回默认值', () => {
    assert.equal(readBoolean(undefined, 'x', false), false)
  })

  it('有布尔时返回它', () => {
    assert.equal(readBoolean({ x: true }, 'x', false), true)
  })

  it('字符串 true 不算布尔', () => {
    assert.equal(readBoolean({ x: 'true' }, 'x', false), false)
  })
})

describe('PLUGIN_PREFIX', () => {
  it('是 dsh-whale-', () => {
    assert.equal(PLUGIN_PREFIX, 'dsh-whale-')
  })
})
