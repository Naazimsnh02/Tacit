# Tacit

<p align="center">
  <strong>Knowledge transfer for AI agents - from expert sources to supervised, testable automation.</strong>
</p>

<p align="center">
  Tacit turns how work is actually done into an evidence-backed workflow and a reviewable agent.
  Upload SOPs, records, spreadsheets, images, audio, and walkthroughs. Tacit understands the process,
  asks only what it still cannot resolve safely, and compiles a confirmed policy into a supervised agent.
</p>

<p align="center">
  <a href="#how-tacit-works">How it works</a> •
  <a href="#product-capabilities">Capabilities</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="#hackathon-submission">Hackathon</a>
</p>

<p align="center">
  <img alt="OpenAI Build Week" src="https://img.shields.io/badge/OpenAI-Build%20Week-111827?logo=openai&logoColor=white">
  <img alt="Track" src="https://img.shields.io/badge/Track-Work%20%26%20Productivity-2563EB">
  <img alt="OpenAI Responses API" src="https://img.shields.io/badge/OpenAI-Responses%20API-412991?logo=openai&logoColor=white">
  <img alt="Codex" src="https://img.shields.io/badge/Built%20with-Codex-0F172A">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-TypeScript-black?logo=next.js">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Storage-3ECF8E?logo=supabase&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## The problem

Most operational knowledge never fully lands in a document. The rules that matter live in expert judgment: when to trust a source, allow a variance, escalate a conflict, or stop for approval.

Traditional automation assumes a complete, clean SOP. Teams are left with long discovery cycles, brittle rules, weak audit trails, and agents that cannot explain why they acted.

Tacit treats this as a **knowledge transfer** problem. Experts hand over materials and context the way they would brief a new teammate. Tacit reconstructs a cited workflow from that handoff, surfaces contradictions and unknowns, and keeps every claim tied to durable evidence so the result is inspectable, testable, and safe to operate under supervision.

## How Tacit works

The product path is AI-first. Sources drive understanding; experts confirm policy; compilation and execution stay gated.

```text
Source → Understand → Clarify → Review → Build → Test → Approve → Operate
```

| Stage | What happens |
| --- | --- |
| **Source** | Upload process materials: SOPs, documents, spreadsheets, images, audio, and video. Files are checksum-verified, scan-gated, extracted, and retained with provenance. |
| **Understand** | One action treats ready sources as a completed knowledge-transfer package. Tacit builds source intelligence (classifications, entities, facts, relationships), creates a system observation, and reconstructs a cited first workflow draft. |
| **Clarify** | Ranked questions resolve only the decisions that still matter: policy ambiguity, risk, missing evidence, and automation boundaries. Answers create a new workflow version. |
| **Review** | Inspect the workflow graph, claim evidence states, branches, and approval requirements. Natural-language change requests become structured proposals that must be accepted before they apply. |
| **Build** | After confirmation, Codex compiles deterministic decision code and focused tests from the typed workflow specification only, never from raw, unreviewed uploads. |
| **Test** | Replay historical cases and source-derived edge cases. Failures receive explanations and bounded repair proposals that still require human acceptance. |
| **Approve** | Deployment readiness recommends observe-only, recommend, execute-with-approval, or low-risk automatic mode. Promotion is explicit. |
| **Operate** | Capture supervised outcomes and overrides as operating evidence. Feedback cannot silently rewrite a promoted build. |

Advanced live expert capture remains available when the automatic path still needs unwritten context.

## Product capabilities

