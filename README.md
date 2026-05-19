# 星信

私人星球智能体。每把钥匙对应一个星球，承载聊天、记忆、作品、边界和记录。

Nuxt 负责页面和服务端 API。浏览器只渲染交互和视觉效果。MiniMax 调用、解锁校验、会话 Cookie、SQLite、记忆筛选和智能体执行边界都在服务端。

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认解锁码是 `100522`。

## 环境变量

```text
NUXT_MINIMAX_API_KEY=
NUXT_MINIMAX_GROUP_ID=
NUXT_UNLOCK_CODE=100522
NUXT_SESSION_SECRET=change-me
NUXT_SQLITE_PATH=./data/app.sqlite
```

`NUXT_MINIMAX_API_KEY` 只在服务端读取。不要放到浏览器代码里。

`NUXT_SESSION_SECRET` 生产环境必须改成随机长字符串。

## 常用命令

```bash
npm run test
npm run build
npm run preview
npm run test:e2e
```

## 生产运行

```bash
npm run build
node .output/server/index.mjs
```

服务器部署见 [docs/deployment.md](docs/deployment.md)。

## Agent OS 开发说明

每把钥匙通过 binding 拥有一个 `star` domain agent。业务仍以 key 为入口，Agent OS 负责统一任务、收件箱、审计事件和工具执行边界。

AgentLoop 负责任务规划、策略控制的工具执行、审批恢复和运行中任务恢复。业务路由保持 key 级隔离，高风险变更进入 Agent task/tool 流程。

`/api/agents/current/*` 和 `/api/agent/*` 都要求当前 session。公开宇宙只读取显式公开的星星和作品摘要，不返回私密 payload、原始模型响应、session、hash 或完整对话。
