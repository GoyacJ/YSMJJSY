# Nuxt 部署说明

## 运行环境

- Node.js 22 或更高版本。
- 一台 VPS。
- Nginx 做反向代理。
- HTTPS 证书。
- SQLite 数据文件可写。

## 构建

```bash
npm install
cp .env.example .env
npm run build
```

生产启动：

```bash
node .output/server/index.mjs
```

建议用 `systemd` 或进程管理工具守护这个命令。

## 环境变量

生产环境至少设置：

```text
NUXT_MINIMAX_API_KEY=你的 MiniMax API Key
NUXT_MINIMAX_GROUP_ID=你的 MiniMax Group ID
NUXT_UNLOCK_CODE=100522
NUXT_SESSION_SECRET=改成随机长字符串
NUXT_SQLITE_PATH=/var/lib/ysmjjsy/app.sqlite
```

API Key 只放在服务器环境变量里。不要写进前端文件、静态资源或仓库。

## Agent OS 部署边界

Agent OS 和业务 API 运行在同一个 Nuxt 服务进程里。当前版本没有独立 worker 或外部队列。

`/api/agents/current/*` 和 `/api/agent/*` 依赖 session cookie。反向代理必须透传 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`。

公开宇宙接口只返回显式公开的星星和作品摘要。SQLite 里的私密 payload、模型原始响应、session、hash 和完整对话不能通过公开接口暴露。

## SQLite

创建数据目录：

```bash
sudo mkdir -p /var/lib/ysmjjsy
sudo chown -R $USER:$USER /var/lib/ysmjjsy
```

备份重点是：

```text
/var/lib/ysmjjsy/app.sqlite
```

建议每天备份一次。部署新版本前也备份一次。

## Nginx

示例：

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

HTTPS 用 Certbot 或云厂商证书配置。证书完成后，把 HTTP 请求重定向到 HTTPS。

## systemd 示例

```ini
[Unit]
Description=YSMJJSY Nuxt app
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/ysmjjsy
Environment=NODE_ENV=production
Environment=NUXT_MINIMAX_API_KEY=你的 MiniMax API Key
Environment=NUXT_MINIMAX_GROUP_ID=你的 MiniMax Group ID
Environment=NUXT_UNLOCK_CODE=100522
Environment=NUXT_SESSION_SECRET=改成随机长字符串
Environment=NUXT_SQLITE_PATH=/var/lib/ysmjjsy/app.sqlite
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## 验证

```bash
npm run build
node .output/server/index.mjs
```

访问域名后，输入 `100522`。确认能进入信件页面和星空页面。
