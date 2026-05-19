# Natural Language Tool Planning Design

日期：2026-05-19

## 背景

聊天入口已经去掉旧的媒体按钮模式和 `intent` 兼容路由。

现在用户只用自然语言表达需求。系统已有工具能力，例如生成图片、生成音乐、生成视频、语音朗读、记忆治理、作品发布、睡眠整理。

当前问题是：模型有时仍按“普通聊天模型”的自我认知回答，否认已有工具能力。典型例子：

- 用户说“唱首歌给我听”。
- 系统已有 `star.generateMusic`。
- 但 planner 可能输出“我不会唱，也没有声音”。

这不是生成器不可用。

根因是工具规划设计还不够完整：

- 工具 metadata 没有充分表达自然语言能力边界。
- planner 输出没有显式决策状态。
- tool search 过度依赖 planner 主动请求。
- 后端只能看到 `reply + toolCalls`，无法判断 planner 是在回答、执行、追问还是拒绝。

## 目标

建立一个自然语言优先的工具规划系统。

目标：

- 用户不需要选择模式。
- 系统不恢复 `intent` 路由。
- 后端不增加“拒绝纠偏层”。
- 工具目录成为系统能力的唯一事实来源。
- planner 基于候选工具做结构化决策。
- 工具数量增长时，不把全量工具塞进每轮上下文。
- 媒体生成、语音朗读、发布、记忆、设计等能力走同一条链路。

## 非目标

本设计不做这些事：

- 不恢复前端媒体快捷按钮。
- 不恢复 `intent: image/music/audio/video`。
- 不做后端语义纠偏规则。
- 不引入第二套审批系统。
- 不依赖 provider 原生 function calling。
- 不一次性接入外部插件市场。
- 不让模型直接执行工具。

## 核心原则

第一，工具目录是能力事实来源。

planner 不能基于语言模型自身能力判断“我能不能做”。它只能基于工具卡片判断系统能力。

第二，检索只提供候选能力，不决定执行。

工具搜索不是旧路由。搜索结果只是给 planner 的候选工具。

第三，planner 必须输出结构化决策。

不能只返回一段文本。必须明确这轮是普通回答、工具执行、继续搜索、追问、能力不可用，还是安全拒绝。

第四，后端只做结构校验和执行。

后端不写“如果模型说不能但其实能，就重试”的语义补丁。后端只检查计划结构、工具存在、输入合法、策略允许。

第五，工具结果必须回到对话。

工具执行成功后，媒体结果通过 `chatParts` 合并进 assistant message。持久化 task result 不保存 raw base64。

## 总体架构

```text
用户自然语言
  ↓
Chat Context Builder
  ↓
Tool Candidate Retrieval
  ↓
Structured Planner
  ↓
Plan Validator
  ↓
Task Queue + Policy
  ↓
Tool Executor
  ↓
Assistant Message + chatParts
```

职责边界：

- Tool Catalog：描述能力。
- Candidate Retrieval：找候选能力。
- Planner：理解自然语言并做计划。
- Validator：校验计划结构。
- Policy：决定是否允许、是否需要确认。
- Executor：执行工具。
- Message Layer：展示文本、状态、媒体和确认卡。

## 工具定义

工具定义需要从“可执行函数”升级为“可规划能力”。

建议扩展：

```ts
export type AgentToolCapability =
  | 'text_to_speech'
  | 'generate_image'
  | 'generate_music'
  | 'generate_song'
  | 'generate_video'
  | 'search_memory'
  | 'search_work'
  | 'preview_design'
  | 'commit_design'
  | 'publish_work'
  | 'govern_memory'
  | 'sleep_review'

export type AgentToolOutputType =
  | 'text'
  | 'status'
  | 'audio'
  | 'image'
  | 'music'
  | 'video'

export type AgentToolDefinition = {
  name: string
  description: string
  title?: string
  category?: AgentToolCategory
  behavior?: AgentToolBehavior
  capabilities?: AgentToolCapability[]
  aliases?: string[]
  whenToUse?: string
  cannotDo?: string
  outputTypes?: AgentToolOutputType[]
  inputSchema?: Record<string, unknown>
  riskLevel?: AgentToolRiskLevel
  approvalRequired?: boolean
}
```

