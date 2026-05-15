# 520 Nuxt + MiniMax Redesign

## Status

本设计取代之前的纯静态前端方案。

旧方案仍然保留：

- `docs/plans/2026-05-15-520-confession-design.md`
- `docs/plans/2026-05-15-520-confession-implementation.md`

新前提：

- 项目不再是纯前端。
- 前端仍然是主体验。
- MiniMax 调用、鉴权、记忆、任务轮询放在 Nuxt 服务端。

## Goal

做一个 520 表白项目。

第一层是温柔、安静、像一封信。
后半段进入星空，有仪式感。
读完后出现智能对话。
对话支持文本、语音、图像、视频、音乐能力。
对话拥有克制的情感记忆。

## Assumptions

`100522` 是仪式密码，也是基础访问门。
它不是强安全登录系统。

如果后续要做真实访问控制，需要加：

- 独立账号
- 一次性链接
- 访问日志
- 速率限制
- 管理入口

首版不做这些。

语音能力首版默认做 TTS。
也就是“把星信的回复读出来”。
语音输入不作为首版目标。
除非确认 MiniMax 当前提供可用 ASR 接口，或改用浏览器 Web Speech API。

## Core Experience

主线是：

```text
输入 100522
打开信
读信
进入星空
星信出现
用对话继续这封信
把回应生成声音、图片、视频或音乐
```

智能对话不做成普通客服窗口。
它是这封信的延伸。

建议命名：

```text
星信
```

它的角色边界：

- 温柔
- 克制
- 真诚
- 不替用户强迫对方回应
- 不做情感操控
- 不制造压力
- 可以解释这封信
- 可以陪她生成纪念内容

## Page Flow

### 1. Unlock Gate

首屏只显示：

- 柔和背景
- 一张封着的信
- 密码输入框
- 输入 `100522` 后进入

错误时只提示：

```text
这不是这封信的钥匙。
```

不要出现技术错误。

### 2. Letter Scene

保留原设计：

- 信纸
- 逐段阅读
- 暖白、浅粉、淡金
- 纸张纹理
- 慢速动效

Pretext 用在特殊段落里：

- 文字绕开心形
- 文字绕开 `5.20`
- 文字绕开照片轮廓

所有 Pretext、Canvas、浏览器测量逻辑都放在 `<ClientOnly>` 内。

### 3. Star Scene

信纸边缘出现星光。
页面从暖色过渡到深蓝。
星点连成 `520` 或一句短告白。

这里用 Canvas。
需要支持：

- resize
- high-DPI
- reduced motion
- unmount cleanup

### 4. Star Chat

星空结束后，出现“星信”。

入口不是大聊天面板。
建议是一个轻浮层：

```text
她可以点开，也可以继续停留在星空。
```

星信支持：

- 文本对话
- 读取这封信的上下文
- 读取被允许保存的记忆
- 生成语音
- 生成图片
- 创建视频任务
- 生成音乐

### 5. Media Creation Panel

多模态入口独立于聊天输入。
避免把聊天框做得太重。

四个入口：

```text
听一听
画一张
做一段
写一首
```

对应：

- TTS
- image generation
- video generation
- music generation

## Architecture

使用 Nuxt 全栈单体。

```text
Nuxt 4
Vue 3
TypeScript
Nuxt server routes
Nitro
SQLite
MiniMax API
Tailwind CSS
Nuxt UI / shadcn-vue
VueUse Motion
Canvas
Pretext
```

Nuxt 负责：

- 页面
- 服务端 API
- runtime config
- session cookie
- MiniMax 代理
- SQLite 访问
- 部署产物

## Project Structure

```text
app.vue
pages/
  index.vue

components/
  UnlockGate.vue
  LetterScene.vue
  PretextParagraph.client.vue
  StarScene.client.vue
  StarChat.vue
  MediaCreationPanel.vue
  GeneratedAsset.vue

composables/
  useUnlock.ts
  useStarChat.ts
  useMediaTasks.ts

content/
  letter.ts
  persona.ts

server/api/
  unlock.post.ts
  chat.post.ts
  tts.post.ts
  image.post.ts
  music.post.ts
  memory.get.ts
  video/tasks.post.ts
  video/tasks/[id].get.ts

server/middleware/
  session.ts

server/services/
  minimax.ts
  memory.ts
  media-cache.ts
  session.ts

server/db/
  sqlite.ts
  schema.ts
```

## Runtime Config