| Capability | Outcome |
| --- | --- |
| Knowledge transfer to AI | Experts hand over process knowledge the way they would to a human; Tacit turns that package into a workflow draft. |
| Automated process understanding | Ready sources become a cited first workflow without manual step-by-step entry. |
| Multimodal source intelligence | Classifications, summaries, entities, facts, and cross-source relationships are stored with extraction citations. |
| Evidence-backed discovery | Every inferred rule, exception, contradiction, and recommendation points back to durable source segments. |
| Expert clarification | Priority questions, assignees, and deferrals resolve only the ambiguities that affect safety. |
| Conversational workflow edits | Plain-language change requests produce typed patches, risk notes, and new versions on accept. |
| Tested agent builds | Generated code is tied to a typed IR, provenance, static analysis, tests, and promotion state. |
| Historical and source-derived testing | Teams compare recommendations with labelled prior cases and boundary scenarios before relying on a build. |
| Deployment readiness | Mode recommendations factor confirmed rules, open contradictions, and replay performance. |
| Supervised operation | High-risk and ambiguous outcomes stop for human review; operating notes stay separate from promoted builds. |
| Audit and impact | Projects retain approvals, build activity, evidence trails, and measured workflow outcomes. |

## Domain-agnostic by design

The **platform core is process-agnostic**. Organizations, projects, evidence, insights, observations, workflow versions, claims, change proposals, builds, evaluations, readiness, operating feedback, approvals, and audit records are shared abstractions. Nothing in those contracts assumes a single business domain.

Domain behaviour such as input shapes, sample policies, evaluation fixtures, and pack-level configuration lives in registered workflow modules. That keeps the AI-first loop reusable across operational processes such as exception review, quality complaints, support triage, or any other expert-driven workflow a team can document and walk through.

<p align="center">
  <img src="apps/web/public/images/ap-reviewer-observation.png" alt="Tacit knowledge transfer and review workspace" width="900">
</p>

## Architecture

```text
                              Tacit Web Application
     Sources | Understand | Clarify | Review | Build | Test | Approve | Operate
                                           |
              Supabase Auth + Postgres/RLS + private object storage
                                           |
          +----------------+---------------+----------------+
          |                |                                |
   Evidence ingestion   Workflow intelligence          Agent runtime
   scan / extract /     automatic understanding,       AST validation +
   OCR / transcription  source intelligence,           isolated Docker execution
   multimodal frames    clarification, proposals
          |                |                                |
          +----------------+---------------+----------------+
                                           |
                              Workflow-pack registry
                         (domain packs load through a registry)
```

```text
apps/web                   Next.js application, APIs, and product UI
apps/agent-runtime         FastAPI runtime, ingestion, and source-intelligence workers
packages/core-schemas      Shared domain-agnostic schemas
packages/prompts           Shared prompt construction
packages/workflow-sdk      Workflow-pack authoring utilities
packages/workflow-registry Pack discovery and loading
packages/workflows/        Domain workflow packs
supabase/migrations        Database, RLS, Storage, and audit migrations
generated/                 Local build workspaces only
```

### Workspace navigation

| Stage | Purpose |
| --- | --- |
| **Sources** | Knowledge transfer intake: upload materials, track processing, start automatic understanding. |
| **Understand** | View source intelligence, connected sources, and the draft process. |
| **Clarify** | Answer ranked expert questions with citation context. |
| **Review** | Inspect the graph, claim evidence states, and conversational edit proposals. |
| **Build** | Compile a confirmed workflow into a versioned agent build. |
| **Test** | Run replay and source-derived test plans; stage repairs. |
| **Approve** | Human approval queue and promotion gates. |
| **Operate** | Deployment readiness and supervised operating feedback. |

## Intelligence, compilation, and trust

Tacit uses the **OpenAI Responses API** for work that benefits from reasoning: reconstructing workflows across sources, identifying contradictions, ranking clarification questions, drafting versioned workflow patches, explaining failures, and producing constrained agent code. Model IDs are configured through the environment rather than hard-coded into product logic.

For the hackathon deployment, model calls can alternatively run through a dedicated `codex_subscription` runner. The runner owns a ChatGPT/Codex device-code login and a persistent credential volume; the browser and Next.js application never receive OAuth tokens. This is an operator integration for the build-week environment, not a multi-tenant billing path.