`capabilities` 使用受控词表。

不要让每个工具自由创造能力名，否则检索质量会变差。

## 音乐和朗读边界

`star.generateMusic`：

```ts
{
  capabilities: ['generate_music', 'generate_song'],
  aliases: ['唱首歌', '写首歌', '做音乐', '生成音乐', '配乐', '旋律', 'BGM'],
  whenToUse: '用户要求唱歌、写歌、生成音乐、制作配乐、生成旋律时使用。',
  cannotDo: '不保证实时真人演唱；输出是生成的音乐文件。',
  outputTypes: ['music']
}
```

`star.speakReply`：

```ts
{
  capabilities: ['text_to_speech'],
  aliases: ['读给我听', '念给我听', '语音回复', '用声音说'],
  whenToUse: '用户要求朗读本轮回复或用语音回复时使用。',
  cannotDo: '不是唱歌工具。',
  outputTypes: ['audio']
}
```

自然语言映射：

- “唱首歌” → `star.generateMusic`
- “制作音乐” → `star.generateMusic`
- “写首歌” → `star.generateMusic`
- “读给我听” → `star.speakReply`
- “念出来” → `star.speakReply`

## 工具候选检索

每轮对话先做一次轻量检索。

输入：

```ts
type ChatToolCandidateInput = {
  message: string
  attachmentKinds: AttachmentKind[]
  recentToolNames: string[]
  commonToolNames: string[]
}
```

输出：

```ts
type ChatToolCandidates = {
  commonTools: AgentToolDefinition[]
  retrievedTools: AgentToolDefinition[]
}
```

规则：

- `commonTools` 最多 4 个。
- `retrievedTools` 最多 6 个。
- 去重后交给 planner。
- 最近成功使用过的工具可以加权。
- 搜索字段包括 `name/title/capabilities/aliases/whenToUse/category/behavior`。
- 第一版用确定性评分。
- 工具规模变大后可以替换为 BM25 或 embedding，接口不变。

常用工具建议：

```ts
[
  'star.speakReply',
  'star.generateImage',
  'star.generateMusic',
  'star.generateVideo',
]
```

检索不是执行。

例如用户说“唱首歌给我听”，检索可以命中 `star.generateMusic`，但是否执行仍由 planner 决定。

## Planner 输出

建议 schema：

```ts
export type StarChatPlannerDecision =
  | 'answer'
  | 'tool'
  | 'search'
  | 'clarify'
  | 'unavailable'
  | 'refuse'

export type StarChatTurnPlan = {
  decision: StarChatPlannerDecision
  reply: string
  toolSearches: StarChatToolSearch[]
  toolCalls: StarChatToolCall[]
  missingInputs: string[]
  basis: {
    candidateTools: string[]
    selectedTools: string[]
    reason: string
  }
}
```

含义：

- `answer`：普通文字回复。
- `tool`：执行工具。
- `search`：候选工具不足，需要额外工具搜索。
- `clarify`：缺必要输入，且上下文无法补全。
- `unavailable`：工具目录没有该能力。
- `refuse`：安全、权限或边界拒绝。

`unavailable` 和 `refuse` 分开。

“系统没有这个能力”和“系统不能做这个事”不是一类问题。

## Planner 契约

system prompt 需要明确：

```text
你是工具规划器，不是独立聊天模型。
系统能力以工具卡片为准。
如果候选工具能完成用户请求，必须输出 decision: "tool"。
不要因为语言模型自身限制而说没有能力。
不要编造工具。
不要直接执行工具。
只返回 JSON。
```

自然语言规则：

```text
用户明确要求生成图片、音乐、视频、语音时，优先使用候选工具。
只要能从当前上下文构造合理输入，就不要追问。
只有缺少必要对象且上下文无法补全时，才输出 clarify。
如果工具目录没有相关能力，输出 unavailable。
如果请求违反安全或用户边界，输出 refuse。
```

## Search 流程

最多两轮规划。

