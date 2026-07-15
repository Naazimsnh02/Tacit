# Tacit — Implementation Plan

## 1. Objective

Build a working hackathon prototype of **Tacit**, a domain-agnostic workflow-learning and agent-compilation platform.

For the hackathon, invoice exception review is the first workflow pack and demonstration scenario. The core platform must remain reusable for future workflows such as customer-support escalation, procurement review, compliance checks, employee onboarding, claims handling, and operational approvals.

The completed application must demonstrate this loop:

```text
Observe
→ Reconstruct workflow
→ Detect hidden rules
→ Ask clarifying questions
→ Generate executable agent
→ Run historical tests
→ Identify a failure
→ Correct the workflow
→ Verify the agent
→ Require human approval for high-risk cases
```

The implementation should optimize for:

* A reliable three-minute demonstration
* Clear use of GPT-5.6
* Clear use of Codex
* Strong product design
* Verifiable AI output
* Safe automation boundaries
* Minimal dependence on external enterprise systems
* A generic core that can support new workflow packs without changing platform services

## Architecture principle

Tacit must be implemented as:

```text
Generic Core Platform
+ Workflow Pack Interface
+ Invoice Exception Workflow Pack
```

The generic core owns:

* Observation sessions and events
* Evidence references
* Workflow reconstruction
* Contradiction detection
* Clarification
* Workflow versioning
* Agent compilation
* Generated-code validation
* Testing and historical replay
* Human approvals
* Audit trails
* Impact measurement

A workflow pack owns:

* Domain input schemas
* Workspace configuration
* Supported actions and outcomes
* Domain evidence types
* Domain prompts or prompt context
* Seed data and test cases
* Approval defaults
* Evaluation rules
* Domain-specific UI panels

Invoice-specific fields and logic must not be added to shared platform tables, shared workflow objects, or generic runtime services.

---

# 2. MVP Success Criteria

The MVP is complete when the invoice workflow pack proves that a user can:

1. Open a seeded invoice-review project.
2. Perform a simulated invoice exception review.
3. Record structured actions and narration.
4. Generate a workflow from the observation session.
5. View discovered steps, rules, and contradictions.
6. Answer evidence-backed clarification questions.
7. View an updated workflow graph.
8. Compile the workflow into executable Python logic.
9. Run generated tests in a restricted runtime.
10. Replay at least ten historical invoice cases.
11. Inspect an incorrect or ambiguous result.
12. Convert the failure into a new rule or clarification.
13. Re-run the evaluation and improve the result.
14. Process a new invoice case.
15. Stop the case for human approval when required.
16. View estimated time savings and automation coverage.

---

# 3. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Tacit Web App                         │
│ Dashboard │ Observe │ Discover │ Workflow │ Build │ Test   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                    Generic Application API                   │
│ Projects │ Sessions │ Versions │ Builds │ Tests │ Approvals │
└───────────────┬───────────────────────┬──────────────────────┘
                │                       │
┌───────────────▼─────────────┐  ┌──────▼─────────────────────┐
│ Generic Core Services       │  │ Workflow Pack Registry     │
│ Observation                 │  │                            │
│ Evidence                    │  │ invoice_exception          │
│ Reconstruction              │  │ future_workflow_pack       │
│ Clarification               │  │ ...                        │
│ Versioning                  │  └───────────┬────────────────┘
│ Evaluation and approvals    │              │
└───────────────┬─────────────┘              │
                │                            │
        ┌───────▼────────┐          ┌────────▼───────────────┐
        │ OpenAI API     │          │ Pack-specific assets   │
        │ GPT-5.6 roles  │          │ Schemas, UI, prompts,  │
        │ and Codex      │          │ policies, tests, data  │
        └───────┬────────┘          └────────────────────────┘
                │
        ┌───────▼────────────────────────────────────────────┐
        │             Python Agent Runtime                   │
        │ Compiler │ Validator │ Sandbox │ pytest │ Replay  │
        └────────────────────────────────────────────────────┘
