"""Private Modal Whisper endpoint for Tacit evidence transcription.

Deploy with:
    uvx --from modal modal deploy apps/agent-runtime/modal_transcription.py

The endpoint is protected by Modal proxy authentication. Configure its generated
base URL and a scoped proxy token in the Tacit ingestion worker; do not expose
either credential to browser code.
"""

import modal


APP_NAME = "tacit-evidence-transcription"
MAX_AUDIO_BYTES = 250 * 1024 * 1024
WHISPER_MODEL = "small"

image = (
    # faster-whisper's CUDA backend needs CUDA 12 cuBLAS and cuDNN 9, neither
    # of which is present in the default Debian image.
    modal.Image.from_registry(
        "nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04",
        add_python="3.11",
    )
    .entrypoint([])
    .uv_pip_install(
        "fastapi[standard]",
        "faster-whisper==1.1.1",
        "requests>=2.32,<3",
    )
)
app = modal.App(APP_NAME)


@app.function(
    image=image,
    gpu="T4",
    timeout=300,
    scaledown_window=120,
)
@modal.asgi_app(requires_proxy_auth=True)
def transcription_api():
    """Return a small private API which receives scan-cleared audio bytes."""
    import asyncio
    import tempfile
    from pathlib import Path

    from fastapi import FastAPI, HTTPException, Request
    from faster_whisper import WhisperModel

    model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
    web_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @web_app.post("/transcribe")
    async def transcribe(request: Request) -> dict[str, str]:
        audio = await request.body()
        if not audio:
            raise HTTPException(status_code=400, detail="An audio payload is required.")
        if len(audio) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio exceeds the configured limit.")

        def run() -> str:
            with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as output:
                output.write(audio)
                path = Path(output.name)
            try:
                segments, _ = model.transcribe(str(path), beam_size=5, vad_filter=True)
                return " ".join(segment.text.strip() for segment in segments).strip()
            finally:
                path.unlink(missing_ok=True)

        return {"text": await asyncio.to_thread(run)}

    return web_app
