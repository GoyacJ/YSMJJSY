# /chat 星轨共写设计

日期：2026-05-16

## 背景

当前 `/chat` 已经有星空舞台、逐字显影、媒体输入、媒体生成、历史保存和少量状态短句。问题在交互结构：它仍然接近“输入框 + 消息列表”的聊天范式。

新方向是把 `/chat` 改成“会回应、会记住、会生长的信”。用户不是发送气泡，而是在夜空里写下一段星轨。AI 不是回复气泡，而是在这段星轨旁显影、补全、沉淀成记忆星。

本设计不修改 MiniMax API、钥匙体系、认证、数据库模型、媒体生成链路和 `StarComposer.vue`。

## 目标

- 用户文字像星尘一样从输入框飞出，落成一段星轨。
- AI 回复从用户星轨附近显影，不再固定左侧气泡。
- 每轮对话结束后沉淀出一颗记忆星。
- 点击记忆星可以回看相关片段。
- 语音和音乐显示为光谱丝带，不使用老旧播放器视觉。
- 图片显示为记忆碎片，不只是普通附件卡片。

## 方案

### 星轨共写

`StarOrbitStage` 替代当前传统消息列表视觉。它接收现有 `StarChatMessage[]`，在前端派生出一组 `StarOrbitGroup`。

每组包含：

- 一条 user message。
- 紧随其后的 assistant message。
- 一个舞台坐标。
- 一个视觉 mood。
- 一个 memory label。

布局规则：

- 新对话从画面中下区域开始。
- 后续对话沿轻微螺旋路径分布。
- 用户消息和 AI 回复保持空间邻近。
- 长文本最多展示数行，点击记忆星再回看完整内容。

### AI 显影

AI 回复前保留现有安全状态短句。状态短句不是模型思维链，只是产品状态。

回复开始时：

- 用户文字先作为星轨出现。
- AI 旁边出现光核。
- 回复字符从光核附近逐字显影。
- 流式 delta 到达时继续追加，不等待整段完成。

### 记忆星

每轮完整对话生成一个本地记忆星。

MVP 不新增 AI 摘要调用。标签规则：

- 普通文字：取用户输入前 8 到 12 个字。
- 图片：`图像记忆`。
- 音频：`声音记忆`。
- 音乐：`旋律记忆`。
- 视频：`影像记忆`。

点击记忆星：

- 高亮对应星轨组。
- 打开回看浮层。
- 浮层显示用户输入、AI 回复、媒体结果和复制按钮。

### 月相回复

前端按消息形态计算 mood，不改变回复内容。

- `new-moon`：短回复。
- `half-moon`：普通回复。
- `full-moon`：较长回复。
- `meteor`：很短但完整的一句话。
- `nebula`：包含图片、音频、音乐或视频结果。

### 媒体表现

媒体仍使用现有 `StarChatPart` 数据结构。

- 图片：显示为半透明记忆碎片，保留下载。
- 音频 / 音乐：显示为光谱丝带，保留播放、音量、下载。
- 视频：保留原能力，不做生成链路调整。

## 组件边界

新增：

- `components/StarOrbitStage.vue`
- `components/StarOrbitGroup.vue`
- `components/StarMemoryConstellation.vue`
- `components/StarMemoryPopover.vue`
- `components/StarSpectralMedia.vue`

保留：

- `components/StarComposer.vue`
- `composables/useStarChat.ts`
- MiniMax server routes

替换：

- `StarChat.vue` 中的舞台组件从 `StarMagicStage` 切到 `StarOrbitStage`。

`StarMagicStage`、`StarChatThread`、`StarChatMessage` 可先保留，降低回滚成本。

## 可访问性

- 所有消息文本仍在 DOM 中。
- 记忆星使用 `button`。
- 复制按钮可键盘聚焦。
- 媒体播放按钮保留 `aria-label`。
- `prefers-reduced-motion: reduce` 下关闭飞行动画和粒子位移。

## 验证

- Vitest 覆盖消息归组、记忆星、popover、状态短句保留。
- Playwright 覆盖 `/chat` 打开、发送消息、回复显影、记忆星点击。
- 浏览器截图检查桌面和移动端布局。