**Deterministic code** handles thresholds, comparisons, validation, matching, and state transitions. **AI output** is schema-validated before application logic can use it. Automatic understanding treats ready extractions as a completed knowledge-transfer package, creates a durable system observation, then runs the same reconstruction path used for expert-linked sessions. Codex only receives an SME-confirmed typed workflow specification, not raw customer recordings or unreviewed documents.

Before a generated build is usable, Tacit records its source, prompts, dependency lock, model metadata, static-analysis result, generated-test result, repair attempts, and promotion state. The runtime validates Python ASTs and import allowlists, then runs code in a short-lived Docker container with a read-only filesystem, default-deny network access, dropped capabilities, an unprivileged user, and bounded resources.

Tacit produces recommendations and prepares work. It does not release payments or perform other high-risk external actions autonomously. Those actions require scoped connectors, an approval policy, and an authenticated, auditable human decision.

## Technology stack

| Area | Technologies |
| --- | --- |
| Product UI | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, React Flow |
| Application APIs | Next.js route handlers, Zod, Server-Sent Events |
| Runtime and workers | FastAPI, Python, Pydantic, pytest, Docker |
| Data and tenancy | Supabase Auth, PostgreSQL, Row Level Security, private Storage |
| AI | OpenAI Responses API and Codex, with environment-configured model IDs |
| Quality | Vitest, Playwright, pytest, Ruff, TypeScript, ESLint |

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Docker Desktop
- A Supabase project with Auth, Postgres, and Storage
- Either OpenAI API credentials and approved model IDs, or a dedicated ChatGPT/Codex subscription account for the private runner

### Install dependencies

```bash
npm install
python -m pip install -e apps/agent-runtime
python -m pip install ruff
```

### Configure the environment

Copy both templates and provide values for your environment:

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

Configure the following values as applicable. The repository-root `.env` is read by Docker Compose and the Python workers. `apps/web/.env.local` is read only when `npm run dev` starts Next.js outside Docker; for `LLM_BACKEND=codex_subscription`, keep the runner URL, secret, and model identical in both files.

```dotenv
OPENAI_API_KEY=
OPENAI_REASONING_MODEL=
OPENAI_DEFAULT_MODEL=
OPENAI_FAST_MODEL=
OPENAI_CODEX_MODEL=
LLM_BACKEND=openai_api
CODEX_SUBSCRIPTION_RUNNER_URL=http://localhost:8100
CODEX_SUBSCRIPTION_RUNNER_SECRET=
CODEX_SUBSCRIPTION_MODEL=
CODEX_SUBSCRIPTION_MAX_IMAGES=8
CODEX_SUBSCRIPTION_MAX_IMAGE_PAYLOAD_BYTES=12000000
EVIDENCE_TRANSCRIPTION_MODEL=
EVIDENCE_TRANSCRIPTION_PROVIDER=openai
EVIDENCE_MODAL_TRANSCRIPTION_URL=
EVIDENCE_MODAL_PROXY_AUTH_KEY=
EVIDENCE_MODAL_PROXY_AUTH_SECRET=
EVIDENCE_VISION_MODEL=
EVIDENCE_VISION_DETAIL=high
EVIDENCE_VIDEO_COVERAGE_SECONDS=15
EVIDENCE_VIDEO_MAX_FRAMES=60
EVIDENCE_VIDEO_SCENE_THRESHOLD=0.2

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AGENT_RUNTIME_URL=http://localhost:8000
AGENT_EXECUTION_TIMEOUT_SECONDS=10
AGENT_SANDBOX_IMAGE=tacit-agent-sandbox:latest
PILOT_MAX_ACTIVE_PROJECTS_PER_ORGANIZATION=5
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and OpenAI keys server-side only.

### Codex subscription runner

Set the following in the root `.env` and `apps/web/.env.local` when running the web app outside Docker:

```dotenv
LLM_BACKEND=codex_subscription
CODEX_SUBSCRIPTION_RUNNER_URL=http://localhost:8100
CODEX_SUBSCRIPTION_RUNNER_SECRET=<at-least-32-random-characters>
CODEX_SUBSCRIPTION_MODEL=gpt-5.6-terra
```

For a Docker Compose web container, the runner URL is automatically changed to the private `http://codex-runner:8100` service. Do not change the root `.env` URL for that case.

