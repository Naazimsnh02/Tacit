# Production contract and demo isolation

Tacit has two explicit modes:

- **Production** requires Supabase authentication and an organization membership. Production projects, audit events, and future artifacts are tenant-scoped.
- **Demo** is a synthetic, read-only invoice project in the dedicated `tacit-demo` organization. It is enabled only when `NEXT_PUBLIC_DEMO_MODE_ENABLED` is not `false` and is accessed at `/demo`.

`npm run demo:reset` deletes and reseeds only the fixed demo project while requiring `mode=demo`; it cannot target production projects. Demo data must never become a fallback for a failed production request.

## v1 safety boundary

Tacit v1 prepares and recommends workflow decisions. It does not perform financial payments or any other high-risk external action autonomously. Such actions require a scoped connector, an approval policy, and an authenticated, auditable authorization decision; connectors are outside this milestone.

## Evidence intake contract (implemented in Phase 2)

The planned private `tacit-artifacts` bucket reserves paths as `<organization-id>/<project-id>/<artifact-id>`. Phase 2 will accept SOPs and related documents (PDF, DOCX, CSV/XLSX, TXT/Markdown, and images), audio, and video after MIME, extension, checksum, filename, and ownership validation. Initial limits are 25 MB per document/image, 500 MB per audio/video file, and 2 GB per project upload batch. Uploads will require explicit processing consent, have configurable retention, and support deletion; no direct browser upload path exists yet.

## Codex build contract (implemented in Phase 4)

Production compilation requires `OPENAI_CODEX_MODEL`. Tacit sends Codex only an SME-confirmed, typed workflow specification; raw uploads and video are excluded. Each build records immutable source, prompts, dependency lock, model metadata, static-analysis output, generated-test output, and attempt history in the tenant-scoped artifact bucket. A failed test or static gate receives one repair attempt, then produces a repair proposal without changing the confirmed workflow. A passing build remains promotion-pending until an authorized member explicitly promotes it.

## Operations ownership

Staging and production use separate Supabase projects and separate environment secrets. Only server-side services receive `SUPABASE_SERVICE_ROLE_KEY` and OpenAI keys; browser code receives only Supabase URL and publishable/anon key. The service owner is responsible for backup verification, secret rotation, and error-reporting configuration before production launch.
