# Isolated generated-agent execution

Phase 5 runs generated Python only in a short-lived Docker container. The runtime keeps AST validation and import allowlists as a defence-in-depth gate, then mounts exactly one build directory at `/workspace` as read-only.

The container has no network, receives no host environment or credentials, runs as an unprivileged user, has a read-only root filesystem, and is limited to 256 MiB RAM, 0.5 CPU, 64 processes, a 16 MiB temporary filesystem, a wall-clock timeout, and 64 KiB combined stdout/stderr. Exceeding the timeout or output cap stops the named ephemeral container.

Build the sandbox image before starting the runtime:

```bash
docker build -f apps/agent-runtime/Dockerfile.sandbox -t tacit-agent-sandbox:latest apps/agent-runtime
```

Set `AGENT_SANDBOX_IMAGE` to a pinned image digest in deployed environments. The runtime worker needs access to a dedicated container executor; it must not share a Docker daemon or its socket with the web application. A production executor should be an isolated worker or microVM with the same default-deny network and resource policy.

The development Compose configuration grants the runtime service (and only that service) access to the Docker socket so it can create the one-shot sandbox containers. It is a development convenience, not a deployment topology for a shared production host.

Tacit Phase 5 supports imported CSV evidence only. It is read-only input, not an external side-effecting connector. Existing approval requests and approval actions remain the required audit trail for any future connector action; no financial or other external action is dispatched by this runtime.
