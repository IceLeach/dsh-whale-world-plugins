# dsh-whale-tts

用本地 GPT-SoVITS 模型把文字说成语音的 DSH 插件。生成音频后可以选择直接播放、保存到指定目录，或者两样都做。

插件自己管理一个 Python 推理服务，不依赖 GPT-SoVITS 的 WebUI；模型、参考音频、参考文本、Python 环境都可以在设置页里改。

## 工作方式

```
whale_speak 工具
   ↓
插件（Host）── 拉起 / 停止 ──▶ Python 推理服务（FastAPI，默认 127.0.0.1:9880）
   ↓                                   ↓
缓存 / 播放 / 复制                   GPT-SoVITS TTS 类
```

设置页通过控制端口（默认 9881）和插件通信。

## 前置条件

| 依赖 | 说明 |
|---|---|
| GPT-SoVITS 代码与预训练模型 | 配置里的「GPT-SoVITS 根目录」 |
| Python + torch | 配置里的「Python 路径」，需能跑 GPT-SoVITS |
| fastapi / uvicorn / numpy | 推理服务用；GPT-SoVITS 的 runtime 一般已带 |
| 训练好的 SoVITS / GPT 模型 | `.pth` / `.ckpt` |
| 参考音频 + 逐字对应的参考文本 | 零样本克隆用 |

插件不绑定整合包的固定目录，只要上面这些路径能指到即可。

## 安装

在插件目录执行，或在 DSH 的插件管理里用本地目录安装：

```bash
dsh plugin --profile <desktop|web> add "file:<插件目录的绝对路径>"
```

安装后重启一次 DSH。

## 首次配置

插件不自带默认路径。装好后先打开 设置 → 「GPT-SoVITS 语音」，填完路径和模型，再点「启动服务」。

给 AI 用的操作手册见 [AGENTS.md](AGENTS.md)。

## 更新与卸载

```bash
# 卸载
dsh plugin --profile desktop remove dsh-whale-tts
```

更新时先卸载再按上面的方式安装，或在插件管理里重装。

## 配置

设置 → 「GPT-SoVITS 语音」：

| 配置 | 说明 |
|---|---|
| Python 路径 | 带 torch 的 `python.exe` |
| GPT-SoVITS 根目录 | 包含 `GPT_SoVITS/` 的目录 |
| SoVITS 模型 | `.pth` 路径 |
| GPT 模型 | `.ckpt` 路径 |
| 参考音频 | 3–10 秒干净人声 |
| 参考文本 | 与参考音频逐字对应 |
| 设备 | `cuda` / `cpu` |
| 模型版本 | `v2` / `v2Pro` / `v2ProPlus` / `v3` / `v4` 等 |

同一页还有：启动服务、关闭服务、打开缓存目录、清理缓存。

## 工具 `whale_speak`

| 参数 | 必填 | 说明 |
|---|---|---|
| `text` | 是 | 要说的文本 |
| `play` | 否 | `true` 时直接播放 |
| `keep_dir` | 否 | 保存目录；不播放时必填 |
| `speed` | 否 | 语速，默认 `1.0` |

### 三种组合

| `play` | `keep_dir` | 行为 | 返回的 `file` |
|---|---|---|---|
| `true` | 不传 | 写缓存并播放，不保留 | 缓存文件 |
| `false` | 传 | 写缓存并复制到 `keep_dir` | 保留路径 |
| `true` | 传 | 写缓存、播放并复制 | 保留路径 |

缓存文件名默认是 `tts-<时间戳>-<随机>.wav`，避免重名。

## 缓存

缓存在插件安装目录的 `cache/` 下。设置页可以打开或清理。

## 排错

| 现象 | 处理 |
|---|---|
| `pythonPath / gsvRoot 未配置` | 去设置页填路径 |
| `TTS 服务启动超时` | 检查 Python 能否 import torch、模型路径是否正确 |
| `TTS 失败（500）：...` | 看返回的错误，常见是模型版本与权重不匹配 |
| `不播放时必须提供 keep_dir` | 补 `keep_dir`，或把 `play` 设为 `true` |
| 播放没声音 | 检查系统默认输出设备 |

## 许可

插件代码以 [MIT](LICENSE) 发布；GPT-SoVITS 的模型与代码遵循其各自许可。
