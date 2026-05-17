# 一钥匙一智能体设计

日期：2026-05-17

## 定位

本项目从“520 私人星空告白系统”升级为“一把钥匙对应一个会学习、会反思、会进化的 AI 记忆体”。

钥匙不只是访问码。钥匙是智能体的身份边界。每把钥匙拥有独立人格、独立记忆、独立作品、独立进化记录，并驱动一颗会生长的记忆星球。

一句话定义：

创建一把钥匙，生成一个只属于这段关系的 AI 记忆体。它会聊天，会创作，会记住，会反思，会在确认后进化。

## 当前基础

现有系统已经有这些能力：

- `key_profiles`：钥匙身份、称呼、MBTI、活动状态。
- `conversations`：按钥匙保存聊天历史。
- `memories`：按钥匙保存长期记忆。
- `attachments`：按钥匙保存上传媒体。
- `media_tasks`：按钥匙保存媒体生成任务。
- `key_designs`：按钥匙保存动态页面设计。
- `/chat`：多模态聊天、流式回复、媒体生成、设计模式。
- `StarMemoryMap`：记忆星图入口。

新设计不推翻这些结构。它在现有钥匙体系上增加一层智能体状态。

## 设计原则

- 不做无限自主思考。
- 不让 AI 未经确认直接改变人格。
- 不把推断当事实保存。
- 学习可以自动发生，进化必须可解释、可确认、可回滚。
- 聊天回复是主路径，学习和反思是次要任务。学习失败不能影响用户拿到回复。

## 核心模型

### 智能体身份

每把钥匙拥有一个智能体身份。

MVP 可继续复用并扩展 `key_profiles`，后续再拆为独立 `agent_profiles`。

建议字段：

```ts
type AgentProfile = {
  keyId: string
  name: string
  mbti: string
  tone: string
  relationshipRole: string
  learningMode: 'manual' | 'assisted' | 'auto'
  createdAt: string
  updatedAt: string
}
```

默认值：

- `name`: `星信`
- `mbti`: `INTJ`
- `tone`: `克制、温柔、安静`
- `relationshipRole`: `记忆星球守护者`
- `learningMode`: `assisted`

### 智能体记忆

当前 `memories` 只有 `emotion` 和 `preference`，不足以支撑智能体进化。

记忆类型扩展为：

```ts
type AgentMemoryType =
  | 'preference'
  | 'emotion'
  | 'event'
  | 'person'
  | 'creative_asset'
```

建议字段：

```ts
type AgentMemory = {
  id: string
  keyId: string
  type: AgentMemoryType
  content: string
  importance: number
  confidence: number
  sourceConversationId?: string
  sourceAttachmentId?: string
  status: 'active' | 'archived' | 'rejected'
  createdAt: string
  updatedAt: string
}
```

规则：

- `confidence` 低的内容不能直接进入 prompt 主上下文。
- `status = rejected` 的内容不能再被学习流程重复写入。
- 敏感身份、未经用户确认的关系判断、模型猜测，不保存为事实。

### 智能体反思

每次聊天完成后，智能体生成一次结构化反思。

反思只回答三件事：

- 这次互动发生了什么。
- 有什么值得长期记住。
- 是否建议调整智能体或星球。

建议表：`agent_reflections`

```ts
type AgentReflection = {
  id: string
  keyId: string
  sourceConversationId: string
  summary: string
  learnedJson: string
  proposalJson: string
  createdAt: string
}
```

`learnedJson` 保存候选记忆。`proposalJson` 保存候选进化建议。

### 智能体进化

进化不是自动改状态。进化先生成建议，再由用户确认。

建议表：`agent_evolution_proposals`

```ts
type AgentEvolutionProposal = {
  id: string
  keyId: string
  type: 'tone' | 'memory_weight' | 'page_design' | 'content_strategy'
  title: string
  reason: string
  beforeJson: string
  afterJson: string
  status: 'pending' | 'accepted' | 'rejected' | 'applied'
  createdAt: string
  appliedAt?: string
}
```

应用前写入快照。

建议表：`agent_state_snapshots`

```ts
type AgentStateSnapshot = {
  id: string
  keyId: string
  profileJson: string
  memoryJson: string
  designJson?: string
  reason: string
  createdAt: string
}
```

快照用于回滚人格、记忆权重和页面设计。

## 运行流程

每次聊天：

1. 用户发送文本或媒体。
2. 系统按现有逻辑生成回复。
3. 保存用户消息和 AI 回复。
4. 触发智能体学习。
5. 提取候选记忆。
6. 生成本次反思。
7. 生成进化建议。
8. 用户在智能体核心面板确认或拒绝。
9. 确认后应用到后续 prompt、记忆权重或页面设计。

学习流程失败时，只记录日志或静默失败。不能影响聊天回复。

## Prompt 上下文

后续聊天 prompt 不再只塞原始记忆。

应组织为：

```text
你是这把钥匙对应的智能体。

当前身份：
- 名字
- MBTI
- 语气
- 关系定位

长期记忆：
- 高权重偏好
- 高权重事件
- 最近情绪
- 已确认的重要人物或称呼

最近反思：
- 最近学到的内容
- 已确认的进化方向

边界：
- 不把推断说成事实
- 不主动制造关系结论
- 不越过用户确认修改人格
```

## 前端表现

新增“智能体核心”入口。

位置可与 `StarMemoryMap` 相邻，第一版使用浮层，不重做全局导航。

面板展示：

- 当前智能体身份。
- 当前语气和关系定位。
- 已形成记忆数量。
- 最近 3 条反思。
- 待确认进化建议。
- 接受 / 拒绝按钮。

文案方向：

```text
智能体核心
星信正在学习这把钥匙里的内容。

已形成记忆：18
最近反思：3
待确认进化：2
当前语气：克制、温柔、安静
```

## 记忆星球

第一版不做复杂 3D。

先把学习结果映射到现有星图：

- 记忆数量影响星点数量。
- 近期情绪影响星空色调。
- 高权重事件成为亮星。
- 媒体作品成为可点击碎片。
- 待确认进化建议显示为未命名星云。

## MVP 范围

第一阶段做：

- 扩展记忆类型和字段。
- 新增反思表。
- 新增进化建议表。
- 新增状态快照表。
- 每次聊天后生成反思和进化建议。
- 新增智能体核心面板。
- 用户可接受或拒绝进化建议。
- 接受后影响后续聊天 prompt。

第一阶段不做：

- 定时后台自主运行。
- AI 主动发消息。
- 自动改页面设计。
- 多智能体协作。
- 复杂 3D 星球。
- 自动长期规划。

## 验收标准

- 每把钥匙有独立智能体状态。
- 聊天后能生成反思记录。
- 有效记忆按钥匙隔离。
- 进化建议必须确认后生效。
- 拒绝的建议不会进入后续 prompt。
- 学习流程失败不影响聊天回复。
- 智能体核心面板能展示身份、记忆、反思和待确认建议。
- 测试覆盖数据解析、记忆过滤、建议状态流转、聊天 prompt 注入。
