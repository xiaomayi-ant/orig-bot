# Smart Agent Frontend

Next.js (App Router) + Prisma 前端，提供聊天界面、会话管理与后端 API 代理。

## Tech Stack

- Next.js 15
- React 19
- Prisma Client
- assistant-ui

## Quick Start

### 1. Install

```bash
cd frontend
pnpm install
```

### 2. Configure Env

```bash
cp env.example .env
```

关键配置：

| Key | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | 部署前缀路径（例如 `/smart-bot`） |
| `NEXT_BASE_PATH` | 服务端路由解析使用的前缀（通常与 `NEXT_PUBLIC_BASE_PATH` 一致） |
| `DATABASE_URL` | Prisma 连接 PostgreSQL |
| `LANGGRAPH_API_URL` | 前端服务端路由转发到后端 |
| `JWT_SECRET` | 会话签名，与后端保持一致 |
| `NEXT_PUBLIC_BACKEND_BASE_URL` | 浏览器侧调用后端时的基础地址 |

### 3. Prisma Migration

```bash
pnpm prisma migrate deploy
```

### 4. Run

```bash
pnpm dev
```

默认地址：`http://localhost:3000`

## Build & Start

```bash
pnpm build
pnpm start
```

## Notes

- 若 `LANGGRAPH_API_URL` 未配置，聊天流式路由会直接报错。
- 若 `DATABASE_URL` 不可用，涉及会话/消息持久化的 API 会失败。

## License

MIT
