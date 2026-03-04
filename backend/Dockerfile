FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# System deps for building and audio processing (whisper), keep minimal
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    ffmpeg \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Install runtime dependencies from uv lockfile for reproducible builds.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy app source after dependency layer for better cache hit rate.
COPY src ./src
COPY main.py ./main.py

ENV PATH="/app/.venv/bin:${PATH}"

EXPOSE 3001

# Use the project entry which configures uvicorn and debug flags
CMD ["python", "main.py"]

