# Private Star Agent Product Design

日期：2026-05-19

## 项目开发风格观察

当前项目的开发方式已经形成稳定习惯。

- 文档先行：重大方向都放在 `docs/plans/YYYY-MM-DD-*-design.md` 和 `docs/plans/YYYY-MM-DD-*-implementation.md`。
- 小步提交：近期提交集中在隐私契约、任务恢复、Agent runtime 边界、provider 解耦。
- 测试靠前：服务层有大量 `*.test.ts`，核心行为通过 Vitest 固化。
- 前端偏体验组件：`pages/chat.vue` 负责页面编排，`components/*Panel.vue` 承载复杂体验，`composables/*` 封装请求和状态。
- 后端偏服务分层：`server/services/*` 承载业务规则，`server/api/*` 负责路由入口，`server/db/*` 管数据结构和持久化。
- Agent 能力已经系统化：已有 policy、privacy、runtime、task queue、sleep、learning、design commit、blob storage。
- 产品语言仍混杂：前端可见词里仍有 `Agent Core`、`任务中心`、`审计事件`、`睡眠周期` 这类工程词。

新设计必须顺着这个风格走。

不推倒重写。
不新建一套产品壳。
先用现有 Agent OS 能力，把用户可见的信息架构改顺。

## 外部约束

本项目处在拟人化 AI、生成内容、私人数据长期记忆三个监管敏感区。

参考：

- 国家发展改革委关于“人工智能+”的政策解读：AI 从工具走向生产生活场景深度赋能，强调应用落地、民生场景、安全底座。
  - https://www.ndrc.gov.cn/xxgk/jd/jd/202508/t20250826_1400078.html
- 《人工智能生成合成内容标识办法》自 2025 年 9 月 1 日施行，要求生成合成内容具备显式、隐式标识。
  - https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm
- 《人工智能拟人化互动服务管理暂行办法》自 2026 年 7 月 15 日施行，要求透明告知、情感边界、未成年人保护、数据复制删除、敏感信息训练限制。
  - https://www.cac.gov.cn/2026-04/10/c_1777558395078289.htm
- EU AI Act 强调风险分级、透明度和通用 AI 治理。
  - https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai

因此产品不能走“虚拟恋人沉迷化”。

应该走“亲密表达 + 用户主权 + 可审计智能体”。

## 新定位

产品名暂定：

星信

一句话定义：

一个可被托付、可被纠正、可沉淀记忆、可生成作品的私人星球智能体。

它不是普通聊天页。
也不是表白页。
也不是虚拟伴侣。

它的核心是：

- 只记住用户允许它记住的事。
- 只在用户允许的边界内行动。
- 把记忆、情绪、创作素材整理成可管理的私人星球。
- 把聊天沉淀成作品。
- 所有记忆、行动、作品都可追溯、可撤回、可删除。

## 产品原则

### 1. 私密默认

记忆、作品、页面设计、媒体生成结果默认私密。

公开必须由用户二次确认。

### 2. 记忆可治理

系统不能只“记住”。

必须能解释：

- 记住了什么。
- 为什么记住。
- 来源是什么。
- 是否经过用户确认。
- 影响过哪些回复或作品。
- 如何删除或归档。

### 3. 行动需分级

Agent 行动按风险分三层：

- 低风险：整理、摘要、生成草稿，可以自动执行。
- 中风险：写入长期记忆、生成作品、修改设计，需要用户确认或策略允许。
- 高风险：公开发布、删除大量数据、改变人格边界、使用敏感信息，必须确认。

### 4. 拟人化要克制

允许温度。
不允许诱导依赖。

界面必须明确这是 AI 服务。
不把它包装成真人。
不把“陪伴”作为替代现实关系的目标。

### 5. 工程能力不外露

Agent OS 是底层。

用户看见的是：

- 记忆
- 作品
- 边界
- 记录
- 待确认行动
- 整理报告

用户不应该看到：

- Agent Core
- Task Center
- Audit Event
- Sleep Cycle
- active · star
- runtime
- policy

## 信息架构

主界面保留 `/chat`。

右上角入口收束为一个：

星球

星球面板包含四个一级 Tab：

### 1. 记忆

替代当前记忆星球的主要入口。

内容：

- 记忆星图。
- 记忆列表。
- 记忆详情。
- 来源。
- 状态。
- 确认、归档、拒绝、删除。

### 2. 作品

承接当前 `works`、媒体生成、页面设计预览。

内容：

- 私密作品库。
- 图片、音乐、视频、页面、文字筛选。
- AI 生成标识状态。
- 使用过的记忆。
- 发布状态。
- 发布、撤回。

### 3. 边界

承接当前设置和未来 policy。

内容：

- 允许记住什么。
- 不允许记住什么。
- 哪些动作需要确认。
- AI 互动提示。
- 未成年人模式。
- 数据导出。
- 删除聊天。
- 清空记忆。

### 4. 记录

替代审计事件和时间线。

内容：

- 记忆变更记录。
- 行动批准和拒绝。
- 作品生成记录。
- 发布记录。
- 整理报告。
- 错误和失败记录。

## 页面结构

### 首页 `/`

当前首页视觉有辨识度。

需要改定位，不需要重做视觉。

调整方向：