```

## Core rule

The application API and runtime must resolve workflow-specific behavior through a workflow-pack registry. Avoid scattered conditions such as:

```ts
if (workflowType === "invoice_exception") {
  // domain behavior
}
```

Use a registered workflow definition instead:

```ts
interface WorkflowPack {
  id: string;
  name: string;
  inputSchema: unknown;
  outcomeSchema: unknown;
  workspace: WorkspaceDefinition;
  evidenceTypes: EvidenceTypeDefinition[];
  approvalPolicy: ApprovalPolicyDefinition;
  evaluation: EvaluationDefinition;
  promptContext: PromptContext;
}
```

---



# 4. Milestone Summary

| Milestone | Outcome                                       |
| --------- | --------------------------------------------- |
| M0        | Repository and development environment        |
| M1        | Generic schemas, workflow-pack contract, database, and seed data |
| M2        | Invoice exception workflow pack and simulated workspace          |
| M3        | Observation capture and timeline              |
| M4        | AI workflow reconstruction                    |
| M5        | Clarification and contradiction resolution    |
| M6        | Workflow graph and automation boundaries      |
| M7        | Agent specification and code generation       |
| M8        | Secure execution and generated tests          |
| M9        | Historical replay and failure repair          |
| M10       | Human approval and impact dashboard           |
| M11       | Demo hardening, documentation, and deployment |

---

# 5. Milestone 0 — Repository Foundation

## Goal

Create a clean monorepo with working local development commands.

## Tasks

### Repository setup

* Create root workspace.
* Create Next.js application in `apps/web`.
* Create FastAPI application in `apps/agent-runtime`.
* Create shared packages:

  * `packages/core-schemas`
  * `packages/workflow-sdk`
  * `packages/workflow-registry`
  * `packages/prompts`
  * `packages/config`
* Create the first workflow pack at `packages/workflows/invoice-exception`.
* Store invoice-specific schemas, workspace configuration, prompts, seed data, policies, and tests inside that workflow pack.
* Add generated build output under `generated/<project-id>/<build-id>` rather than a hard-coded invoice directory.
* Add Supabase migrations directory.
* Add root scripts.

### Tooling

Configure:

* TypeScript strict mode
* ESLint
* Prettier
* Python formatter
* Python linter
* pytest
* Vitest
* Playwright
* Environment validation
* Docker Compose

### Environment variables

Create `.env.example` containing:

```bash
OPENAI_API_KEY=
OPENAI_REASONING_MODEL=
OPENAI_DEFAULT_MODEL=
OPENAI_FAST_MODEL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AGENT_RUNTIME_URL=http://localhost:8000
AGENT_EXECUTION_TIMEOUT_SECONDS=10
```

### Root commands

Implement:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run seed
npm run demo:reset
npm run runtime:dev
npm run runtime:test
```

## Acceptance criteria

* Web app starts.
* Python runtime starts.
* Root commands work.
* Environment variables are validated.
* Linting and type checking pass.
* Basic health endpoints respond.
* The invoice workflow pack can be registered without importing invoice code into generic core services.
* Adding a second empty sample workflow pack does not require changes to core APIs.

---

# 6. Milestone 1 — Generic Domain Model, Workflow-Pack Contract, Database, and Seed Data

## Goal

Define Tacit’s reusable core model, establish the workflow-pack extension contract, and prepare deterministic invoice demo data.

## Database tables

Create migrations for:

```text
projects
observation_sessions
workflow_events
documents
workflow_versions
decision_rules
clarification_questions
agent_builds
test_cases
test_runs
test_case_results
approval_requests
approval_actions
impact_snapshots
```

## Important relationships

```text
project
  ├── observation_sessions
  ├── workflow_versions
  ├── agent_builds
  ├── test_cases
  ├── approval_requests
  └── impact_snapshots

observation_session
  ├── workflow_events
  └── documents

workflow_version
  ├── decision_rules
  ├── clarification_questions
  ├── agent_builds
  └── test_runs
```

## Generic database rule

Shared tables must store domain-neutral fields. Do not add columns such as:

```text
invoice_number
purchase_order_id
quantity_variance
vendor_name
```

to generic tables.

Workflow-specific payloads may be stored as validated JSON using a schema version owned by the workflow pack, or in pack-specific tables when justified.

## Workflow-pack contract

Create a registry and typed contract covering:

```text
id
name
version
input_schema
outcome_schema
workspace_definition
event_catalog
evidence_types
supported_actions
approval_policy
evaluation_definition
prompt_context
seed_loader
```

The registry must support loading a workflow pack by `workflow_type`.

## Shared schemas

Create typed schemas for:

* Project
* Observation session
* Workflow event
* Document evidence
* Workflow step
* Decision rule
* Contradiction
* Clarification question
* Workflow specification
* Agent build
* Test case
* Test result
* Approval request
* Impact metrics

Use:

* Zod in TypeScript
* Pydantic in Python
* Matching enum values across runtimes

## Invoice workflow pack and seed demo project

Create one project:

```text
Project name:
Invoice Exception Review

Workflow type:
invoice_exception
```

## Seed documents

Prepare:

* One invoice-review SOP
* Ten invoice records
* Ten purchase-order records
* Ten delivery records
* Five vendor emails
* One approval matrix
* One expert demonstration case

## Historical cases

Create these cases:

### Case 1 — Exact match

Expected result:

```text
approve
```

### Case 2 — Quantity variance below 2%

Expected result:

```text
approve
```

Condition:

```text
delivery confirmation exists
```

### Case 3 — Quantity variance above 2%

Expected result:

```text
escalate
```

### Case 4 — Price mismatch

Expected result:

```text
escalate_to_procurement
```

### Case 5 — Missing purchase order

Expected result:

```text
request_more_information
```

### Case 6 — Missing delivery confirmation

