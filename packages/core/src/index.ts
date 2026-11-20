/**
 * 插件共享工具。
 * 插件之间不互相依赖；要共享的东西放这里。
 */

export const PLUGIN_PREFIX = 'dsh-whale-'

export type WhaleToolDefinition = Record<string, unknown>
export type DefineTool = (definition: WhaleToolDefinition) => WhaleToolDefinition

/**
 * 尝试用宿主的 defineTool 包装工具；宿主没暴露 @deepseek-ai/dsh-tools 时退回普通对象。
 * 与 bili-explore 插件的做法一致，避免版本差异导致插件起不来。
 */
export async function loadDefineTool(): Promise<DefineTool> {
  try {
    const mod = (await import('@deepseek-ai/dsh-tools')) as { defineTool?: unknown }
    if (typeof mod.defineTool === 'function') {
      return mod.defineTool as DefineTool
    }
  } catch {
    // 宿主没暴露这个包时退回普通对象
  }
  return (definition) => definition
}

/** 从插件配置里取字符串，没有就用默认值。 */
export function readString(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = config?.[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** 从插件配置里取布尔，没有就用默认值。 */
export function readBoolean(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = config?.[key]
  return typeof value === 'boolean' ? value : fallback
}
