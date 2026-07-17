# Tacit

<p align="center">
  <strong>Turn expert work into tested, reviewable AI agents.</strong>
</p>

<p align="center">
  Tacit captures how subject-matter experts actually work, turns that evidence into a confirmed workflow, and compiles it into a safe, testable agent with people kept in control.
</p>

<p align="center">
  <a href="#how-tacit-works">How it works</a> •
  <a href="#invoice-exception-review">Invoice Exception Review</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="#hackathon-submission">Hackathon submission</a>
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

Most business workflows are only partly written down. The rules that matter often live in expert judgment: how someone handles an exception, when they trust a vendor email, when a small variance is acceptable, or when they stop and ask for approval.

Conventional automation assumes a complete SOP already exists. That leaves teams with long discovery cycles, brittle rules, poor traceability, and automation that cannot explain why it made a decision.

Tacit starts with the work itself. It combines documents, recordings, structured observations, and expert narration to surface the tacit knowledge behind a process—then makes that knowledge reviewable, testable, and safe to apply.

## How Tacit works

~~~text
Ingest evidence -> Observe -> Extract -> Clarify -> Compile -> Test -> Repair -> Verify
~~~

1. **Ingest evidence** — Bring in SOPs, documents, spreadsheets, images, audio, and review recordings with provenance and retention controls.
2. **Observe expert work** — Capture the relevant steps, narration, decisions, and citations while a subject-matter expert completes a real workflow.
3. **Extract the workflow** — Use structured AI outputs to identify steps, rules, exceptions, contradictions, approvals, and unknowns.
4. **Clarify what matters** — Ask focused questions that resolve policy ambiguity and set appropriate automation boundaries.
5. **Confirm the specification** — An SME confirms the workflow, decision rules, evidence trail, and approval policy before any code is generated.
6. **Compile and test** — Codex produces deterministic decision code and focused tests from the confirmed typed workflow specification.
7. **Repair and verify** — Failed generated builds receive a bounded repair attempt, then pass static validation, generated tests, historical replay, and explicit promotion gates.

The result is not a black-box automation. It is an evidence-backed workflow with a clear human approval boundary and an audit trail.

## What Tacit delivers

| Capability | Outcome |
| --- | --- |
| Evidence-backed workflow discovery | Every inferred rule, exception, and recommendation can point back to durable source material. |
| Expert clarification | SMEs resolve the ambiguities that determine safety, accuracy, and approval boundaries. |
| Versioned workflow intelligence | Confirmed rules, workflow graphs, and changes are retained as explicit versions. |
| Tested agent builds | Generated code is tied to a typed workflow IR, provenance, static analysis, tests, and promotion state. |
| Historical replay | Teams can compare recommendations with labelled prior cases before relying on a build. |
| Supervised decisions | High-risk and ambiguous outcomes stop for human review with evidence and reasoning attached. |
| Audit and impact views | Projects retain approvals, build activity, evidence trails, and measured workflow outcomes. |

## Invoice Exception Review

**Invoice Exception Review** is Tacit's first production workflow pack. It demonstrates the complete loop without baking invoice concepts into the platform core.

The pack brings together invoices, purchase orders, delivery confirmations, vendor messages, approval policy, and expert decisions. It can surface cases such as quantity or price variance, missing documents, duplicate invoices, conditional approvals, high-value review thresholds, and conflicts between written SOPs and actual expert practice.

The guided demo is available at /demo and uses a dedicated synthetic tenant. The production journey begins at /projects, where authenticated users work in tenant-scoped projects and upload their own evidence.

### A representative flow

1. An AP expert reviews an invoice and narrates the decision.
2. Tacit records the evidence and reconstructs the workflow.
3. A contradiction or hidden rule becomes a targeted clarification.
4. The confirmed workflow is compiled into an agent and its tests.
5. Historical cases are replayed against the build.
6. A high-value or ambiguous case is routed to an approval queue rather than acted on autonomously.

<p align="center">
  <img src="apps/web/public/images/ap-reviewer-observation.png" alt="Tacit invoice exception observation workspace" width="900">
</p>

## Architecture

Tacit is a reusable platform with workflow packs. The core owns shared concepts such as organizations, projects, evidence, observations, workflow versions, builds, evaluations, approvals, and audit records. Each workflow pack owns its domain schemas, UI configuration, prompts, policies, fixtures, and tests.

~~~text
                             Tacit Web Application
             Projects | Evidence | Observe | Clarify | Build | Replay | Approvals
                                           |
              Supabase Auth + Postgres/RLS + private object storage
                                           |
          +----------------+---------------+----------------+
          |                |                                |
   Evidence ingestion   Workflow intelligence          Agent runtime
   scan / extract /     structured reconstruction      AST validation +
   OCR / transcription  and SME confirmation          isolated Docker execution
          |                |                                |
          +----------------+---------------+----------------+
                                           |
                              Workflow-pack registry
                     Invoice Exception Review | Sample Support
~~~

~~~text
apps/web                   Next.js application, APIs, and product UI
apps/agent-runtime         FastAPI runtime and evidence-ingestion worker
packages/core-schemas      Shared domain-agnostic schemas
packages/prompts           Shared and workflow-pack prompt construction
packages/workflow-sdk      Workflow-pack authoring utilities
packages/workflow-registry Pack discovery and loading
packages/workflows/        Invoice Exception Review and sample-support packs
supabase/migrations        Database, RLS, Storage, and audit migrations
generated/                 Local development build workspaces only
~~~

