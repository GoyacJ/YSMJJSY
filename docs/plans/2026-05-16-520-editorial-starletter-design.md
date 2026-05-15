# 520 Editorial Starletter Redesign

## Goal

把当前 520 项目从“卡片式信件页面”改成“信纸到星图的编辑式叙事”。

第一感受仍然是温柔、安静、像一封信。
后半段逐渐进入星空，有仪式感。
智能对话和 MiniMax 能力保留，但视觉上要像这封信的延伸，而不是工具面板。

## Current Problem

当前页面可用，但偏古板。

原因在结构：

- 首屏是居中卡片。
- 信件页是一张完整纸张卡片。
- 正文是传统文章排版。
- 记忆节点是常见左侧时间线。
- `PretextParagraph.client.vue` 目前只是普通段落加右浮符号，没有真正使用 `@chenglou/pretext`。
- 星空页氛围较好，但 `StarChat` 和额度面板偏工具化。

这会让页面像一个温柔的表单，而不是一个定制作品。

## Direction

采用方案 A：信纸到星图的编辑式叙事。

主线：

```text
输入 100522
信封展开
读几段留白充足的信
文字开始绕过日期、月亮、星轨
记忆节点变成星图坐标
信纸边缘变暗
文字碎片变成星点
进入星空
星信像夜间便签一样出现
```

## Visual Principles

- 少卡片，多纸面、折痕、邮戳、星图坐标。
- 少均分布局，多分镜节奏。
- 少装饰爱心，多让文字本身形成画面。
- 前半段暖纸色，后半段夜空色。
- 动效慢，动作少，但转场要有仪式感。
- 功能入口存在，但不抢情绪主线。

## Scene Design

### 1. Unlock Gate

从普通卡片改成未拆开的信封。

保留 `100522` 输入。
视觉元素：

- 信封轮廓
- 淡邮戳 `5.20`
- 细线暗号输入
- 轻微纸纹
- 成功后信封展开进入正文

错误文案仍然克制：

```text
这不是这封信的钥匙。
```

### 2. Letter Scene

从单张纸卡片改成分镜式阅读。

结构：

- 第一段：大留白，像真正开信。
- 第二段：正文绕开一个淡淡的月亮。
- 第三段：正文绕开 `5.20` 日期章。
- 第四段：正文沿星轨逐行收窄。
- 结尾：纸张边缘出现星点，进入星空按钮像一个落款。

### 3. Pretext Layout

`@chenglou/pretext` 的价值是逐行控制文字流。
这里不再只用 CSS float。

需要做 3 种版式：

- `date-orbit`：文字绕过 `5.20` 日期章。
- `moon-wrap`：文字绕过月亮形状。
- `star-trail`：每一行宽度逐渐变化，形成星轨感。

实现上用：

- `prepareWithSegments`
- `layoutNextLineRange`
- `materializeLineRange`

每一行渲染成独立 `<span>`。
每行可设置 `transform`、`margin-left`、`max-width`。
移动端降级为普通段落，保证可读。

### 4. Memory Moments

从时间线改成星图坐标。

每个记忆节点是一个小星点：

```text
某一天 / RA 05:20
第一次发现自己会期待你的消息。
```

视觉上像星图注释，不像任务列表。

### 5. Star Transition

进入星空前加一个轻转场。

纸张上的细小星点上浮。
背景从暖色过渡到深蓝。
最终切到现有 Canvas 星空。

不做复杂 3D 翻页。

### 6. Star Chat

`StarChat` 视觉降工具感。

从聊天面板改成夜空上的便签层：

- 轻薄半透明背景
- 更窄的标题区
- 输入区像写一张星信
- 语音、图片、发送用图标按钮
- 媒体生成入口保持 “听一听 / 画一张 / 做一段 / 写一首”，但做成低调工具列

### 7. Quota Display

额度信息不再是一整块面板。

改成一条状态行：

```text
星能量：语音 12/20 · 图像 8/10 · 音乐 3/5 · 视频暂不可用
```

保留刷新能力。
失败时只显示短提示，不破坏界面。

## Component Impact

主要改动：

- `components/UnlockGate.vue`
- `components/LetterScene.vue`
- `components/PretextParagraph.client.vue`
- `components/StarScene.client.vue`
- `components/StarChat.vue`
- `components/MiniMaxQuotaPanel.vue`
- `assets/css/main.css`
- `content/letter.ts`

测试改动：

- `components/UnlockGate.test.ts`
- `content/letter.test.ts`
- `components/StarChat.test.ts`
- `components/MiniMaxQuotaPanel.test.ts`
- Playwright 主流程截图检查

## References

- Pretext: https://github.com/chenglou/pretext
- Pretext demos: https://chenglou.me/pretext/
- Awwwards Interactive Typography: https://www.awwwards.com/inspiration/interactive-typography
- FISH LETTER: https://www.awwwards.com/sites/fish-letter