MiniMax 密钥只放服务端。

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    minimaxApiKey: '',
    minimaxGroupId: '',
    unlockCode: '',
    sessionSecret: '',
    sqlitePath: '',
    public: {
      appName: '给你的信',
    },
  },
})
```

环境变量：

```text
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_GROUP_ID=
NUXT_UNLOCK_CODE=100522
NUXT_SESSION_SECRET=
NUXT_SQLITE_PATH=./data/app.sqlite
```

不要把 MiniMax API Key 放进 `public`。

## Server API

```text
POST /api/unlock
POST /api/chat
POST /api/tts
POST /api/image
POST /api/music
GET  /api/memory
POST /api/video/tasks
GET  /api/video/tasks/:id
```

### `/api/unlock`

输入：

```json
{ "code": "100522" }
```

成功：

- 写入 httpOnly cookie
- 返回 `{ "ok": true }`

失败：

- 返回 401
- 不暴露内部原因

### `/api/chat`

输入：

```json
{
  "message": "这封信是真的吗？"
}
```

服务端组装：

- persona
- 信件正文
- 最近对话
- 已保存记忆

返回：

```json
{
  "reply": "..."
}
```

随后异步做记忆提取。

### `/api/tts`

把星信回复生成音频。

输入：

```json
{
  "text": "..."
}
```

返回音频 URL 或 base64 音频数据。
如果 MiniMax 返回文件 ID，服务端负责换成可播放地址或缓存。

### `/api/image`

生成一张纪念图。

输入：

```json
{
  "prompt": "..."
}
```

服务端会加上安全的风格约束：

```text
温柔、安静、信纸、星空、浅金光、不过度梦幻
```

### `/api/video/tasks`

创建视频任务。

返回：

```json
{
  "taskId": "..."
}
```

### `/api/video/tasks/:id`

查询视频任务状态。

返回：

```json
{
  "status": "pending | processing | succeeded | failed",
  "url": "..."
}
```

### `/api/music`

生成一段短音乐。

首版只做固定风格：

```text
温柔、钢琴、轻弦乐、星空、慢速、无强鼓点
```

如果要歌词，需要单独设计文案边界。

## MiniMax Integration

MiniMax 能力按服务拆开。

```text
server/services/minimax.ts
```

职责：

- 注入 Authorization
- 读取 runtimeConfig
- 统一错误处理
- 超时控制
- 解析响应
- 隐藏上游接口细节

文本：

- 优先使用 OpenAI 兼容或 Anthropic 兼容接口。
- 系统提示词由 `content/persona.ts` 管理。

语音：

- 首版做 TTS。
- 用于播放星信回复。

图像：

- 用于生成纪念图。

视频：

- 按任务制处理。
- 不阻塞聊天。

音乐：

- 用于生成短背景音乐或纪念曲。

## Memory Design

记忆分三层。

```text
session_memory
当前会话上下文

emotion_memory
她明确表达过的情绪

preference_memory
她明确说出的偏好
```

只保存她主动表达过的内容。
不做隐性画像。
不保存敏感身份信息。
不推断恋爱状态。

记忆提取格式：

```json
{
  "shouldRemember": true,
  "type": "emotion",
  "content": "她喜欢星空部分的氛围",
  "importance": 0.7
}
```

保存前做规则过滤：

- 空内容不存
- 敏感内容不存
- 模型推断不存
- `importance < 0.5` 不存

## SQLite Schema

首版 SQLite 足够。

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE media_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  provider_task_id TEXT,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  result_url TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Security Boundaries

必须做：

- API Key 只在服务端
- `100522` 服务端校验
- httpOnly cookie
- `/api/*` 鉴权
- 请求体长度限制
- 简单速率限制
- MiniMax 错误不原样返回前端
- 禁止前端传系统提示词

不做：

- 账号系统
- 管理后台
- 多用户隔离
- 公开分享生成结果

如果页面会公开部署，建议加 Nginx 层 IP 级限流。

## UI Components

优先 Vue / Nuxt 生态。

推荐：

- Nuxt UI：基础输入、按钮、弹窗、Toast。
- shadcn-vue：需要高度定制时复制组件。
- VueUse Motion：轻量动效。
- GSAP：只在星空转场不够顺时使用。

不建议直接依赖 React 组件库。
Magic UI、React Bits 可以参考视觉，不作为 Nuxt 依赖。

## Rendering Rules

SSR 只负责稳定结构。

这些只在客户端执行：

- Canvas 星空
- Pretext 测量
- Web Audio
- 音频播放
- 动画循环

实现方式：

- `.client.vue`
- `<ClientOnly>`
- `onMounted`
- `onBeforeUnmount`

## Deployment

普通 VPS 推荐：

```text
Nginx
Node.js
Nuxt Nitro output
SQLite file
systemd
```

构建：

```bash
npm run build
```

运行：

```bash
node .output/server/index.mjs
```

Nginx：

- 静态资源走 Nuxt 输出
- `/api/*` 反代到 Nuxt
- HTTPS
- gzip / brotli
- 请求体大小限制

## Error Handling

前端文案保持温柔。

示例：

```text
星信刚刚走神了，等一下再试。
这段视频还在生成。
这首歌没有生成好，我们换一种说法。
```

后端保留真实错误日志。
前端只拿统一错误码。

## Testing

单元测试：

- 密码校验
- memory filter
- MiniMax service response parser
- media task status mapping

组件测试：

- UnlockGate
- StarChat
- MediaCreationPanel

E2E：

- 输入错误密码
- 输入 `100522`
- 进入信件
- 打开星信
- mock `/api/chat`
- 展示回复
- mock 视频任务 pending / succeeded

构建验证：

```bash
npm run test
npm run build
npx playwright test
```

## References

- MiniMax 模型介绍: https://platform.minimaxi.com/docs/guides/models-intro
- MiniMax API 概览: https://platform.minimaxi.com/docs/api-reference/api-overview
- MiniMax 文本对话: https://platform.minimaxi.com/docs/api-reference/text-chat
- MiniMax 视频生成: https://platform.minimaxi.com/docs/guides/video-generation
- Nuxt server routes: https://nuxt.com/docs/4.x/directory-structure/server
- Nuxt runtime config: https://nuxt.com/docs/4.x/api/composables/use-runtime-config
