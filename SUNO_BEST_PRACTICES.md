# Suno AI 使用最佳实践 — Awen Music 内部规范

本文档记录 Awen Music 在实际制作过程中总结的 Suno 使用规范，包含三个核心问题的根因分析和解决方案，以及具体的操作步骤。**所有人按照这套最佳实践操作。**

---

## 一、按当前 Suno Create 页面逐项填写

Awen 的每张生成卡片都有一个 **Suno 配方**面板，顺序与当前页面一致：

| Suno 控件 | Awen 提供什么 |
|---|---|
| **Lyrics 模式** | `结构实验 · Prompt` 或 `纯音乐 · Instrumental` 二选一 |
| **Style of Music** | 声音世界：流派、调性、速度、乐器、质感 |
| **Exclude Styles** | 排除人声、过重打击乐、突然动态与过亮制作 |
| **Weirdness** | 全局默认 50% |
| **Style Influence** | 全局默认 70% |
| **Duration** | 全局默认 5:00 |
| **Song Title** | 独立复制的 Suno 歌名 |
| **Save to Workspace** | 单曲 `Awen · Singles`；专辑 `Awen · 专辑名` |

### Lyrics 两条路线不能同时执行

- **结构实验（默认）**：在 Suno Lyrics 选择 `Prompt`，粘贴 Awen 的结构描述。它是实验路线，可能产生歌词或人声。
- **纯音乐稳定路线**：选择 `Instrumental`，不要粘贴任何 Lyrics 内容；Style、Exclude 和其他参数保持不变。

> 如果结构实验出现歌词或人声，直接切换 Instrumental，不要再同时使用结构 Prompt。

---

## 二、三个最常见的质量问题——根因和解法

### 问题 1：音乐听起来不协调

**根因：** 没有指定调性/调式，Suno 自由发挥，音符可能乱飘，不同段落之间缺乏和声一致性。

**解法：在风格框里加一个调性标签。**

| 情绪 | 推荐调性 | 感觉 |
|---|---|---|
| Calm（平静） | D dorian | 温和、稳定、不甜腻 |
| Melancholy（忧郁） | A minor | 经典小调，深沉 |
| Focused（专注） | C major | 干净、清晰 |
| Dreamy（梦幻） | F lydian | 升四度，有飘浮感 |
| Nostalgic（怀旧） | B♭ major | 温暖、略带忧愁 |
| Hopeful（希望） | G major | 开阔、积极 |
| Lonely（孤独） | E minor | 内敛、孤寂 |
| Cozy（温暖） | F major | 圆润、包裹感 |
| Mysterious（神秘） | C♯ minor | 阴暗、奇特 |

**示例风格框：**
```
ambient, instrumental, D dorian, 60 bpm slow unhurried groove, felt piano lead,
soft brushed drums, warm tape saturation, vinyl crackle, no polished sound
```

---

### 问题 2：专辑里很多首歌听起来太寡淡、没有记忆点

**根因：** 每首歌结构和密度都一样，没有各自的"那一下"——第 1 首和第 8 首除了场景不同，音乐体验完全一样。

**解法：给每首歌一个 Track Role + Signature Element（记忆点）。**

Awen Matrix 工具已经自动按照专辑里的位置分配了 10 个角色，每个角色有专属记忆点：

| 角色 | 记忆点 | 用途 |
|---|---|---|
| Awakening | 开头一个持续的高音进入主题 | 第 1 首：专辑开场 |
| Settling In | 暖色低音的进入扎稳节奏 | 第 2 首 |
| Focus | 一个反复出现的二音 ostinato | 第 3–4 首 |
| Flow State | 一个几乎不变的催眠循环，极简 | 第 5 首：专辑最深处 |
| Reflection | 中段一段自由的 rubato 独奏 | 第 6 首 |
| Transition | 短暂转到关系大调再回来 | 第 7 首 |
| Deep Work | 安静的对位旋律叠在主旋律下 | 第 8 首 |
| Persistence | 慢慢积累的节奏脉冲，从不中断 | 第 9 首 |
| Release | 音域打开，转向更明亮的和声 | 最后第 2 首 |
| Closure | 第 1 首的旋律回来，终于解决 | 最后 1 首：专辑收束 |

使用**结构实验路线**时，把 Signature Element 写进 Awen 生成的结构 Prompt 对应主段落里；使用 Instrumental 路线时，不向 Lyrics 粘贴结构内容，只把记忆点保留在 Style 描述中。

---

### 问题 3：一首歌从头到尾太平淡

**常见原因：** Style 只描述音色，没有给出低干扰的段落变化；生成结果容易长时间维持同一种质感。

> <cite>Without structure tags, Suno will just continue the vibe. No payoff.</cite>

**实验解法：** 选择 Lyrics 的 `Prompt` 模式，使用自然语言结构 Prompt 给歌曲一个克制的完整弧线。此方法可能产生歌词或人声；若发生，切换到 Instrumental，并把关键变化要求保留在 Style 中。

#### 标准 5 段结构（推荐）

```
[Intro: solo felt piano, sparse, establish the theme in D dorian, vinyl crackle]
[Main: add soft brushed drums and warm bass, settle the groove, warm bass entrance grounds the groove]
[Lift: slightly fuller arrangement, gentle dynamic rise, stay relaxed]
[Breakdown: strip back to felt piano and vinyl crackle, intimate and quiet]
[Outro: return to the opening phrase, fade on a long reverb tail]
```