Expected result:

```text
hold
```

### Case 7 — Duplicate invoice

Expected result:

```text
reject_or_escalate
```

### Case 8 — Invoice above approval threshold

Expected result:

```text
manager_approval
```

### Case 9 — Conditional email approval

Expected result:

```text
human_review
```

### Case 10 — SOP and SME conflict

Expected result:

```text
policy_clarification
```

## Demo reset

Create a script that:

1. Deletes demo project data.
2. Recreates all seed records.
3. Restores initial workflow state.
4. Restores initial test results.
5. Verifies expected record counts.

## Acceptance criteria

* Migrations run from an empty database.
* Seed data loads successfully.
* Demo reset is repeatable.
* All shared schemas validate the seed data.
* Every historical case has a labelled expected result.
* Core schemas contain no invoice-specific fields or enums.
* Invoice inputs validate through the invoice workflow pack.
* A second placeholder workflow pack can register successfully.

---

# 7. Milestone 2 — Configurable Observation Workspace and Invoice Workflow Pack

## Goal

Build a reusable observation shell and configure it for the invoice exception workflow pack.

## Reusable observation shell

The core observation shell should provide:

* Session controls
* Narration capture
* Event recording
* Evidence selection
* Decision submission
* Timeline integration
* Workspace panel layout
* Loading, empty, and error states

The invoice workflow pack provides the panels, fields, actions, labels, and outcomes rendered inside this shell.

## Page layout

Configure the invoice workflow pack with:

### Left panel

Invoice document viewer showing:

* Invoice number
* Vendor
* Purchase-order number
* Invoice date
* Quantity
* Unit price
* Total value
* Tax
* Line items

### Centre panel

Tabbed reference systems:

```text
Purchase Order
Delivery Record
Vendor Email
Approval Matrix
SOP
```

### Right panel

Observation controls:

* Start session
* Pause
* Resume
* Complete
* Narration input
* Current decision
* Notes
* Recorded events count

## Supported actions

Record structured events when the SME:

* Opens a document
* Switches tabs
* Compares values
* Highlights a field
* Opens vendor history
* Reads an email
* Checks approval threshold
* Selects a decision
* Adds a note
* Completes review

## Narration

For reliability, support:

* Text narration input
* Optional browser microphone capture
* Optional transcription integration

The text input must remain available as the fallback.

## Final review outcomes

Provide:

```text
Approve
Reject
Escalate
Request information
Manager approval
```

## Acceptance criteria

* A user can complete the seeded demonstration.
* Every important action becomes a workflow event.
* Events include timestamps and evidence references.
* The session is persisted.
* The final action is saved.
* Reloading the page restores the current session.
* The observation shell does not import invoice schemas directly.
* Workspace panels and supported actions are resolved from the workflow pack.

---

# 8. Milestone 3 — Observation Timeline

## Goal

Turn raw interaction events into an understandable activity history.

## Timeline requirements

Display:

* Timestamp
* Application or source
* Action
* Relevant value
* Narration
* Evidence link

Example:

```text
10:02 — Opened invoice INV-284
10:03 — Compared invoice quantity 98 with PO quantity 100
10:04 — Identified 2% quantity variance
10:05 — Opened delivery confirmation
10:06 — Checked approval threshold
10:07 — Selected Approve
```

## Event grouping

Group low-level events into semantic steps.

Examples:

```text
Viewed invoice
Reviewed purchase order
Verified delivery
Applied tolerance rule
Checked approval limit
Made final decision
```

## Evidence drawer

Selecting a timeline item should open:

* Related document
* Relevant field
* Transcript segment
* Before and after value
* Raw event JSON for debugging

## Acceptance criteria

* Timeline renders from stored events.
* Events can be filtered by source.
* Evidence can be inspected.
* Raw and semantic event views are both available.
* Timeline data can be passed to the workflow-reconstruction API.

---

# 9. Milestone 4 — AI Workflow Reconstruction

## Goal

Convert observation evidence into a structured workflow.

## API endpoint

Create:

```text
POST /api/projects/:projectId/workflow/reconstruct
```

## Input

Include:

* Observation session
* Workflow events
* Narration
* Workflow-pack identifier and version
* Pack-validated evidence records
* Pack-provided prompt context
* Final SME decision

For the invoice pack, the evidence records include the SOP, invoice, purchase order, delivery record, vendor email, and approval matrix.

## Model output

Require structured output containing:

```text
workflow_objective
inputs
steps
decision_points
rules
exceptions
contradictions
unknowns
approval_requirements
automation_candidates
```

## Workflow step schema

Each step should contain:

```text
id
name
description
type
sequence
inputs
outputs
evidence_ids
confidence
```

Step types:

```text
action
deterministic_rule
ai_judgment
human_decision
approval
escalation
```

## Rule schema

Each rule should contain:

```text
id
name
condition
action
exceptions
confidence
evidence_ids
verification_status
risk_level
```