Start the private runner and complete the one-time device-code login:

```bash
docker compose up -d codex-runner
docker compose exec codex-runner python -m app.codex_login
```

Open the printed URL, enter the printed code, and sign in with the dedicated ChatGPT account. Docker persists the runner login only in the `codex-subscription-auth` volume. Keep the runner off the public network, do not copy its `CODEX_HOME`, and give the same runner secret to the web service only.

The subscription runner handles workflow reconstruction, agent compilation, and multimodal source intelligence. With `LLM_BACKEND=codex_subscription`, the source-intelligence worker sends only scan-cleared image bytes and sampled video frames through the private secret-authenticated runner; the runner writes short-lived local image files and sends them to Codex as `localImage` input items. No signed Storage URL, service credential, or ChatGPT token crosses that boundary. The runner verifies that the configured subscription model advertises image input and fails closed if it does not; app-server has no documented per-image detail control, so low-confidence escalation repeats the pixel pass with an explicit higher-detail instruction.

`OPENAI_API_KEY` is not required for Codex subscription LLM work. It is required only for `LLM_BACKEND=openai_api`, for `EVIDENCE_TRANSCRIPTION_PROVIDER=openai` (or its audio/video override), or when an operator explicitly sets `EVIDENCE_SOURCE_INTELLIGENCE_BACKEND=openai_api` for a hybrid source-intelligence path. Transcription remains independent of `LLM_BACKEND`.

### Prepare Supabase and the local sandbox

Apply the ordered SQL files in `supabase/migrations/` through the approved Supabase migration workflow for the target environment. Then build the sandbox image used by the local agent runtime:

```bash
docker build -f apps/agent-runtime/Dockerfile.sandbox -t tacit-agent-sandbox:latest apps/agent-runtime
```

### Run the complete Docker stack

The sandbox image must exist before starting Compose because the agent runtime launches it for isolated generated-code tests. Then start the web app, runtime, Codex runner, ingestion worker, source-intelligence worker, and ClamAV together:

```bash
docker build -f apps/agent-runtime/Dockerfile.sandbox -t tacit-agent-sandbox:latest apps/agent-runtime
docker compose up --build -d
docker compose logs -f web codex-runner agent-runtime ingestion-worker source-intelligence-worker
```

For the Codex subscription backend, perform the device login once after the runner is healthy:

```bash
docker compose exec codex-runner python -m app.codex_login
```

Stop the local stack while preserving the Codex login volume:

```bash
docker compose down
```

Open http://localhost:3000 and go to `/projects` to sign in and start an authenticated project.

### Run services locally (without Compose)

Start the web app:

```bash
npm run dev
```

In another terminal, start the runtime:

```bash
npm run runtime:dev
```

Start the private runner, scanner, and workers in other terminals when you need upload processing and source understanding. The first command exposes the runner on `localhost:8100`; the worker commands must run from `apps/agent-runtime` after installing its Python dependencies:

```bash
docker compose up -d codex-runner clamav
cd apps/agent-runtime
python -m app.ingestion_worker
python -m app.source_intelligence_worker
```

For the Codex backend, also run `docker compose exec codex-runner python -m app.codex_login` once before starting requests that use it.

### End-to-end path

1. Sign in and create a project under an organization.
2. Open **Sources** and upload SOPs, records, walkthroughs, and related process materials; wait for clean extractions.
3. Press **Understand this process** so Tacit prepares a cited workflow from the full knowledge-transfer package.
4. Complete clarifications, confirm the workflow, then build, test, approve, and operate.
5. Use **Add live expert KT** when the handoff still needs live expert narration.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js web app |
| `npm run build` | Production build for the web app |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | TypeScript project references build |
| `npm run test` | Vitest unit and integration tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run runtime:dev` | Start the FastAPI agent runtime with reload |
| `npm run runtime:lint` | Ruff on `apps/agent-runtime` |
| `npm run runtime:test` | pytest for the agent runtime |
| `docker build -f apps/agent-runtime/Dockerfile.sandbox -t tacit-agent-sandbox:latest apps/agent-runtime` | Build the restricted image used for generated-agent execution |
| `docker compose up --build -d` | Start the complete local topology, including both evidence workers |
| `docker compose logs -f web codex-runner agent-runtime ingestion-worker source-intelligence-worker` | Follow startup, processing, and worker errors |
| `docker compose down` | Stop local services while keeping the Codex device-login volume |

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run runtime:lint
npm run runtime:test
npm run build
```