**各段的作用：**

| 段落 | 功能 | 密度 |
|---|---|---|
| `[Intro]` | 建立调性和主题，只用主奏乐器 | 最稀疏 |
| `[Main]` | 加入节奏层，进入稳定 groove | 中等 |
| `[Lift]` | 轻微推进，细微的上升感 | 稍饱满 |
| `[Breakdown]` | 收回来，只留主奏+质感，情感最深处 | 稀疏 |
| `[Outro]` | 回到开场主题，reverb tail 淡出 | 最稀疏 |

#### Metatag 语法规则

- 每段一行，格式：`[段落名: 描述文字]`
- 描述用逗号分隔的短语，不要写完整句子
- 可以叠加：`[Breakdown | intimate | no drums]`
- 不要把所有指令堆进一个 tag，每段 1–2 个关键特征就够了

---

## 三、风格框（Style box）写作规范

### ✅ 正确的写法顺序

```
[流派], [调性], [BPM + groove 感], [主奏乐器] lead, [1-2个辅助乐器], [质感标签], instrumental
```

**示例：**
```
lo-fi hip hop, A minor, 72 bpm relaxed head-nodding groove, felt piano lead,
soft brushed drums, warm bass, vinyl crackle, warm tape saturation, instrumental
```

### 规则

1. **Groove + Texture 优先** — 先描述节奏感和质感，不是情绪和复杂度
2. **必须钉调性** — `A minor` / `D dorian` / `F lydian` 等，这是和声一致性的关键
3. **1 主奏 + 最多 2 个辅助** — 克制是 lo-fi 真实感的来源，不要堆乐器
4. **必须有质感标签** — 至少一个：`vinyl crackle` / `warm tape saturation` / `soft room reverb` / `low-pass filter`
5. **字数控制在 150 字符以内** — 太长 Suno 会忽略后面的部分
6. **禁止使用的词** — `crisp` / `polished` / `clean` / `hi-fi` — 这些是 lo-fi 的反义词

### Groove 描述参考

| BPM | Groove 描述 |
|---|---|
| 55–60 | `slow unhurried groove` |
| 62–70 | `relaxed head-nodding groove` |
| 72–80 | `gentle mid-tempo groove` |
| 80–90 | `steady lo-fi groove` |

---

## 四、Awen Matrix 工具的标准操作流程

### 单曲制作

1. 在矩阵上选好 7 个声音维度 + 4 个视觉维度
2. 点「生成歌曲」
3. 在生成卡片顶部打开「Suno 配方」
4. 选择一条 Lyrics 路线：默认先测结构 Prompt；若出现人声则切换 Instrumental
5. 依次复制 Style、Exclude Styles 和 Song Title
6. 设置 Weirdness 50%、Style Influence 70%、Duration 5:00
7. 单曲保存到 `Awen · Singles`，专辑曲目保存到同一个 `Awen · 专辑名` Workspace
8. 点 Create，生成 2 个版本，听一遍

### 如果不满意，改哪里

| 问题 | 改什么 |
|---|---|
| 音调乱、不协调 | 风格框里加/换调性（`A minor` → `D dorian`） |
| 太平淡、没起伏 | 结构实验路线调整段落描述；Instrumental 路线在 Style 中加入 `slow evolving arrangement, gentle sparse variation` |
| 音色太亮/太干净 | 风格框加 `vinyl crackle, warm tape saturation` |
| 鼓太重 | 风格框改成 `soft brushed drums` 或 `no drums` |
| 太吵，太多乐器 | 删掉风格框里 2 个以上的乐器名 |
| 太像背景音乐、没记忆点 | 结构实验路线在主段落加入 signature element；Instrumental 路线把它写入 Style（见第二节角色表） |

### 专辑制作

1. 在视觉身份层配好 4 个维度（角色/光源/色板/母题）
2. 点「保存 Universe」起个名字，下次直接调用
3. 切到 Album 模式，选行进轴（Day Arc / Late-Night Descent / Storm Passing 等）+ 曲目数
4. 点「生成专辑」
5. 点每首旁边的「Copy for Suno」（已含该首的专属 Structure + Key + Role）
6. 按顺序一首一首贴进 Suno，依次生成、试听
7. 记得：01 → N 就是设计好的播放顺序，不要打乱

---

## 五、已知规律（持续更新）

- **Lo-fi 小调比大调好出片** — A minor / D dorian 出来的质感最稳定
- **BPM 60–72 是最甜的区间** — 太慢(<55)容易单调，太快(>80)lo-fi 感减弱
- **Felt Piano 是最稳定的主奏乐器** — 和任何质感标签都兼容
- **结构里 Breakdown 最重要** — 这一段最容易出"那种感觉"，描述要最具体
- **每次改一个变量** — 不要同时改调性+BPM+乐器，无法判断哪个变量有效
- **同一个 prompt 生成 2 次** — Suno 每次结果不同，同一个好 prompt 多跑几次比改 prompt 更高效

---

## 六、文件命名规范

所有从 Suno 下载的 wav 文件统一按以下格式命名：

**单曲：**
```
AWN-042_Library_Night_Calm_FeltPiano_60bpm.wav
```

**专辑曲目：**
```
ALB-007_T01_Awakening_NightLibrary.wav
ALB-007_T02_SettlingIn_NightLibrary.wav
```

Matrix 工具的每张卡片底部都有「文件名」一键复制按钮，直接用。

---

*最后更新：2026-06-20 | 版本：V2.2*