## Contradiction schema

Each contradiction should include:

```text
id
source_a
source_b
description
business_impact
severity
evidence_ids
requires_clarification
```

## Validation

* Validate all output with Zod.
* Retry once when schema validation fails.
* Save the successful result as workflow version 1.
* Store the prompt version and logical model role.

## Acceptance criteria

* The seeded observation produces a usable workflow.
* Every rule includes evidence.
* At least one unknown or contradiction is identified.
* Invalid model responses do not corrupt workflow state.
* Workflow version 1 is persisted.

---

# 10. Milestone 5 — Clarification Interview and Contradiction Resolution

## Goal

Ask only high-value questions that improve automation safety or coverage.

## Question-generation criteria

Questions should be generated when:

* A rule has insufficient evidence.
* SME behaviour conflicts with the SOP.
* An approval threshold is unclear.
* An exception changes the expected action.
* A historical case cannot be classified safely.
* Two sources imply different outcomes.

## Question structure

Each question contains:

```text
question
why_it_matters
related_rule_id
evidence_ids
answer_type
suggested_answers
risk_if_unanswered
```

Supported answer types:

```text
single_select
multi_select
number
boolean
free_text
```

## Example questions

```text
You approved a 1.7% quantity variance.
Should every variance at or below 2% be approved?
```

```text
The SOP requires manager approval above ₹300,000,
but the observed workflow used ₹500,000.
Which threshold should the generated agent follow?
```

```text
Does the quantity-tolerance rule still apply when
delivery confirmation is missing?
```

## Applying answers

When an answer is submitted:

1. Validate the answer.
2. Update the affected rule.
3. Mark the question resolved.
4. Create a new workflow version.
5. Store a rule-level diff.
6. Recalculate automation boundaries.
7. Mark affected agent builds as stale.

## Acceptance criteria

* Three to five questions are generated for the demo.
* Questions reference specific evidence.
* Answers update workflow rules.
* A new workflow version is created.
* The UI clearly distinguishes AI-inferred and SME-confirmed rules.

---

# 11. Milestone 6 — Workflow Graph and Automation Boundaries

## Goal

Provide a strong visual representation of the discovered process.

## Graph

Use React Flow.

Required node types:

```text
Start
Action
Deterministic rule
AI judgment
Human decision
Approval
Escalation
End
```

Required edge types:

```text
Default
Conditional
Failure
Escalation
Approval
```

## Node details

Selecting a node should display:

* Description
* Inputs
* Outputs
* Rule
* Confidence
* Evidence
* Automation recommendation
* Risk level
* Verification status

## Automation boundary classifications

Use:

```text
automate
ai_prepare_human_approve
human_required
unsupported
```

## Classification rules

Prefer deterministic classification when possible. The core classifications are generic; the examples below come from the invoice workflow pack.

Examples:

### Automate

* Exact PO matching
* Numeric variance calculation
* Duplicate invoice lookup
* Required-field validation
* Audit-log creation

### AI plus review

* Interpret vendor email
* Classify conditional approval
* Summarize discrepancy

### Human required

* High-value invoice approval
* Conflicting policy
* Missing evidence
* Low-confidence decision

## Acceptance criteria

* Workflow renders as a graph.
* Each rule maps to a node or edge.
* The graph updates after clarification.
* Automation classifications are visible.
* Evidence and risk can be inspected.

---

# 12. Milestone 7 — Workflow Specification and Agent Compilation

## Goal

Convert the confirmed workflow into an executable specification.

## Specification format

Generate both:

* JSON for runtime use
* YAML for human readability

## Required specification fields

```text
name
version
description
inputs
steps
rules
approval_policy
escalation_policy
output_schema
audit_policy
test_case_ids
```

## Example rule

```yaml
- id: quantity_tolerance
  description: Allow a small quantity variance after delivery confirmation
  condition:
    all:
      - field: quantity_variance_percent
        operator: less_than_or_equal
        value: 2
      - field: delivery_confirmed
        operator: equals
        value: true
  action: continue_review
  risk_level: low
```

## Compilation strategy

For hackathon reliability, use a constrained code-generation format.

Codex or the model may generate:

* Pydantic input models
* Pure decision functions
* Rule registry
* Main evaluation function
* pytest fixtures
* pytest tests
* Manifest

Do not generate unrestricted application code.

## Build endpoint

Create:

```text
POST /api/projects/:projectId/builds
```

## Build stages

Stream these stages:

```text
Reading workflow specification
Validating rules
Generating input models
Generating decision functions
Generating approval policy
Generating test fixtures
Validating generated code
Running tests
Packaging agent
Build complete
```

## Build records

Store:

* Workflow version
* Build status
* Generated files
* Build logs
* Validation result
* Test result
* Created time
* Failure reason

## Acceptance criteria

* Confirmed workflow generates a specification.
* Specification passes schema validation.
* Generated files are written only under `generated/<project-id>/<build-id>`.
* Build progress streams to the UI.
* Failed builds show a meaningful reason.

