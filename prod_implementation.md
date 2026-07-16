# Tacit Production Implementation Plan

## Purpose

Tacit is moving from a seeded hackathon demonstration to a launchable, supervised workflow-learning and agent-compilation product. The current invoice exception demo remains a reliable, isolated fallback; it must not be the hidden data or execution path for real customer projects.

The product loop remains:

```text
Ingest evidence -> Observe -> Extract -> Clarify -> Compile -> Test -> Repair -> Verify
```

The first production vertical is **Invoice Exception Review**. The platform continues to be domain-agnostic: all domain-specific inputs, policies, connectors, rules, prompts, evaluation logic, and UI remain workflow-pack code.

## Current Baseline

The repository already provides a useful production foundation:

- Generic schemas, versioning, evidence references, clarifications, approvals, audit-oriented persistence, historical replay, and a workflow-pack registry.
- Invoice Exception and a minimal sample-support pack, proving core services can resolve workflow behavior through the registry.
- A Supabase-backed seed path, OpenAI Responses-based workflow reconstruction, generated-artifact records, streamed build progress, and a Python runtime with AST validation and timeouts.

The following are demo-only or incomplete and must be replaced before launch:

- The observation screen only accepts the seeded project and fixed evidence.
- There is no user project creation, authentication, organization membership, role-based access, or production RLS policy model.
- There is no file/video upload, object-storage pipeline, OCR, transcription, evidence extraction, retention/deletion workflow, or consent capture.
- The current compiler packages templates; it does not call Codex to generate a project-specific executable agent.
- Generated artifacts are written to local disk, and the runtime invokes a host subprocess. Neither is a production artifact store or sandbox.
- There is no durable job queue, worker orchestration, monitoring, or deployment readiness layer.

## Product Boundaries

### Production mode

Production projects must use authenticated APIs, durable storage, extracted evidence, confirmed workflow versions, queued builds, isolated execution, and auditable human approvals. Do not silently substitute fixtures or seeded model results for a production request.

### Demo mode

Keep the present guided invoice flow as a dedicated, read-only demo tenant or project template behind an explicit `demo_mode` feature flag. Its fixtures, reset action, deterministic fallbacks, and metrics must be namespaced away from customer data. Demo reset must never delete or modify a production project.

### Safety boundary

Version zero of production supports preparation, recommendation, and human-approved actions. It must not perform financial payments or other high-risk side effects autonomously. Every external action requires a scoped connector, an approval policy, and an auditable authorization decision.

## Target Architecture

```text
Next.js application and authenticated APIs
        |
Supabase Auth + Postgres/RLS + Storage
        |
Job queue and worker services
  |- ingestion: validation, OCR, transcription, frame sampling
  |- intelligence: evidence normalization and workflow reconstruction
  |- compilation: Codex build workspace, tests, provenance
  `- execution: isolated container or microVM runtime
        |
Workflow-pack registry
  |- Invoice Exception Review
  `- Future workflow packs
```

Use Supabase as the system of record for users, organizations, projects, workflow state, audit records, metadata, and object references. Store binary uploads and immutable build artifacts in object storage, not the web process filesystem. Use a queue for all work that may exceed a web request lifecycle.

## Delivery Roadmap

### Phase 0 - Product contract and demo isolation

1. Add an explicit production/demo mode model and feature flags.
2. Put seeded records in a dedicated demo organization/project template.
3. Document supported file types, size limits, retention, consent, and the v1 automation boundary.
4. Establish staging, production environment separation, secrets management, error reporting, and backup ownership.

**Exit criteria:** a demo reset cannot affect production data, and every UI surface clearly identifies its mode.

### Phase 1 - Identity, organizations, projects, and access control

1. Add Supabase Auth and organization, membership, role, and project ownership models.
2. Implement authenticated project create/list/read/update APIs and UI.
3. Apply and test RLS for every tenant-owned table and Storage bucket.
4. Record authenticated actors in approvals, workflow changes, and builds.
5. Add API validation, rate limits, idempotency keys, and audit events.

**Exit criteria:** two organizations cannot read, write, list, or sign URLs for each other's projects or artifacts.

### Phase 2 - SOP, document, and video evidence intake

