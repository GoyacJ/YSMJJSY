# /chat 魔法星信舞台设计

日期：2026-05-16

## 目标

把 `/chat` 从“信纸页面上覆盖聊天框”重构为“星空舞台上的魔法对话”。

底部发送框保持现状。原来图中那块静态信纸正文区域不再需要。用户发送的文字应该像星光字粒一样从底部飘到舞台上，最后连成一句话。AI 回复不再像普通聊天气泡，而像魔法显影：光尘聚合、文字跳出、媒体内容从光里浮现。

## 设计方向

采用“星轨书写剧场 + 魔法显影回复”。

用户消息：

- 每个字独立渲染为一个 glyph。
- 字从底部输入框方向轻微上浮。
- 按字符顺序延迟出现。
- 最终连成一行或多行星轨文字。
- 旧用户消息退为更低亮度的星座记录。

AI 消息：

- 消息出现前先显示一枚小光核。
- 回复文字按字符或短词粒度跳出。
- 每个字符带轻微缩放、发光和位移。
- 流式回复时新增字符继续触发显影动画。
- 图片、音频、音乐、视频作为“魔法卡片”从光核下方浮现。

## 页面结构

`/chat` 分为四层。

1. 背景层：深色星空、星尘、轻微星云、低频流星。
2. 舞台层：消息和媒体结果的主要显示区域。
3. 状态层：额度、记忆星图、设置入口。
4. 控制层：当前发送框，保持现状。

`DynamicStarPage` 和 `StarScene` 不再作为 `/chat` 的主视觉。钥匙对应的设计数据后续可以影响舞台色调和星云密度，但不再直接渲染那块信纸正文。

## 组件边界

保留：

- `StarChat.vue`：状态编排、发送、流式处理、附件、语音、设计模式事件。
- `StarComposer.vue`：发送框，不改核心布局。
- `StarMediaCard.vue` / `StarAudioPlayer.vue`：媒体展示。

新增或重构：

- `StarMagicStage.vue`：舞台容器。负责背景里的消息布局、滚动、空状态、历史消息远近层次。
- `StarChatMessage.vue`：改为根据 role 渲染不同动效。
- `StarGlyphText.vue`：把文本拆成字符，输出可延迟动画的 span。

## 动效规则

用户文字：

- `star-user-glyph-float`：从 `translate3d(1.5rem, 4rem, 0)` 到原位。
- 每个字符延迟 `index * 28ms`。
- opacity 从 0 到 1。
- text-shadow 从强到弱。

AI 文字：

- `star-ai-glyph-pop`：从 `scale(0.72) translateY(0.7rem)` 到原位。
- 每个字符延迟 `index * 18ms`。
- 附带短暂 glow。
- assistant 容器有 `magic-orb` 和少量 sparkles。

媒体卡片：

- `star-card-conjure`：从轻微缩放、模糊、下移到稳定。
- 保留复制和下载。
- 音频/音乐播放器继续使用当前波形播放器。

减少动画：

- `prefers-reduced-motion: reduce` 下关闭位移和星尘动效，只保留淡入。

## 数据流

不改接口。

发送后：

1. `StarChat.vue` 立即追加 user message。
2. `StarMagicStage` 接收 `localMessages`。
3. `StarChatMessage` 根据 role 显示动效。
4. assistant placeholder 追加后显示光核。
5. 流式 delta 更新 text part。
6. 新增字符由 `StarGlyphText` 触发显影动画。

## 测试目标

单元测试：

- `StarGlyphText` 能按字符拆分文本。
- user 消息有星轨 glyph 类。
- assistant 消息有 magic orb 和 glyph 类。
- 媒体消息仍渲染下载和播放器。
- `StarChat` 发送后仍追加 user 和 assistant。

E2E：

- `/chat` 不再渲染静态信纸区域。
- 发送框仍可正常发送。
- user 消息进入舞台。
- AI 回复进入舞台。
- 附件菜单、设计模式、记忆设置仍可用。

