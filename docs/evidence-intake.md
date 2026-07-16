# Evidence intake

Production evidence is uploaded directly to the private `tacit-artifacts` bucket with a short-lived signed upload URL. The web API records a tenant-owned source artifact first, then verifies the completed object’s SHA-256 digest and file signature before creating an ingestion job.

Supported inputs are SOPs and documents (PDF, DOCX, TXT, MD), spreadsheets (CSV/XLSX), images (PNG, JPG, WebP), audio (MP3, M4A, WAV, WebM), and review video (MP4, MOV, WebM). Limits are enforced server-side: 50 MB for documents/spreadsheets, 25 MB for images, 250 MB for audio, and 500 MB for video.

The upload form requires explicit permission and processing consent. Source artifacts have a configured retention deadline (one year by default); deleting an artifact deletes the private object and cascades its normalized evidence. Evidence extraction records store source artifact version, confidence, and page or timestamp ranges so future workflow claims can cite durable material.

Ingestion jobs are deliberately scan-gated: the separately deployed `ingestion-worker` service claims jobs atomically, streams the source through ClamAV, then runs text/PDF/DOCX/CSV/XLSX extraction, Tesseract OCR, FFmpeg frame sampling, and configured audio transcription. The local deployment topology in `docker-compose.yml` includes the worker and `clamav` service. Set `EVIDENCE_TRANSCRIPTION_MODEL` to an environment-approved transcription model and provide `OPENAI_API_KEY` only to the worker for audio/video transcription. Scanner or transcription failure is retryable up to five times, and no uploaded binary is sent to workflow reconstruction directly.