- 从“520 表白入口”改成“私人星球入口”。
- 保留钥匙输入。
- 保留浪漫语气，但减少表白单点。
- 强化“私密”“记忆”“作品”“边界”。

示例文案：

- 标题：余生梦见皆是缘
- 副文案：一把钥匙，进入只属于你的私人星球。
- 输入提示：输入星球钥匙
- 操作：进入星球 / 创建钥匙

### 初始化 `/setup`

初始化不再只收 MBTI 和基础资料。

需要增加边界设置。

第一版字段：

- 星球称呼。
- 用户称呼。
- 关系语气。
- 允许记住的内容。
- 不允许记住的内容。
- 生成作品是否默认私密。
- 写入长期记忆是否需要确认。
- 公开作品是否需要二次确认。
- 是否开启未成年人模式。

### 聊天 `/chat`

聊天仍是主工作区。

顶部操作变为：

- 星球
- 生成/附件入口
- 退出或设置入口放入星球面板

聊天中的 Agent 输出需要继续支持：

- 普通回复。
- 生成状态。
- 作品卡片。
- 待确认行动提示。
- 整理报告提示。

## 组件策略

第一阶段不大拆组件。

先新增一个组合壳：

`components/StarPlanetPanel.vue`

它负责：

- 打开和关闭星球面板。
- 管理四个 Tab。
- 组合现有 `MemoryPlanetPanel`、`AgentCorePanel`、`ProfileSettingsSheet` 能力。
- 把工程词翻译成用户词。

现有组件先保留。

后续再逐步瘦身：

- `MemoryPlanetPanel` 聚焦记忆。
- `AgentCorePanel` 改为内部的行动和记录模块。
- `ProfileSettingsSheet` 改为边界模块。

## 数据策略

第一阶段尽量复用现有数据。

需要新增或明确的字段只放到 policy 和作品元数据。

优先级：

1. UI 文案和入口统一。
2. API 聚合层做字段映射。
3. 数据库只补必要字段。
4. 再做深层行为改造。

建议新增概念：

```ts
type StarBoundarySettings = {
  memoryWriteMode: 'manual' | 'assisted' | 'auto'
  generatedWorksDefaultVisibility: 'private' | 'public'
  requireApprovalForPublishing: boolean
  requireApprovalForPersonaChange: boolean
  requireApprovalForSensitiveMemory: boolean
  disallowedMemoryTopics: string[]
  allowedMemoryTopics: string[]
  minorMode: boolean
}
```

建议作品元数据补充：

```ts
type GeneratedContentDisclosure = {
  aiGenerated: true
  explicitLabel: string
  provider?: string
  generatedAt: string
  sourceWorkId?: string
}
```

## 后端策略

继续沿用当前服务层风格。

重点服务：

- `server/services/agent-policy.ts`
- `server/services/agent-privacy.ts`
- `server/services/agent-learning.ts`
- `server/services/agent-sleep.ts`
- `server/services/agent-task-queue.ts`
- `server/services/star-agent-tools.ts`
- `server/services/design-commit.ts`
- `server/services/blob-storage.ts`

新增逻辑应优先放服务层。

API 路由只做：

- session 校验。
- 输入校验。
- 调服务。
- 输出安全字段。

## 合规策略

### 生成内容标识

文本、图片、音频、视频、页面作品都需要标识状态。

第一版最小实现：

- 作品详情显示“AI 生成”。
- 作品元数据写入 `aiGenerated: true`。
- 发布页显示 AI 标识。
- 下载或导出时保留显式标识。

### 拟人化边界

第一版最小实现：

- 初始化和边界页显示 AI 服务提示。
- 不使用“真人”“永远陪伴”“替代现实关系”等表达。
- 增加未成年人模式字段。
- 高风险情绪内容不进入浪漫化回复。

### 数据主权

第一版最小实现：

- 记忆可删除。
- 聊天和记忆后续支持导出。
- 敏感记忆默认确认后写入。
- 用户拒绝的记忆不能被睡眠整理恢复。

## 视觉方向

保留星空。

降低表白页和工程面板感。

视觉关键词：

- 私密
- 克制
- 清醒
- 有秩序
- 有温度

具体规则：

- 聊天区保持安静，不增加装饰。
- 星球面板承载复杂信息。
- Tab 使用短词，不使用说明文案堆叠。
- 卡片只用于作品、记录、行动条目。
- 不在界面里解释功能。
- 移动端优先保证面板可读和可关闭。

## 成功标准

产品成功标准：

- 用户能理解这是私人星球智能体，不是表白页。
- 用户能找到记忆、作品、边界、记录。
- 用户能看见系统为什么记住、为什么行动。
- 用户能撤回公开、删除记忆、拒绝行动。
- AI 生成内容有标识。

工程成功标准：

- 不破坏现有聊天、记忆、作品、Agent OS。
- 通过 `npm run test`。
- 通过 `npm run build`。
- `/`、`/setup`、`/chat` 桌面和移动端可用。
- 高风险行为继续经过 policy。

## 不做

第一阶段不做：

- 多人社交。
- 角色市场。
- 虚拟恋人强化。
- 自动公开。
- 复杂商业化。
- 新模型平台大迁移。
- Agent OS 重写。
- 大规模数据库重构。