---

# 13. Milestone 8 — Secure Runtime and Generated Tests

## Goal

Safely validate and execute generated agent code.

## Runtime endpoint

Create:

```text
POST /runtime/builds/:buildId/validate
POST /runtime/builds/:buildId/test
POST /runtime/builds/:buildId/execute
```

## Static validation

Before execution:

* Parse Python AST.
* Verify allowed imports.
* Reject prohibited function calls.
* Reject filesystem access.
* Reject network access.
* Reject process spawning.
* Reject dynamic imports.
* Reject `eval` and `exec`.
* Enforce maximum file size.

## Test execution

Run:

```bash
pytest -q
```

Capture:

* Passed tests
* Failed tests
* Duration
* stdout
* stderr
* Exit code

## Demonstration failure

Seed one initial rule that causes a controlled test failure.

Recommended example:

```text
The initial agent approves a quantity variance below 2%
even when delivery confirmation is missing.
```

Expected failed test:

```text
test_quantity_tolerance_requires_delivery_confirmation
```

## Repair flow

When the test fails:

1. Send the failure, rule, and evidence to the failure-analysis model.
2. Classify the issue as:

   * Code bug
   * Missing business rule
   * Ambiguous policy
   * Invalid test
3. Generate a clarification or proposed rule correction.
4. Apply the confirmed fix.
5. Create a new workflow version.
6. Rebuild the agent.
7. Re-run tests.

## Acceptance criteria

* Generated code cannot access prohibited capabilities.
* Initial controlled failure appears in the build console.
* Failure analysis identifies the missing condition.
* Corrected workflow produces passing tests.
* Test results are stored.

---

# 14. Milestone 9 — Historical Replay and Evaluation

## Goal

Measure whether the generated agent behaves like the expert.

## Evaluation endpoint

Create:

```text
POST /api/projects/:projectId/evaluations
```

## Evaluation process

For each historical case:

1. Validate inputs.
2. Run generated agent.
3. Capture decision.
4. Capture applied rules.
5. Capture evidence.
6. Compare with expected result.
7. Assign match category.
8. Store result.

## Match categories

```text
exact_match
acceptable_alternative
correct_escalation
incorrect
needs_clarification
execution_failure
```

## Dashboard metrics

Show:

```text
Total cases
Exact matches
Acceptable alternatives
Correct escalations
Incorrect cases
Needs clarification
Safe automation coverage
Human review rate
Unsafe failure rate
Average confidence
```

## Case-inspection screen

Show:

* Input data
* Expected action
* Agent action
* Applied rules
* Evidence
* Confidence
* Failure explanation
* Suggested next step

## Regression behavior

Any corrected failure must become a permanent regression test.

## Acceptance criteria

* Ten seeded cases can be replayed.
* Results are persisted.
* Incorrect cases are inspectable.
* At least one correction improves the evaluation score.
* The dashboard updates after rebuilding.

---

# 15. Milestone 10 — Human Approval and Impact Dashboard

## Goal

Demonstrate responsible agent execution and measurable value.

## Approval triggers

The core approval engine creates requests when instructed by the workflow specification or workflow pack.

Generic triggers include:

* A configured risk or value threshold is exceeded.
* Policy conflict remains unresolved.
* Required evidence is missing.
* Confidence is below the configured limit.
* A workflow-pack risk condition is detected.
* The generated agent explicitly returns human review.

For the invoice pack, examples include high invoice value and duplicate-payment risk.

## Approval screen

Display:

* Requested action
* Agent recommendation
* Confidence
* Business reason
* Evidence
* Applied rules
* Risk level
* Available actions

Actions:

```text
Approve
Reject
Request more information
Escalate
```

## Approval audit trail

Store:

* Approver
* Decision
* Timestamp
* Notes
* Agent recommendation
* Workflow version
* Build version
* Evidence snapshot

For the hackathon, a demo user identity is sufficient.

## Impact metrics

Calculate:

```text
Manual steps
Automated steps
AI-assisted steps
Human-required steps
Manual handling time
Estimated automated time
Safe automation coverage
Review rate
Rules discovered
Undocumented exceptions
Evaluation accuracy
```

Use conservative assumptions.

Example:

```text
Manual handling time: 18 minutes
Estimated assisted handling time: 3 minutes
Safe automation coverage: 70%
Human review rate: 30%
Undocumented rules discovered: 3
Historical test accuracy: 90%
```

## Acceptance criteria

* A high-value case stops for approval.
* The approval screen cites evidence.
* Approval actions are persisted.
* Impact dashboard uses stored metrics.
* Metrics are labelled as observed or estimated.

---

# 16. Milestone 11 — Product Polish and Demo Hardening

## Goal

Make the application reliable, understandable, and presentation-ready.

## Required polish

### Dashboard

Show:

