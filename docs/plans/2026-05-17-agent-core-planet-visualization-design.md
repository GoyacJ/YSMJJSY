# Agent Core 与记忆星球可视化设计

日期：2026-05-17

## 定位

上一阶段已经完成“一钥匙一智能体”的后端闭环：记忆、反思、进化提案、Agent Core API 和基础面板。

下一阶段目标是让用户看见这件事：

这把钥匙里有一个智能体。它正在学习这段关系，并把学习结果变成一颗会生长的记忆星球。

本阶段不新增复杂 3D，不做后台周期任务，不重写聊天链路。

## 目标

- Agent Core 从调试面板变成正式产品入口。
- 用户能看懂智能体当前状态、学到了什么、准备怎么进化。
- 记忆星球能吃到 agent 状态，而不是只显示普通公开星点。
- 待确认提案、已接受提案、反思和记忆在视觉上有不同含义。
- 移动端仍保持轻，不遮挡输入。

## 非目标

本阶段不做：

- 自动修改页面设计。
- AI 主动发消息。
- 定时学习任务。
- 复杂 WebGL / Three.js 星球。
- 多智能体协作。
- 记忆删除、合并、降权等治理能力。

这些放到后续阶段。

## 产品结构

页面保留 `/chat` 主路径。

新增两块体验：

1. `AgentCorePanel` 升级为“智能体核心”。
2. `StarMemoryMap` 升级为“记忆星球入口”，点击后展示可视化状态。

结构：

```text
/chat
  StarChat
  StarMemoryMap
  AgentCorePanel
    当前状态
    最近反思
    待确认进化
    进化历史
  MemoryPlanetPanel
    星球概览
    记忆星点
    反思星云
    提案光点
```

## Agent Core 设计

### 入口

当前 `Core` 文案太工程化。

改为：

```text
智能体核心
```

移动端可简写为：

```text
核心
```

### 面板内容

面板分四块。

#### 当前状态

展示：

- 智能体名称。
- MBTI。
- 当前语气。
- 当前角色。
- 学习模式。

当前后端还没有单独的 `tone` / `relationshipRole` 字段时，先从已接受提案和默认值派生。

默认：

```text
语气：克制、温柔、安静
角色：记忆星球守护者
学习：辅助学习
```

#### 最近反思

显示最近 3 条。

每条包含：

- 摘要。
- 时间。
- 来源类型：聊天后生成。

空状态：

```text
还没有形成反思
```

#### 待确认进化

每条提案显示：

- 标题。
- 摘要。
- 接受后会改变什么。
- 接受 / 拒绝。

变化说明从 `payload` 生成。

例子：

```text
更短的回复
接受后：后续回复会减少铺陈，优先短句。
```

#### 进化历史

显示最近已接受或已拒绝的提案。

第一版只读 `agent_evolution_proposals`。

状态：

- `accepted`：已确认。
- `rejected`：已拒绝。
- `applied`：已生效。

## 记忆星球设计

### 入口

当前 `StarMemoryMap` 是设置入口。

本阶段拆清楚两个概念：

- `智能体核心`：查看学习与进化。
- `记忆星球`：查看记忆可视化。

`StarMemoryMap` 文案改为：

```text
记忆星球
记忆、反思和进化轨道
```

设置入口仍保留在面板内部或旁边。

### 星球状态映射

使用现有数据派生，不新增生成调用。

```ts
type MemoryPlanetState = {
  memoryStars: MemoryStar[]
  reflectionNebulas: ReflectionNebula[]
  proposalLights: ProposalLight[]
  orbitRings: OrbitRing[]
  mood: 'quiet' | 'warm' | 'bright' | 'deep'
}
```

映射规则：

- active memory -> 记忆星点。
- high importance memory -> 更亮的星。
- recent reflection -> 星云。
- pending proposal -> 未确认光点。
- accepted/applied proposal -> 星环。
- rejected proposal -> 暗淡轨迹，不放主视觉。

### 记忆类型视觉

```text
preference      小型稳定星
emotion         呼吸光点
event           时间刻度星
person          主星旁伴星
creative_asset  碎片星卡
```

第一版不需要渲染复杂图形。

用 CSS + DOM 即可：

- `button` 表示可点击星点。
- `span` 表示背景星云。
- `article` 表示当前选中的记忆详情。

### 星球面板

点击记忆星球后打开面板。

展示：

- 记忆总数。
- 活跃记忆数。
- 最近反思数。
- 待确认提案数。
- 星球画布。
- 当前选中星点详情。

空状态：

```text
星球还在形成。继续聊天后，它会长出第一批记忆星。
```

## 数据接口

复用 `GET /api/agent/core`，但需要扩展返回结构。

建议返回：

```ts
type AgentCoreResponse = {
  profile: {
    keyId: string
    assistantName: string
    mbti: string
    configured: boolean
    tone: string
    relationshipRole: string
    learningMode: string
  }
  memoryCounts: {
    total: number
    active: number
    archived: number
    rejected: number
  }
  memories: Array<{
    id: string
    type: string
    content: string
    importance: number
    confidence: number
    createdAt: string
  }>
  latestReflections: Array<{
    id: string
    summary: string
    createdAt: string
  }>
  proposals: {
    pending: AgentCoreProposal[]
    history: AgentCoreProposal[]
  }
}
```

不另开 `memory-planet` API，避免状态分裂。

## 组件边界

新增：

- `components/MemoryPlanetPanel.vue`
- `components/MemoryPlanetStage.vue`
- `utils/memory-planet.ts`
- `utils/memory-planet.test.ts`

修改：

- `components/AgentCorePanel.vue`
- `components/StarMemoryMap.vue`
- `composables/useAgentCore.ts`
- `server/api/agent/core.get.ts`
- `assets/css/main.css`
- `pages/chat.vue`

保留：

- 聊天流式链路。
- 进化提案接受 / 拒绝接口。
- `ProfileSettingsSheet`。

## 响应式

桌面端：

- Agent Core 放右上。
- 记忆星球入口放右侧偏下。
- 两个面板不能同时大面积遮挡输入区。打开一个时另一个保持收起。

移动端：

- 两个入口放在输入区上方或右下角纵向排列。
- 面板最大高度不超过视口 70%。
- 星球画布减少星点文本，只显示点和详情。

## 可访问性

- 星点使用 `button`。
- 每个星点有 `aria-label`。
- 面板使用 `role="dialog"`。
- 接受 / 拒绝按钮保留明确 label。
- 视觉星云只做装饰，`aria-hidden="true"`。
- reduced motion 下关闭呼吸动画和轨道漂移。

## 验收标准

- `/chat` 显示“智能体核心”和“记忆星球”两个明确入口。
- Agent Core 能显示当前状态、最近反思、待确认提案和历史。
- 待确认提案能显示“接受后会改变什么”。
- 记忆星球能根据 memories/reflections/proposals 派生视觉状态。
- 点击记忆星点能查看详情。
- 接受 / 拒绝提案后，Agent Core 和记忆星球状态刷新。
- 桌面和移动端不遮挡输入框。
- `npm run test`、`npm run build`、相关组件测试通过。
