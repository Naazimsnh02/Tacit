# AGENTS.md

## Mission

Build **Tacit**, a domain-agnostic workflow-learning and agent-compilation platform that can launch as a supervised production product. **Invoice Exception Review** is the first production workflow pack.

Core loop:

```text
Ingest evidence -> Observe -> Extract -> Clarify -> Compile -> Test -> Repair -> Verify
```

The existing three-minute demo remains an explicit, isolated fallback. The active direction is the production roadmap in `prod_implementation.md`: real user projects, SOP/document/video evidence intake, evidence-backed intelligence, Codex compilation, isolated execution, and supervised approvals. Build one polished production vertical without coupling the core platform to invoices.

## Read First

Before implementing a task, read only what is relevant:

1. `prod_implementation.md` - active production roadmap and launch gates
2. `docs/idea.md` - product intent
3. `docs/plan.md` - original architecture and stack rationale
4. `docs/implementation_plan.md` - demo milestones and acceptance criteria
5. Existing code and tests in the affected area

Do not duplicate detailed requirements from those files here.

## Product Boundary

The **core platform must remain domain-agnostic**.

Invoice exception handling is the first workflow implementation, not the core data model. Keep these reusable across future workflows:

- Organizations, projects, memberships, roles, and observation sessions
- Structured workflow events and evidence references
- Workflow steps, decision rules, clarification questions, and versioning
- Agent specifications, builds, runtime validation, and execution
- Evaluations, regression tests, human approvals, and audit logs

Keep invoice-specific schemas, UI, prompts, sample data, rules, metrics, tests, and connectors inside its dedicated workflow module. Do not add invoice-specific fields to shared project, observation, workflow, build, approval, or evaluation abstractions.

## Product Scope

Ship one production workflow pack first: **Invoice Exception Review**.

The first production milestone is a signed-in user creating a project, uploading an SOP and a review video, receiving evidence-backed workflow extraction, and confirming the workflow. Implement production foundations in the order recorded in `prod_implementation.md`.

The production vertical must cover:

- Authenticated projects and tenant isolation
- SOP, document, and video evidence intake with provenance
- Structured SME observation and narration
- Evidence-backed workflow and hidden-rule extraction
- Clarification, versioning, workflow graph, and automation boundaries
- Codex-generated, project-specific agent builds and tests
- Isolated execution, replay, repair, human approval, and impact metrics

Keep the guided demo, seeded fixtures, reset action, and deterministic fallback as a separate `demo_mode` path. They must never silently serve production users or share a tenant, data namespace, or destructive reset operation with customer projects.

Do not add broad ERP coverage, desktop automation, billing, or additional workflow packs until the first production vertical has authenticated projects, evidence ingestion, safe compilation, isolated execution, and approval gates.

## Infrastructure Access

The Supabase MCP server is authenticated and active in this environment. Use it to inspect the live project schema, migrations, Storage, and RLS state before making database or storage changes. Treat it as a production-capable interface: never expose credentials, never apply destructive changes without explicit user authorization, and verify migrations and policies in the appropriate environment.

## Architecture

```text
apps/web                   Next.js UI and authenticated application APIs
apps/agent-runtime         FastAPI validator and local development runtime
workers/                    Queued ingestion, compilation, and execution workers (target)
packages/core-schemas      Shared domain-agnostic schemas
packages/prompts           Shared and workflow-specific prompts
packages/workflow-sdk      Workflow registration and specification utilities
packages/workflows/
  invoice-exception/       Invoice schemas, UI config, rules, fixtures, tests
generated/                 Local development artifacts only
supabase/                  Migrations, RLS, Storage policy, and seed data
```

A workflow pack should provide, where needed:

```text
metadata
input schemas
evidence types
supported actions
workspace configuration
prompt extensions
approval policy
evaluation configuration
sample data and tests
```

The platform should load workflows through a registry or equivalent module boundary. Do not scatter workflow-type conditionals across the application.

Primary stack:

