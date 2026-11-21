# dsh-whale-music 使用手册（给 AI）

> 人类读者看 [README.md](README.md)。

## 你面对的是什么

`whale_compose` 把 MusicXML 渲染成 wav。插件只负责调用 MuseScore，不缓存、不复制、不保存其他文件。

## 什么时候调用

- 你写好了一段 MusicXML 乐谱，想听成品。
- 你需要把乐谱导出成 wav 交给用户或其他工具。

不要用它做：

- 生成 MusicXML（那是你自己的创作）。
- 剪辑、混音、加效果（插件只做渲染）。

## 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `musicxml` | 二选一 | MusicXML 全文 |
| `musicxml_path` | 二选一 | MusicXML 文件路径（长曲子推荐） |
| `out_path` | 是 | 输出 wav 的完整路径（含文件名） |
| `unroll_repeats` | 否 | 展开反复记号 |
| `force` | 否 | 忽略警告强制导出 |
| `timeout_ms` | 否 | 渲染超时，默认 300000 |

## 输出

```json
{ "ok": true, "file": "…/out.wav", "bytes": 1234567 }
```

- `file` 是你指定的路径。
- 插件不会在别处产生副本。

## 写 MusicXML 时的建议

- 用 `score-partwise`，钢琴谱给一个 `score-part`，左右手用两个 `<staff>` 或两个 `<part>`。
- 每个 `<measure>` 的音符时值总和要等于拍号；`<divisions>` 设成能整除所有时值的数（常用 4 或 8）。
- 速度默认 120 BPM；要改速度先在短谱上验证，MuseScore 对 `<sound tempo>` 的解析可能和预期不一致（见下）。
- 写完后先渲染一次，看 MuseScore 是否报错。

### 最小钢琴谱骨架

`<attributes>` 里依次给 `divisions`、`key`、`time`、`staves`、两个 `clef`。右手先写满一个小节，再用 `<backup>` 回到小节开头写左手：

```xml
<measure number="1">
  <attributes>
    <divisions>2</divisions>
    <key><fifths>2</fifths></key>
    <time><beats>4</beats><beat-type>4</beat-type></time>
    <staves>2</staves>
    <clef number="1"><sign>G</sign><line>2</line></clef>
    <clef number="2"><sign>F</sign><line>4</line></clef>
  </attributes>
  <!-- 右手：4 个四分音符 -->
  <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><staff>1</staff></note>
  <note><pitch><step>F#</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><staff>1</staff></note>
  <note><pitch><step>A</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><staff>1</staff></note>
  <note><pitch><step>F#</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><staff>1</staff></note>
  <!-- 回到小节开头 -->
  <backup><duration>8</duration></backup>
  <!-- 左手：两个二分音符 -->
  <note><pitch><step>D</step><octave>3</octave></pitch><duration>4</duration><type>half</type><staff>2</staff></note>
  <note><pitch><step>A</step><octave>3</octave></pitch><duration>4</duration><type>half</type><staff>2</staff></note>
</measure>
```

完整可用的 4 小节示例见 [examples/simple.musicxml](examples/simple.musicxml)。

### 两个常见错误

1. **时长翻倍**：两只手写在同一个声部却没有 `<backup>`，MuseScore 会把它们串起来，每小节变成两倍长。左手前必须 `<backup><duration>本小节右手总时值</duration></backup>`。
2. **速度对不上**：显式写 `<sound tempo="120"/>` 时，MuseScore 可能把它解析成一半（实测 123 秒 vs 60 秒）。不确定就先不写，用默认 120 BPM；需要控制速度时再单独验证。

## 出错时

| 错误 | 意思 | 怎么办 |
|---|---|---|
| `MuseScore 路径未配置` | 设置页没填 | 告诉用户去设置页填 |
| `找不到 MuseScore` | 路径错 | 让用户重新选路径 |
| `MuseScore 导出失败：...` | 乐谱或环境问题 | 把 stderr 原文给用户，先检查 MusicXML |

## 不要做

- 不要假设 `out_path` 的目录一定存在——插件会创建，但路径本身要合法。
- 不要期望插件清理输出文件——它只写你指定的那一个。