```text
1. 后端先检索候选工具。
2. planner 基于 commonTools + retrievedTools 输出计划。
3. 如果 decision = search：
   - 后端执行 planner 请求的 tool search。
   - planner 第二次规划。
4. 第二次规划不允许继续 search。
```

大部分请求只走一轮。

少见工具才走第二轮。

## Plan Validator

后端只做结构校验。

规则：

```ts
decision === 'tool' && toolCalls.length === 0 -> invalid
decision === 'search' && toolSearches.length === 0 -> invalid
decision === 'clarify' && missingInputs.length === 0 -> invalid
decision === 'unavailable' && basis.candidateTools.length > 0 -> invalid
unknown toolName -> invalid
tool input 不符合 inputSchema -> invalid
```

非法计划处理：

- 记录 agent event。
- 降级为普通文本聊天。
- 不做语义纠偏。
- 不自动猜测工具。

## 执行链

沿用现有链路：

```text
toolCalls
  ↓
normalizeStarChatToolCalls()
  ↓
executeStarChatToolCalls()
  ↓
agent task queue
  ↓
agent policy
  ↓
agent loop executor
  ↓
{ output, chatParts }
```

保留双通道：

- `output`：可持久化，不含 raw base64。
- `chatParts`：当前对话即时展示，可短暂包含 base64，最终由消息存储流程 blob 化。

工具失败时不生成伪媒体 part。

## 风险和审批

planner 可以建议：

```ts
mode: 'execute' | 'propose'
```

最终以后端 policy 为准。

规则：

- `propose` 永远只等待确认。
- low risk 可自动执行。
- medium/high risk 按用户边界策略决定是否审批。
- 用户边界设置不改变工具能力，只改变执行权限。

## 示例

用户：

```text
可以唱首歌给我听吗
```

计划：

```json
{
  "decision": "tool",
  "reply": "可以，我给你做一首适合轻声听的歌。",
  "toolSearches": [],
  "toolCalls": [
    {
      "toolName": "star.generateMusic",
      "input": {
        "prompt": "一首适合轻声唱给对方听的温柔歌曲"
      },
      "mode": "execute",
      "evidence": "用户要求唱首歌。",
      "reason": "唱歌请求可由音乐生成工具完成。"
    }
  ],
  "missingInputs": [],
  "basis": {
    "candidateTools": ["star.generateMusic"],
    "selectedTools": ["star.generateMusic"],
    "reason": "候选工具支持 generate_song。"
  }
}
```

用户：

```text
把这句话读给我听
```

计划：

```json
{
  "decision": "tool",
  "reply": "可以，我读给你听。",
  "toolSearches": [],
  "toolCalls": [
    {
      "toolName": "star.speakReply",
      "input": {
        "text": "$reply"
      },
      "mode": "execute",
      "evidence": "用户要求朗读。",
      "reason": "语音回复工具可以完成。"
    }
  ],
  "missingInputs": [],
  "basis": {
    "candidateTools": ["star.speakReply"],
    "selectedTools": ["star.speakReply"],
    "reason": "候选工具支持 text_to_speech。"
  }
}
```

用户：

```text
做一个
```

计划：

```json
{
  "decision": "clarify",
  "reply": "你想做图片、音乐、视频，还是别的内容？",
  "toolSearches": [],
  "toolCalls": [],
  "missingInputs": ["目标内容类型"],
  "basis": {
    "candidateTools": [],
    "selectedTools": [],
    "reason": "用户没有说明要生成的对象。"
  }
}
```

## 验收标准

- “唱首歌给我听”触发 `star.generateMusic`。
- “制作一个音乐”触发 `star.generateMusic`。
- “读给我听”触发 `star.speakReply`。
- “生成一张图片”触发 `star.generateImage`。
- “做个视频”触发 `star.generateVideo`。
- “做一个”进入 `clarify`，不乱调用工具。
- planner 不能输出 `decision: tool` 且 `toolCalls` 为空。
- 第二轮规划不能继续 search。
- 工具失败只返回 status/error，不生成伪媒体 part。
- task result 不包含 raw base64。
- 前端不出现用户手选媒体模式。

