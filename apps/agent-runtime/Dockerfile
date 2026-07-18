FROM docker:27-cli AS docker_cli

FROM python:3.11-slim
WORKDIR /app
# Debian trixie's docker.io package provides dockerd but not the docker client.
# The runtime only needs the client to launch its one-shot sandbox containers
# through the explicitly mounted development Docker socket.
COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs npm tesseract-ocr && rm -rf /var/lib/apt/lists/*
RUN docker --version
RUN npm install -g @openai/codex
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
