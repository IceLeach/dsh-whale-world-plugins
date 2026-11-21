# dsh-whale-music

把 MusicXML 渲染成 wav 音频的 DSH 插件，底层调用 MuseScore 4 的命令行。

插件只做一件事：接收 MusicXML 和输出路径，调 MuseScore 导出 wav。不缓存、不复制、不额外保存文件。

## 工作方式

```
whale_compose 工具
   ↓
插件（Host）── 写临时 MusicXML ──▶ MuseScore4.exe -o <out.wav> <score.musicxml>
   ↓
输出 wav（调用方指定的路径）
```

临时 MusicXML 用完即删。

## 前置条件

- MuseScore Studio 4（已安装，能跑 `MuseScore4.exe --version`）
- Windows / macOS / Linux 均可；插件通过配置的路径调用

## 安装

```bash
dsh plugin --profile <desktop|web> add "file:<插件目录的绝对路径>"
```

安装后重启一次 DSH。

## 配置

设置 → 「乐谱渲染」：

| 配置 | 说明 |
|---|---|
| MuseScore 可执行文件 | `MuseScore4.exe` 的完整路径 |

设置页有「...」选择文件、「测试 MuseScore」按钮，以及当前是否找到 MuseScore 的状态。

## 工具 `whale_compose`

| 参数 | 必填 | 说明 |
|---|---|---|
| `musicxml` | 二选一 | MusicXML 全文 |
| `musicxml_path` | 二选一 | MusicXML 文件路径（长曲子推荐走这个） |
| `out_path` | 是 | 输出 wav 的完整路径（含文件名），父目录不存在会自动创建 |
| `unroll_repeats` | 否 | 展开反复记号 |
| `force` | 否 | 忽略损坏/版本警告强制导出 |
| `timeout_ms` | 否 | 渲染超时，默认 300000 |

返回：

```json
{ "ok": true, "file": "…/out.wav", "bytes": 1234567 }
```

## 示例

[examples/simple.musicxml](examples/simple.musicxml) 是一个 4 小节的钢琴片段：右手旋律 + 左手和弦，包含两只手在同一小节里需要的 `<backup>`。

```json
{ "musicxml_path": "…/simple.musicxml", "out_path": "…/out.wav" }
```

## 输出格式

MuseScore 默认导出 44.1kHz 立体声 32-bit float wav。需要 16-bit PCM 时请自行转换——插件不改变 MuseScore 的输出格式。

## 排错

| 现象 | 处理 |
|---|---|
| `MuseScore 路径未配置` | 去设置页填路径 |
| `找不到 MuseScore` | 检查路径是否指向 `MuseScore4.exe` |
| `MuseScore 导出失败：...` | 看 stderr，常见是 MusicXML 格式错误 |
| 导出成功但没声音 | 检查 MusicXML 是否只有空小节 |

## 许可

插件代码以 [MIT](LICENSE) 发布；MuseScore 及其音色遵循其各自许可。
