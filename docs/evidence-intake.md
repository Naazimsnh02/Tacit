# Evidence intake

Production evidence is uploaded directly to the private `tacit-artifacts` bucket with a short-lived signed upload URL. The web API records a tenant-owned source artifact first, then verifies the completed object’s SHA-256 digest and file signature before creating an ingestion job.

Supported inputs are SOPs and documents (PDF, DOC/DOCX, TXT, MD), spreadsheets (CSV/XLSX), images (PNG, JPG, WebP), audio (MP3, M4A, WAV, WebM), and review video (MP4, MOV, WebM). Limits are enforced server-side: 50 MB for documents/spreadsheets, 25 MB for images, 250 MB for audio, and 500 MB for video.

The upload form requires explicit permission and processing consent. Source artifacts have a configured retention deadline (one year by default); deleting an artifact deletes the private object and cascades its normalized evidence. Evidence extraction records store source artifact version, confidence, and page or timestamp ranges so future workflow claims can cite durable material.

Ingestion jobs are deliberately scan-gated: a worker must mark the source clean before it calls text/DOCX/PDF extraction, OCR, transcription, frame sampling, or spreadsheet normalization adapters. The generic worker contract is in `apps/web/src/lib/evidence/ingestion.ts`; production deployment must supply those scanner and media-processing adapters outside the web process. No uploaded binary is sent to workflow reconstruction directly.
