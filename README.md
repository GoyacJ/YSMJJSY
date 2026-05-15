# 给你的信

520 告白项目。Nuxt 负责页面和服务端 API。

浏览器只渲染交互和视觉效果。MiniMax 调用、解锁校验、会话 Cookie、SQLite、记忆筛选都在服务端。

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
