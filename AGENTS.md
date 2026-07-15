# AGENTS.md

## Mission

Build **Tacit**, a generic workflow-learning and agent-compilation platform demonstrated through **Invoice Exception Review**.

Core loop:

```text
Observe → Extract → Clarify → Compile → Test → Repair → Verify
```

Optimize for a reliable three-minute hackathon demo. Build one polished workflow without coupling the core platform to invoices.

## Read First

Before implementing a task, read only what is relevant:

1. `docs/idea.md` — product intent
2. `docs/plan.md` — architecture and stack
3. `docs/implementation_plan.md` — milestones and acceptance criteria
4. Existing code and tests in the affected area

Do not duplicate detailed requirements from those files here.

## Product Boundary

The **core platform must remain domain-agnostic**.

Invoice exception handling is the first workflow implementation, not the core data model.

Keep these reusable across future workflows:

- Projects and observation sessions
- Structured workflow events
- Evidence references
- Workflow steps and decision rules
- Clarification questions
- Workflow versioning
- Agent specifications and builds
- Runtime validation and execution
- Evaluations and regression tests
- Human approvals and audit logs

Keep invoice-specific schemas, UI, prompts, sample data, rules, metrics, and tests inside a dedicated workflow module.

Do not add invoice-specific fields to shared project, observation, workflow, build, approval, or evaluation abstractions.

## MVP Scope

Ship one workflow pack: **Invoice Exception Review**.

The demo must cover:

- Structured SME observation and narration
- Workflow and hidden-rule extraction
- Evidence-backed clarification questions
- Workflow graph and automation boundaries
- Executable agent specification
- Generated decision logic and tests
- Historical replay and failure repair
- Human approval for risky cases
- Impact metrics

Do not add real ERP integrations, desktop automation, multi-tenancy, billing, or additional workflow packs unless the MVP is complete.

## Architecture

```text
apps/web                   Next.js UI and application APIs
apps/agent-runtime         FastAPI compiler, validator, executor, pytest runner
packages/schemas           Shared domain-agnostic schemas
packages/prompts           Shared and workflow-specific prompts
packages/workflow-sdk      Workflow registration and specification utilities
packages/workflows/
  invoice-exception/       Invoice schemas, UI config, rules, fixtures, tests
packages/sample-data       Shared demo utilities only
generated/                 Generated agent artifacts only
supabase/                  Migrations and seed data
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
- Supabase PostgreSQL and Storage
- OpenAI Responses API

Use environment-configured model IDs. Never hard-code marketing model names.

## Engineering Rules

- Inspect existing code before introducing abstractions.
- Make the smallest coherent change that satisfies the task.
- Reuse shared schemas; avoid duplicate frontend/backend domain models.
- Separate platform logic from workflow-pack logic.
- Prefer capabilities and registries over repeated `if workflowType === ...` branches.
- Store domain-specific payloads in validated workflow schemas, not generic database columns.
- Keep business logic outside React components.
- Use deterministic code for calculations, thresholds, matching, and state transitions.
- Use AI for ambiguous interpretation, hidden-rule discovery, contradiction analysis, clarification, and failure explanation.
- Validate every external input and AI structured output with Zod or Pydantic.
- Every inferred rule, contradiction, or recommendation must reference evidence.
- Create a new workflow version when confirmed rules or approval boundaries change.
- Preserve loading, empty, success, and recoverable error states.
- Do not expose raw stack traces or secrets.

## Generated Code Safety

Treat generated code as untrusted.

Generated files may only be written under `generated/` or the designated build directory.

Before execution:

- Parse and inspect the Python AST.
- Allow only approved imports.
- Reject filesystem, network, shell, subprocess, dynamic import, `eval`, and `exec` access.
- Enforce time and resource limits.
- Run generated tests before marking a build successful.
- Capture stdout, stderr, exit code, and test results.

Generated agents must never perform real financial or other high-risk actions. Ambiguous or high-risk cases must stop for human review.

## Testing

Add or update tests for every meaningful change.

Prioritize:

- Shared schema and workflow-pack validation
- Workflow registration and loading
- Workflow state transitions
- Rule evaluation and approval triggers
- Generated-code security validation
- Historical replay comparisons
- Demo reset and the end-to-end happy path

A workflow pack should be testable independently from the core platform.

Do not hide, skip, weaken, or delete failing tests to make a change pass.

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

Run the smallest relevant checks during development, then run lint, typecheck, and affected tests before completing the task.

## Definition of Done

A change is complete only when:

- The requested behavior works.
- Core logic remains domain-agnostic unless the task is explicitly workflow-specific.
- Workflow-specific code stays inside its workflow module.
- Types and schemas remain consistent.
- Relevant tests pass.
- Errors and loading states are handled.
- Security boundaries are preserved.
- Seeded invoice demo data still works.
- Documentation is updated when behavior or setup changes.

## Working Style

When completing a task:

1. Inspect the relevant files.
2. Identify whether the change belongs to the platform or a workflow pack.
3. Implement the smallest safe solution.
4. Add or update tests.
5. Run relevant checks.
6. Summarize changed files, test results, and remaining limitations.

Avoid unrelated refactors, speculative abstractions, new frameworks, duplicate models, and premature support for multiple workflows.