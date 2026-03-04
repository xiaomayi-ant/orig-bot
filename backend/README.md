# Smart Agent Backend

FastAPI + LangGraph 后端服务，负责会话流式输出、工具编排和线程持久化。

## Tech Stack

- FastAPI / Uvicorn
- LangChain / LangGraph
- PostgreSQL（线程与 checkpoint）
- MySQL（SQL 工具）
- Milvus（向量检索，可选）
- Neo4j（KG 工具，可选）

## Quick Start

### 1. Install (uv)

```bash
cd backend
uv sync
```

### 2. Configure Env

```bash
cp env.example .env
```

建议至少配置：

| Category | Required Keys |
| --- | --- |
| LLM | `LLM_PROVIDER` + 对应 API Key |
| Auth | `JWT_SECRET` |
| PostgreSQL | `PG_DSN` |
| MySQL | `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` |

可选能力：

- 向量检索：`MILVUS_ADDRESS` 及 embedding 配置
- KG：`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
- ASR：`ENABLE_VOICE` 与相关 provider key

### 3. Run

```bash
uv run uvicorn src.api.server:app --host 0.0.0.0 --port 3001 --reload
```

或：

```bash
uv run python main.py
```

## Key Endpoints

- `POST /api/threads`
- `POST /api/threads/{thread_id}/runs/stream`
- `GET /api/threads/{thread_id}/messages`
- `DELETE /api/threads/{thread_id}`
- `POST /api/threads/{thread_id}/tools/approval`
- `GET /health`
- `GET /docs`

## Notes

- `PG_DSN` 缺失时会退回部分内存行为，但完整线程持久化不可用。
- 如果未执行前端 Prisma 迁移，后端线程表校验会失败。

## License

MIT