1. Implement direct-to-storage signed uploads for SOPs, PDFs, DOCX, CSV/XLSX, images, audio, and video.
2. Validate MIME type, extension, file size, checksums, and ownership before queuing processing. Sanitize filenames and scan uploads before use.
3. Add ingestion workers for text extraction, OCR, audio/video transcription, frame sampling, and spreadsheet normalization.
4. Persist normalized evidence with page/time ranges, source artifact version, extraction confidence, and searchable citations.
5. Add upload progress, retryable errors, deletion, retention, and explicit recording/processing consent states.

**Exit criteria:** a signed-in user can create a project, upload an SOP and a review video, and inspect timestamp/page-cited extracted evidence.

### Phase 3 - Production observation and workflow intelligence

1. Make the observation shell project- and workflow-pack-driven rather than seeded-project-driven.
2. Support evidence-linked manual steps, narration, transcript selection, and optional imported browser events. Defer general desktop capture.
3. Reconstruct draft workflows from extracted evidence using structured model outputs, citations, prompt/model versions, retry rules, and recoverable failures.
4. Require an SME to confirm rules, contradictions, automation boundaries, and approval policies before compilation.
5. Build evaluation datasets from labelled historical cases and corrections.

**Exit criteria:** every workflow claim is traceable to stored evidence and no unconfirmed rule can enter a build.

### Phase 4 - Real Codex compilation and repair

1. Define a stable, typed workflow intermediate representation that is the only compiler input; do not send raw customer videos directly to code generation.
2. Run Codex in a dedicated, scoped build workspace to generate adapters, deterministic decision code, tests, manifests, and provenance.
3. Persist immutable source, dependency lock, prompts, model/build metadata, logs, and test outputs in object storage and the database.
4. Stream queued job progress to the UI. A failed build creates a repair proposal or clarification; it never mutates a confirmed workflow silently.
5. Require static analysis, dependency allowlists, generated-test execution, and an explicit promotion decision before a build is usable.

**Exit criteria:** a confirmed customer workflow produces a project-specific, tested build with complete provenance and no seeded agent template.

### Phase 5 - Isolated execution and supervised connectors

1. Replace host subprocess execution with ephemeral Docker containers or microVMs.
2. Enforce read-only build artifacts, no host filesystem, default-deny network egress, CPU/memory/disk/process limits, wall-clock timeout, and output caps.
3. Keep AST validation and import allowlists as defence in depth, not as the sandbox itself.
4. Start with imported CSV or a single approval-gated connector. Add OAuth, scoped credentials, connector health, and action audit trails before any side-effecting integration.
5. Keep invoice decisions in prepare/recommend mode until a human explicitly approves the resulting external action.

**Exit criteria:** malicious generated code cannot access host resources, network services, unrelated artifacts, or production secrets.

### Phase 6 - Invoice pilot and launch readiness

1. Deliver real document intake, matching, decision recommendations, evidence trails, historical replay, and human approval for Invoice Exception Review.
2. Add pilot onboarding, support diagnostics, usage limits, monitoring, alerting, backups, incident response, privacy terms, and data deletion.
3. Expand automated coverage: tenant isolation, uploads, workers, model output validation, build security, sandbox escape attempts, replay, approvals, and end-to-end production journeys.
4. Launch as a supervised pilot with measured accuracy, review rate, and error budgets before enabling broader customer access.

**Exit criteria:** pilot customers can complete the full evidence-to-approved recommendation loop with operational support and no demo dependency.

## First Implementation Milestone

Build this vertical slice before adding connectors or autonomous actions:

> A signed-in user creates a project, uploads an SOP and review video, receives evidence-backed workflow extraction, edits and confirms the workflow, and retains an immutable evidence trail.

It replaces the static product entry point while preserving the existing demo path as a dependable sales and development fallback.

## Required Quality Gates

- Database migrations and RLS tests pass against a real Supabase environment.
- Every upload is authorized, validated, scanned, traceable, and deletable.
- Every AI output validates against a schema and cites durable evidence.
- Builds and executions run only in isolated workers with no production secret access beyond explicitly scoped connector credentials.
- Generated code must pass security, test, and replay gates before promotion.
- Production dashboards distinguish observed values from estimates.
- Demo mode remains tested independently and cannot access production data.