* Demo project
* Current status
* Workflow version
* Latest build
* Test score
* Safe automation coverage

### Navigation

Use:

```text
Overview
Observe
Discover
Workflow
Build
Test
Approvals
Impact
```

### Status badges

Standardize:

```text
Draft
Observing
Needs clarification
Ready to build
Building
Tests failed
Verified
Approval required
```

### Loading states

Provide visible progress for:

* Workflow extraction
* Question generation
* Agent build
* Test execution
* Historical replay

### Error states

Provide recovery actions:

```text
Retry
Use seeded result
Return to previous workflow version
Reset demo
```

### Demo mode

Add:

```text
Start guided demo
Reset demo
Skip to next stage
```

The normal end-to-end flow must still work without skipping.

## Acceptance criteria

* The demo works in a fresh browser.
* The demo can be reset in one action.
* Every page has loading and error states.
* No raw IDs or technical errors are exposed unnecessarily.
* The complete demo fits within three minutes.

---

# 17. API Endpoint Plan

## Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
```

## Observation sessions

```text
POST   /api/projects/:projectId/sessions
GET    /api/sessions/:sessionId
POST   /api/sessions/:sessionId/events
POST   /api/sessions/:sessionId/complete
```

## Workflow

```text
POST   /api/projects/:projectId/workflow/reconstruct
GET    /api/projects/:projectId/workflow
GET    /api/projects/:projectId/workflow/versions
GET    /api/workflow-versions/:versionId
```

## Clarifications

```text
GET    /api/workflow-versions/:versionId/questions
POST   /api/questions/:questionId/answer
```

## Builds

```text
POST   /api/projects/:projectId/builds
GET    /api/builds/:buildId
GET    /api/builds/:buildId/events
```

## Evaluation

```text
POST   /api/projects/:projectId/evaluations
GET    /api/test-runs/:testRunId
GET    /api/test-runs/:testRunId/results
```

## Approvals

```text
GET    /api/projects/:projectId/approvals
POST   /api/approvals/:approvalId/decision
```

## Demo

```text
POST   /api/demo/reset
POST   /api/demo/seed
```

---

# 18. Prompt Implementation Plan

## Prompt 1 — Workflow reconstruction

### Input

* Workflow events
* Narration
* SOP
* Business records
* Final decision

### Output

* Steps
* Rules
* Contradictions
* Unknowns
* Automation candidates
* Approval boundaries

### Completion criteria

* All claims cite evidence.
* Output validates against schema.
* Unsupported assumptions are labelled.

---

## Prompt 2 — Contradiction detection

### Input

* SOP
* SME narration
* Observed actions
* Historical outcomes

### Output

* Contradiction description
* Evidence on both sides
* Severity
* Business impact
* Required clarification

### Completion criteria

* At least one seeded contradiction is detected.
* Contradictions do not silently become rules.

---

## Prompt 3 — Clarification generation

### Input

* Unverified rules
* Contradictions
* Unknowns
* Risk boundaries

### Output

* High-value questions
* Suggested answer types
* Evidence
* Reason each answer matters

### Completion criteria

* Questions are specific.
* Questions affect implementation.
* Duplicate questions are removed.

---

## Prompt 4 — Workflow specification

### Input

* Confirmed workflow
* Confirmed rules
* Approval policy
* Escalation conditions

### Output

* Typed runtime specification

### Completion criteria

* Specification is deterministic where possible.
* Ambiguous reasoning steps are clearly marked.
* Human approvals are explicit.

---

## Prompt 5 — Failure analysis

### Input

* Failed test
* Agent output
* Expected output
* Relevant rules
* Evidence

### Output

* Failure category
* Root cause
* Proposed correction
* Required clarification
* Regression test recommendation

### Completion criteria

* Code errors and policy errors are distinguished.
* Unsafe automatic repairs are rejected.

---

# 19. Testing Plan

## Frontend unit tests

Test:

* Workflow status rendering
* Event recording state
* Question answer validation
* Graph-node mapping
* Evaluation metric calculations
* Approval button states

## Backend unit tests

Test:

* Schema validation
* Workflow-version creation
* Rule updates
* Approval triggers
* Test-result comparison
* Build status transitions

## Runtime tests

Test:

* Allowed generated code executes.
* Prohibited imports fail.
* Prohibited function calls fail.
* Timeout is enforced.
* stdout and stderr are captured.
* pytest result parsing works.

## Integration tests

Test:

* Observation completion to workflow reconstruction
* Clarification answer to new workflow version
* Workflow build to runtime test
* Failed test to repair proposal
* Historical replay to dashboard
* Agent decision to approval request

## End-to-end tests

### E2E 1 — Full happy path

```text
Start demo
Complete observation
Generate workflow
Answer questions
Build agent
Run tests
Evaluate cases
Review approval
View impact
```

### E2E 2 — Model response failure

```text
Invalid AI output
→ schema validation error
→ retry
→ recoverable failure state
```

### E2E 3 — Generated-code rejection

```text
Generated code includes prohibited import
→ static validation fails
→ build marked failed
→ no execution occurs
```

### E2E 4 — Demo reset

```text
Modify project
→ reset demo
→ verify original seeded state
```

---

# 20. Security Checklist

* [ ] OpenAI key remains server-side
* [ ] Supabase service key remains server-side
* [ ] File types are validated
* [ ] File sizes are limited
* [ ] Filenames are sanitized
* [ ] Uploaded content is treated as untrusted
* [ ] Model outputs are schema-validated
* [ ] Generated code is AST-validated
* [ ] Network access is disabled for generated code
* [ ] Filesystem access is restricted
* [ ] Execution timeouts are enforced
* [ ] Real financial actions are not available
* [ ] Synthetic demo data is used
* [ ] Approval actions are logged
* [ ] Prompt versions are logged
* [ ] Secrets are absent from logs

---

# 21. Recommended Build Order

Implement in this exact order.

## Stage 1 — Make the demo visible

1. Repository setup
2. Database schema
3. Seed data
4. Invoice-review workspace
5. Observation timeline

At the end of this stage, the product should already look real.

## Stage 2 — Make the product intelligent

6. Workflow reconstruction
7. Contradiction detection
8. Clarification questions
9. Workflow versioning
10. Workflow graph

At the end of this stage, the core product idea should be understandable.

## Stage 3 — Make the output executable

11. Workflow specification
12. Code-generation templates
13. Build console
14. Static validation
15. Generated tests
16. Restricted execution

At the end of this stage, the product should visibly use Codex to build an agent.

## Stage 4 — Make the output trustworthy

17. Historical replay
18. Evaluation dashboard
19. Failure analysis
20. Rule repair
21. Regression test generation
22. Human approval

At the end of this stage, the product should demonstrate verification and safety.

## Stage 5 — Make the submission strong

23. Impact dashboard
24. Demo reset
25. Error states
26. Visual polish
27. README
28. Architecture diagram
29. Demo script
30. Deployment

---

# 22. Demo Script Implementation Requirements

The product must support this exact sequence.

## Scene 1 — Observe the expert

The expert reviews an invoice with:

```text
Invoice quantity: 98
Purchase-order quantity: 100
Quantity variance: 2%
Delivery confirmed: Yes
Invoice value: ₹425,000
```

The expert approves it.

The application records:

* Field comparisons
* Delivery check
* Approval-threshold check
* Final decision
* Narration

## Scene 2 — Discover hidden rules

GPT-5.6 extracts:

```text
Possible rule:
Quantity variance at or below 2% may be accepted.
```

It also identifies:

```text
SOP threshold: ₹300,000
Observed SME threshold: ₹500,000
```

## Scene 3 — Clarify

Ask:

```text
Which manager-approval threshold should the agent follow?
```

The SME confirms:

```text
₹500,000
```

Create a new workflow version.

## Scene 4 — Compile

Generate:

* Decision functions
* Approval policy
* Tests

Show a failed test:

```text
Quantity variance was accepted without delivery confirmation.
```

## Scene 5 — Repair

Ask:

```text
Should the 2% tolerance apply when delivery confirmation is missing?
```

SME answers:

```text
No
```

Rebuild.

Show all tests passing.

## Scene 6 — Run a new case

New case:

```text
Variance: 1.5%
Delivery confirmed: Yes
Invoice value: ₹725,000
```

Expected agent result:

```text
Manager approval required
```

## Scene 7 — Close

Show:

```text
Rules discovered: 11
Undocumented exceptions: 3
Tests passed: 12/12
Historical accuracy: 90%
Safe automation coverage: 70%
Estimated handling time: 18 min → 3 min
```

---


# 23. Extensibility Validation

## Goal

Prove that Tacit is not structurally coupled to invoice processing without building a second complete workflow.

## Placeholder workflow pack

Create a minimal non-invoice pack such as:

```text
customer_support_escalation
```

It only needs:

* Registration metadata
* Small input and outcome schemas
* Two workspace panels
* A small event catalog
* One approval rule
* Two evaluation fixtures

It does not need the full hackathon demo flow.

## Validation test

The placeholder pack should be loadable through the same:

* Project creation API
* Workflow-pack registry
* Observation shell
* Workflow reconstruction endpoint
* Workflow specification schema
* Build and evaluation infrastructure

## Acceptance criteria

* No invoice-specific code changes are required in core services.
* The placeholder pack can create a project and render its configured workspace.
* Core database tables remain unchanged.
* Shared APIs accept both workflow types.
* Workflow-pack-specific behavior is resolved through the registry.

This validation is an architectural test, not a second product demo.

---

# 24. Deferred Features

Do not start these until the core demo is complete.

## Deferred integration work

* Real ERP connectors
* Gmail integration
* Slack integration
* Browser extension
* Desktop recording
* OCR pipeline optimization
* Identity provider integration
* Webhook execution

## Deferred product work

* Multi-user workspaces
* Workflow sharing
* Workflow marketplace
* Advanced analytics
* Billing
* Role-based permissions
* Workflow scheduling
* Production monitoring
* Automated retraining
* Multi-language support

## Deferred AI work

* Continuous learning without approval
* Fully autonomous agent repair
* Cross-workflow knowledge transfer
* Large-scale process mining
* Multi-agent orchestration
* Automatic enterprise connector generation

---

# 25. Key Risks and Mitigations

## Risk: Model output is inconsistent

Mitigation:

* Structured output schemas
* Validation
* Retry once
* Seeded fallback results for demo
* Versioned prompts

## Risk: Generated code is unsafe

Mitigation:

* Narrow generated format
* AST validation
* Import allowlist
* No network
* No arbitrary filesystem access
* Timeout
* Restricted runtime

## Risk: Full desktop observation is too complex

Mitigation:

* Use a simulated invoice workspace
* Record structured events directly
* Support text narration
* Treat arbitrary desktop capture as future work

## Risk: Demo depends on live model latency

Mitigation:

* Stream progress
* Cache seeded outputs
* Provide recoverable fallback
* Keep prompts focused
* Minimize sequential calls

## Risk: Workflow graph becomes confusing

Mitigation:

* Limit graph to meaningful steps
* Group minor events
* Use clear node types
* Provide a simple linear default layout
* Show details in a side panel

## Risk: Invoice logic leaks into the core platform

Mitigation:

* Enforce the workflow-pack contract
* Keep invoice schemas and UI inside the invoice pack
* Use a registry instead of workflow-type conditionals
* Add architecture tests for a placeholder second workflow
* Reject invoice-specific fields in shared schemas

## Risk: Product feels like an SOP generator

Mitigation:

* Emphasize generated executable code
* Show failed test and repair
* Show historical replay
* Show human approval
* Show contradiction mining

## Risk: Impact claims appear exaggerated

Mitigation:

* Use synthetic but transparent measurements
* Label estimates clearly
* Show calculation assumptions
* Avoid unsupported financial claims

---

# 26. Final Release Checklist

## Application

* [ ] Seeded project loads
* [ ] Observation can be completed
* [ ] Events are persisted
* [ ] Timeline is understandable
* [ ] Workflow reconstructs
* [ ] Contradiction appears
* [ ] Questions can be answered
* [ ] Workflow version updates
* [ ] Graph updates
* [ ] Agent specification generates
* [ ] Build log streams
* [ ] Initial test failure appears
* [ ] Rule correction works
* [ ] Rebuild passes
* [ ] Ten historical cases replay
* [ ] Evaluation metrics display
* [ ] High-risk case requires approval
* [ ] Approval is persisted
* [ ] Impact metrics display
* [ ] Demo reset works

## Extensibility

* [ ] Invoice behavior is isolated in the invoice workflow pack
* [ ] Core schemas contain no invoice-specific fields
* [ ] Workflow-pack registry resolves domain behavior
* [ ] Placeholder second workflow pack loads
* [ ] Shared APIs work for both registered workflow types
* [ ] Generated output uses project and build directories rather than invoice-specific paths

## Engineering quality

* [ ] Type checking passes
* [ ] Linting passes
* [ ] Unit tests pass
* [ ] Integration tests pass
* [ ] E2E demo test passes
* [ ] Runtime security tests pass
* [ ] No secrets are committed
* [ ] `.env.example` is complete
* [ ] Database migrations work
* [ ] Seed script works
* [ ] Production build succeeds

## Documentation

* [ ] README is complete
* [ ] Architecture is documented
* [ ] Setup instructions are tested
* [ ] GPT-5.6 usage is explained
* [ ] Codex usage is explained
* [ ] Limitations are transparent
* [ ] Demo steps are documented
* [ ] Screenshots are added
* [ ] Repository is public
* [ ] License is included

## Submission preparation

* [ ] Three-minute script is finalized
* [ ] Demo is rehearsed
* [ ] Screen recording resolution is verified
* [ ] Audio is clear
* [ ] Product value is explained in first 20 seconds
* [ ] GPT-5.6 contribution is visible
* [ ] Codex contribution is visible
* [ ] Failed test and repair are shown
* [ ] Human approval is shown
* [ ] Final metrics are shown
* [ ] Submission links work

---

# 27. Definition of Hackathon Complete

The project is hackathon-complete when a judge can understand and observe the following within three minutes:

> An expert performs an invoice-review workflow using Tacit’s first workflow pack. Tacit’s generic core observes the work, discovers an undocumented rule, identifies a policy contradiction, asks the expert a targeted question, generates an executable agent, catches a failure through testing, updates the workflow, verifies the corrected agent against historical cases, and stops a high-value invoice for human approval.

Any feature that does not strengthen this story should be treated as secondary.