For changes that affect Supabase or Storage, also verify migrations and RLS against a real environment.

## Key APIs

Authenticated project members use the production routes below.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/projects/:projectId/understand` | Automated observation + reconstruction from all ready sources |
| `GET` / `POST` | `/api/projects/:projectId/sources/insights` | Source intelligence: classifications, summaries, entities, facts, relationships |
| `POST` | `/api/workflow-versions/:versionId/change-proposals` | Draft a versioned conversational edit |
| `POST` | `/api/change-proposals/:proposalId/accept` | Accept a proposal and create a new workflow version |
| `POST` | `/api/change-proposals/:proposalId/reject` | Reject a pending proposal |
| `POST` | `/api/projects/:projectId/test-plan` | Source-derived and historical test plan |
| `GET` | `/api/projects/:projectId/readiness` | Deployment mode recommendation |
| `POST` | `/api/projects/:projectId/operating-observations` | Supervised operating feedback |
| `POST` | `/api/questions/:questionId/assignment` | Clarification assignee / defer state |

## Hackathon submission

**Track:** Work and Productivity

Tacit was built for **OpenAI Build Week** as a knowledge-transfer and agent-compilation product: a way for teams to hand process knowledge to AI the way they would to a colleague, then turn that handoff into evidence-backed, tested, reviewable agents.

### Three-minute product story

```text
0:00-0:20  The problem: essential workflow rules live in expert judgment and are hard to automate safely.
0:20-0:50  Run a knowledge transfer session: hand sources to Tacit the way you would brief a colleague.
0:50-1:15  Show the reconstructed workflow, a hidden rule or contradiction, and a clarification.
1:15-1:45  Compile a confirmed workflow into code and tests with Codex.
1:45-2:20  Replay a new case, show the evidence trail, and surface a review boundary.
2:20-3:00  Show readiness, approvals, and the path from expert KT to a governed agent.
```

### How Codex contributed

Codex accelerated the repository architecture, shared schemas, workflow-pack boundary, UI implementation, API routes, Supabase migrations, generated-agent runtime, test coverage, debugging, and documentation. Within the product, Codex is used in the controlled compilation flow to generate deterministic decision code and focused tests from a confirmed workflow specification.

### Codex feedback sessions

Feedback uploads completed for the following milestones:

```text
Milestone 0  - 019f6550-4f79-7ea1-bfcb-0ff381635ee5
Milestone 1  - 019f656f-697c-7372-9ebe-e20acad2dec6
Milestone 2  - 019f65a1-b896-78d0-bb9a-6b17bf069623
Milestone 3  - 019f65bd-a0c0-7e30-af90-f358681c505a
Milestone 4  - 019f65d6-5790-73e1-8237-a725a98bb0f7
Milestone 5  - 019f6611-6752-7de2-8fe7-7add76cb2cee
Milestone 6  - 019f6626-7c7e-7c83-a243-43eb24186587
Milestone 7  - 019f6644-00a9-7ca2-909b-6ae90b2d1bb1
Milestone 8  - 019f6688-b0b8-7d41-841c-6c0200573854
Milestone 9  - 019f66a7-67b3-79d3-a8e7-517f4de8ab9c
Milestone 10 - 019f6868-2613-7870-91d4-7a43892ee49e
Milestone 11 - 019f6872-6d2b-73d1-84f0-52a3e870aa1f
```

## License

MIT
