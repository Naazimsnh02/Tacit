from fastapi import FastAPI

app = FastAPI(title="Tacit Agent Runtime")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "agent-runtime", "status": "ok"}