## Intelligence, compilation, and trust

Tacit uses the OpenAI Responses API for the work that benefits from reasoning: reconstructing workflows, identifying contradictions, generating clarification questions, explaining failures, and producing constrained agent code. Model IDs are configured through the environment rather than embedded in product logic.

Deterministic code handles thresholds, comparisons, validation, matching, and state transitions. AI output is schema-validated before application logic can use it, and Codex only receives an SME-confirmed typed workflow specification—not raw customer recordings or unreviewed documents.

Before a generated build is usable, Tacit records its source, prompts, dependency lock, model metadata, static-analysis result, generated-test result, repair attempts, and promotion state. The local runtime validates Python ASTs and import allowlists, then runs code in a short-lived Docker container with a read-only filesystem, default-deny network access, dropped capabilities, an unprivileged user, and bounded resources.

Tacit v1 produces recommendations and prepares work. It does not release payments or perform other high-risk external actions autonomously. Those actions require scoped connectors, an approval policy, and an authenticated, auditable human decision.

## Production direction

Tacit is being developed as a supervised production vertical, with Invoice Exception Review first. The repository includes foundations for tenant-scoped projects, private evidence intake, scan-gated extraction, workflow confirmation, build provenance, replay, approvals, and demo isolation.

The next delivery focus is operating these capabilities as a robust pilot: durable worker orchestration, production-grade isolated execution, verified Supabase RLS and Storage policies, monitoring, backups, and pilot reliability gates. The active plan is [prod_implementation.md](prod_implementation.md); supporting contracts are documented in [production-contract.md](docs/production-contract.md), [evidence-intake.md](docs/evidence-intake.md), [sandbox-execution.md](docs/sandbox-execution.md), and [pilot-operations.md](docs/pilot-operations.md).

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
- OpenAI credentials and approved model IDs

### Install dependencies

~~~bash
npm install
python -m pip install -e apps/agent-runtime
python -m pip install ruff
~~~

### Configure the environment

Copy both templates and provide values for your environment:

~~~bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
~~~

On Windows PowerShell:

~~~powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.local.example apps/web/.env.local
~~~

Configure the following values as applicable:

~~~dotenv
OPENAI_API_KEY=
OPENAI_REASONING_MODEL=
OPENAI_DEFAULT_MODEL=
OPENAI_FAST_MODEL=
OPENAI_CODEX_MODEL=
EVIDENCE_TRANSCRIPTION_MODEL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AGENT_RUNTIME_URL=http://localhost:8000
AGENT_EXECUTION_TIMEOUT_SECONDS=10
AGENT_SANDBOX_IMAGE=tacit-agent-sandbox:latest
NEXT_PUBLIC_DEMO_MODE_ENABLED=true
PILOT_MAX_ACTIVE_PROJECTS_PER_ORGANIZATION=5
~~~

Keep SUPABASE_SERVICE_ROLE_KEY and OpenAI keys server-side only.

### Prepare Supabase and the local sandbox

Apply the ordered SQL files in supabase/migrations/ through the approved Supabase migration workflow for the target environment. Then build the sandbox image used by the local agent runtime:

~~~bash
docker build -f apps/agent-runtime/Dockerfile.sandbox -t tacit-agent-sandbox:latest apps/agent-runtime
~~~

### Run Tacit locally

Seed the isolated demo tenant:

~~~bash
npm run seed
~~~

Start the web app:

~~~bash
npm run dev
~~~

In another terminal, start the runtime:

~~~bash
npm run runtime:dev
~~~

For the local ingestion worker and ClamAV topology, use Docker Compose after configuring the same environment variables:

~~~bash
docker compose up --build
~~~

Open http://localhost:3000. Use /demo for the guided synthetic experience or /projects for the authenticated project flow.

## Commands

~~~bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run seed
npm run demo:reset
npm run runtime:dev
npm run runtime:lint
npm run runtime:test
~~~

## Verification

~~~bash
npm run lint
npm run typecheck
npm run test
npm run runtime:lint
npm run runtime:test
npm run build
~~~

For changes that affect Supabase or Storage, also verify migrations and RLS against a real environment. See [AGENTS.md](AGENTS.md) for the engineering boundary and definition of done.

## Hackathon submission

**Track:** Work and Productivity

Tacit was built for OpenAI Build Week as a workflow-learning and agent-compilation product: a way for teams to transform expert judgment into evidence-backed, tested, reviewable AI agents.

### Three-minute product story

~~~text
0:00-0:20  The problem: essential workflow rules are tacit, inconsistent, and hard to automate safely.
0:20-0:50  Observe an invoice-review expert and connect decisions to evidence.
0:50-1:15  Show the reconstructed workflow, a hidden rule, and a clarification.
1:15-1:45  Compile a confirmed workflow into code and tests with Codex.
1:45-2:20  Replay a new case, show the evidence trail, and surface a review boundary.
2:20-3:00  Show verification, approvals, and the path from expert work to a governed agent.
~~~

### How Codex contributed

Codex accelerated the repository architecture, shared schemas, workflow-pack boundary, UI implementation, API routes, Supabase migrations, generated-agent runtime, test coverage, debugging, and documentation. Within Tacit, Codex is used in the controlled compilation flow to generate deterministic decision code and focused tests from a confirmed workflow specification.

### Codex feedback sessions

Feedback uploads completed for the following milestones:

~~~text
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
~~~

## License

MIT