- Next.js, TypeScript, Tailwind, shadcn/ui, React Flow, Zod
- FastAPI, Python, Pydantic, pytest
- Supabase Auth, PostgreSQL, RLS, and Storage
- OpenAI Responses API and Codex in isolated build workers

Use environment-configured model IDs. Never hard-code marketing model names.

## Engineering Rules

- Inspect existing code before introducing abstractions.
- Make the smallest coherent change that satisfies the current production phase.
- Reuse shared schemas; avoid duplicate frontend/backend domain models.
- Separate platform logic from workflow-pack logic.
- Prefer capabilities and registries over repeated `if workflowType === ...` branches.
- Store domain-specific payloads in validated workflow schemas, not generic database columns.
- Keep business logic outside React components.
- Use deterministic code for calculations, thresholds, matching, and state transitions.
- Use AI for ambiguous interpretation, hidden-rule discovery, contradiction analysis, clarification, failure explanation, and constrained code generation.
- Use Codex only after the SME confirms a typed workflow specification; never generate production code directly from unreviewed raw video or documents.
- Validate every external input and AI structured output with Zod or Pydantic.
- Every inferred rule, contradiction, or recommendation must reference durable evidence.
- Create a new workflow version when confirmed rules or approval boundaries change.
- Preserve loading, empty, success, and recoverable error states.
- Do not expose raw stack traces or secrets.
- Keep demo fallbacks explicit and namespaced; never mask a production failure with seeded data or an unlabelled fallback.

## Generated Code Safety

Treat generated code as untrusted.

Generated files may only be written under a designated build directory or immutable artifact store. Before execution:

- Parse and inspect the Python AST.
- Allow only approved imports.
- Reject filesystem, network, shell, subprocess, dynamic import, `eval`, and `exec` access.
- Enforce time and resource limits.
- Run generated tests before marking a build successful.
- Capture stdout, stderr, exit code, and test results.

Generated agents must never perform real financial or other high-risk actions. Ambiguous or high-risk cases must stop for human review.

For production, AST checks are only a first gate. Generated code and tests must run in an ephemeral isolated container or microVM with no host filesystem, default-deny network access, resource limits, immutable artifacts, and only scoped connector credentials. Do not treat a host subprocess as a production sandbox.

## Testing

Add or update tests for every meaningful change. Prioritize:

- Shared schema and workflow-pack validation
- Workflow registration and loading
- Authenticated tenant isolation and RLS policies
- Upload validation, extraction provenance, and deletion/retention flows
- Workflow state transitions, rule evaluation, and approval triggers
- Worker retries and idempotency
- Generated-code security validation and sandbox escape attempts
- Historical replay comparisons
- Demo reset and the end-to-end happy path

A workflow pack should be testable independently from the core platform. Do not hide, skip, weaken, or delete failing tests to make a change pass.

## Commands

Run commands from the repository root:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run seed
npm run demo:reset
npm run runtime:dev
npm run runtime:test
```

Run the smallest relevant checks during development, then run lint, typecheck, and affected tests before completing the task. Run real Supabase migration/RLS verification when a change touches database or Storage behavior.

## Definition of Done

A change is complete only when:

- The requested behavior works.
- Core logic remains domain-agnostic unless the task is explicitly workflow-specific.
- Workflow-specific code stays inside its workflow module.
- Types, schemas, database migrations, and RLS policies remain consistent.
- Relevant tests pass and failures are explained rather than hidden.
- Errors, background work, retries, and loading states are handled.
- Security boundaries are preserved.
- Production paths do not use unlabelled seeded fallbacks.
- Seeded invoice demo data still works in isolated demo mode.
- Documentation is updated when behavior or setup changes.

## Working Style

When completing a task:

1. Inspect the relevant files and applicable production phase.
2. Identify whether the change belongs to the platform, a worker, or a workflow pack.
3. Implement the smallest safe solution.
4. Add or update tests.
5. Run relevant checks and live Supabase verification when appropriate.
6. Summarize changed files, test results, and remaining limitations.

Avoid unrelated refactors, speculative abstractions, new frameworks, duplicate models, and premature support for multiple workflows.
