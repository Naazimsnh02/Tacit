# Tacit — Hackathon Build Plan

Build a **focused prototype of Tacit: a domain-agnostic platform that observes expert work, extracts hidden decision rules, generates an executable agent, and verifies it against new cases**.

For the hackathon, use **invoice-exception handling as the first workflow pack and demo scenario**. It provides documents, business rules, judgment, human approvals, and measurable time savings without requiring access to real enterprise systems.

The architecture must keep the Tacit core reusable. Invoice-specific schemas, UI panels, prompts, policies, sample data, and tests should live inside a dedicated workflow pack rather than inside shared platform services.

OpenAI currently offers GPT-5.6 as three API variants: **Sol** for maximum capability, **Terra** for a balance of intelligence and cost, and **Luna** for efficient high-volume work. GPT-5.6 is available through the Responses API, while Codex should be used visibly throughout development and agent generation. ([OpenAI][1])

## Core architecture principle

Tacit should be structured as:

```text
Generic Core Platform
+ Workflow Pack Registry
+ Invoice Exception Workflow Pack
```

The generic core owns observation, evidence, workflow reconstruction, clarification, versioning, compilation, testing, approvals, audit, and evaluation.

Each workflow pack owns its domain schemas, workspace definition, supported actions, evidence types, prompt context, policies, seed data, and evaluation fixtures.

Avoid spreading checks such as `workflowType === "invoice_exception"` throughout the codebase. Resolve domain behavior through the workflow-pack registry.

---

# 1. Recommended tech stack

## Frontend

| Technology         | Purpose                                  |
| ------------------ | ---------------------------------------- |
| **Next.js 15+**    | Full-stack application framework         |
| **TypeScript**     | Typed frontend and backend code          |
| **Tailwind CSS**   | Rapid UI styling                         |
| **shadcn/ui**      | Dashboard components                     |
| **React Flow**     | Visual workflow and decision graph       |
| **TanStack Query** | API state and polling                    |
| **Zod**            | Validate AI-generated structured outputs |

Use a desktop-first dashboard. Do not spend time building mobile layouts beyond basic responsiveness.

### Main UI screens

1. Projects dashboard
2. Workflow recording/import screen
3. AI clarification interview
4. Generated workflow map
5. Agent build console
6. Test and replay screen
7. Human approval screen
8. Results and impact dashboard

---

## Backend

| Technology                            | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| **Next.js API routes** or **FastAPI** | Application APIs                                     |
| **Python**                            | Document processing and generated workflow execution |
| **PostgreSQL**                        | Workflow, rules, sessions and evaluation data        |
| **Supabase**                          | Hosted Postgres, storage and optional authentication |
| **Redis / Upstash**                   | Optional job status and event streaming              |
| **SSE**                               | Stream agent activity to the UI                      |
| **Docker**                            | Isolated workflow execution                          |

### Recommendation

Use:

* Next.js for the frontend and normal APIs
* A small Python FastAPI service for document extraction and agent execution
* Supabase for database and file storage

This separation makes it easier to demonstrate Codex generating Python automation logic while keeping the product interface in TypeScript.

---

## File, evidence, and document processing

The core platform should accept generic evidence records. The invoice workflow pack maps its domain inputs into that model.

| Evidence type      | Invoice-pack implementation                                    |
| ------------------ | -------------------------------------------------------------- |
| Invoice PDFs       | PyMuPDF or OpenAI multimodal input                             |
| Purchase-order CSV | Pandas                                                         |
| Email evidence     | Sample `.eml`, plain text or simulated inbox                   |
| Expert narration   | Browser microphone and transcription                           |
| Screen actions     | Structured event recorder rather than full video understanding |
| SOP document       | PDF or Markdown upload                                         |

For the hackathon, avoid full operating-system screen recording. Simulate enterprise applications inside your product and record actions as structured events.

For example:

```json
{
  "timestamp": "2026-07-17T10:32:15Z",
  "application": "purchase_order_system",
  "action": "view_record",
  "entity_id": "PO-1042",
  "fields_viewed": [
    "approved_quantity",
    "unit_price",
    "delivery_status"
  ]
}
```

This is more reliable and easier to interpret than attempting to understand raw desktop video.

---

# 2. AI model strategy

Do not use the strongest model for every operation. Give each model a clear role.

## GPT-5.6 Sol

Use Sol for the hardest reasoning operations:

* Reconstructing workflows from mixed evidence
* Finding undocumented decisions
* Identifying contradictions
* Generating adaptive SME questions
* Converting demonstrations into decision rules
* Reviewing agent failures
* Determining safe automation boundaries

Example task:

> Compare the SME’s narration, observed actions, SOP and historical outcomes. Identify decisions that cannot yet be explained as deterministic rules.

Sol should be the **workflow intelligence layer**.

---

## GPT-5.6 Terra

Use Terra for normal application intelligence:

* Summarizing recorded sessions
* Classifying workflow steps
* Extracting entities and fields
* Producing UI explanations
* Generating test cases
* Comparing expected and actual actions
* Formatting the final workflow specification

Terra should handle most requests because it balances reasoning quality and cost. OpenAI describes Terra as the middle option between maximum capability and high-volume efficiency. ([OpenAI][1])

---

## GPT-5.6 Luna

Use Luna for inexpensive repetitive operations:

* Labelling individual events
* Extracting fields from simple records
* Categorizing steps
* Generating short descriptions
* Processing batches of historical cases
* Basic validation

For a hackathon prototype, Luna is optional. You could use Terra for everything except the most difficult Sol calls.

---

## Codex

Codex plays two distinct roles.

### Role 1: Build the product

Use Codex to:

* Scaffold the repository
* Build UI components
* Create APIs
* Write database migrations
* Implement workflow execution
* Generate unit tests
* Debug the demo
* Review the repository
* Prepare deployment files

Codex is designed to complete coding tasks such as implementing features, fixing bugs, reviewing repositories and proposing changes. ([OpenAI][2])

### Role 2: Power the product experience

Inside Tacit, present Codex as the **agent builder**.

Once GPT-5.6 creates a workflow specification, Codex generates:

* Python actions
* Decision functions
* Connector adapters
* Validation rules
* Test fixtures
* Unit tests
* Execution manifests
* Human-approval checkpoints

Conceptually:

```text
SME demonstration
        ↓
GPT-5.6 creates workflow specification
        ↓
Codex generates executable implementation
        ↓
Sandbox runs generated tests
        ↓
GPT-5.6 analyzes failures
        ↓
Codex repairs implementation
```

This creates a much stronger hackathon story than saying Codex was only used to write the project.

---

## OpenAI API

Use the **Responses API**, not the deprecated Assistants API. OpenAI’s documentation identifies the Responses API as the current interface for agentic model interactions. ([OpenAI Platform][3])

Create one server-side abstraction:

```ts
type ModelRole =
  | "workflow_reasoning"
  | "event_extraction"
  | "clarification"
  | "evaluation"
  | "explanation";

async function runModel(
  role: ModelRole,
  input: unknown
): Promise<unknown> {
  // Resolve GPT-5.6 variant from environment configuration.
}
```

Keep model names in environment variables:

```bash
OPENAI_REASONING_MODEL=<GPT-5.6 Sol model available to your account>
OPENAI_DEFAULT_MODEL=<GPT-5.6 Terra model available to your account>
OPENAI_FAST_MODEL=<GPT-5.6 Luna model available to your account>
```

This prevents the project from breaking if API identifiers differ from marketing names or account availability.

---

# 3. Product architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Tacit Web App                         │
│ Projects │ Observe │ Discover │ Workflow │ Build │ Test    │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                    Generic Application API                   │
│ Sessions │ Evidence │ Workflows │ Builds │ Tests │ Approval │
└───────────────┬───────────────────────┬──────────────────────┘
                │                       │
┌───────────────▼─────────────┐  ┌──────▼─────────────────────┐
│ Core Platform Services      │  │ Workflow Pack Registry     │
│ Observation                 │  │                            │
│ Reconstruction              │  │ invoice_exception          │
│ Clarification               │  │ future_workflow_pack       │
│ Versioning                  │  │ ...                        │
│ Evaluation                  │  └───────────┬────────────────┘
│ Approval and audit          │              │
└───────────────┬─────────────┘              │
                │                            │
        ┌───────▼────────┐          ┌────────▼───────────────┐
        │ OpenAI API     │          │ Workflow-pack assets   │
        │ GPT-5.6 roles  │          │ Schemas, UI, prompts,  │
        │ and Codex      │          │ policies, tests, data  │
        └───────┬────────┘          └────────────────────────┘
                │
        ┌───────▼────────────────────────────────────────────┐
        │             Workflow Compilation Layer             │
        │ Spec → Code → Tests → Validation → Manifest       │
        └───────┬────────────────────────────────────────────┘
                │
        ┌───────▼────────────────────────────────────────────┐
        │                Sandbox Executor                    │
        │ Docker │ Logs │ Assertions │ Safe Actions         │
        └────────────────────────────────────────────────────┘
```

## Workflow-pack interface

Use a registered definition instead of hard-coded invoice behavior:

```ts
interface WorkflowPack {
  id: string;
  name: string;
  version: string;
  inputSchema: unknown;
  outcomeSchema: unknown;
  workspace: WorkspaceDefinition;
  supportedActions: string[];
  evidenceTypes: EvidenceTypeDefinition[];
  approvalPolicy: ApprovalPolicyDefinition;
  evaluation: EvaluationDefinition;
  promptContext: PromptContext;
}
```

The invoice exception workflow is the first implementation of this interface.

---

# 4. Core data objects

You need a small set of generic platform entities plus one workflow-pack definition.

## Project

```ts
interface Project {
  id: string;
  name: string;
  workflowType: string;
  workflowPackVersion: string;
  status:
    | "recording"
    | "clarifying"
    | "compiled"
    | "testing"
    | "ready";
}
```

## Workflow pack

```ts
interface WorkflowPack {
  id: string;
  name: string;
  version: string;
  inputSchema: unknown;
  outcomeSchema: unknown;
  workspace: WorkspaceDefinition;
  supportedActions: string[];
  evidenceTypes: EvidenceTypeDefinition[];
  approvalPolicy: ApprovalPolicyDefinition;
  evaluation: EvaluationDefinition;
  promptContext: PromptContext;
}
```

## Observation session

```ts
interface ObservationSession {
  id: string;
  projectId: string;
  transcript: string;
  events: WorkflowEvent[];
  uploadedFiles: UploadedFile[];
}
```

## Workflow event

```ts
interface WorkflowEvent {
  timestamp: string;
  application: string;
  action: string;
  entityType?: string;
  entityId?: string;
  evidenceIds?: string[];
  before?: unknown;
  after?: unknown;
  narration?: string;
}
```

## Decision rule

```ts
interface DecisionRule {
  id: string;
  description: string;
  condition: string;
  action: string;
  confidence: number;
  sourceEvidenceIds: string[];
  verificationStatus:
    | "unverified"
    | "confirmed_by_sme"
    | "validated_by_examples";
}
```

## Clarification question

```ts
interface ClarificationQuestion {
  question: string;
  evidence: string[];
  reason: string;
  answer?: string;
}
```

## Agent specification

```ts
interface AgentSpecification {
  inputs: InputDefinition[];
  steps: WorkflowStep[];
  rules: DecisionRule[];
  approvalPolicy: ApprovalPolicy;
  outputSchema: Record<string, unknown>;
}
```

## Shared-model rule

Do not add invoice-specific fields such as `invoiceNumber`, `purchaseOrderId`, or `quantityVariance` to shared platform entities. Store workflow-specific payloads as pack-validated data.

## Evaluation result

```ts
interface EvaluationResult {
  caseId: string;
  expectedAction: string;
  actualAction: string;
  result:
    | "exact_match"
    | "acceptable"
    | "incorrect"
    | "needs_review";
  evidence: string[];
}
```

---

# 5. What you need to build

## P0 — Must-have demo components

These are essential. Finish these before adding anything else. Build them on generic platform services, while keeping invoice-specific behavior in the invoice workflow pack.

### 1. Configurable observation shell with invoice demonstration

Create a reusable observation shell with:

* Session controls
* Narration capture
* Structured event recording
* Evidence selection
* Decision submission
* Timeline integration

Configure the invoice workflow pack to render:

* Invoice viewer
* Purchase-order record
* Delivery record
* Vendor email
* Approval matrix
* Decision form

The SME performs the workflow and narrates their thinking.

Record every significant action:

* Opened invoice
* Compared quantity
* Checked purchase order
* Read vendor email
* Checked delivery
* Selected approve, reject or escalate

You do not need to capture arbitrary external websites.

---

### 2. Observation timeline

Display the captured activity as an understandable timeline:

```text
10:02 Opened invoice INV-284
10:03 Compared quantity with PO-1042
10:04 Found a 1.7% quantity mismatch
10:05 Checked delivery confirmation
10:06 Approved using tolerance rule
```

This makes the AI’s source context visible.

---

### 3. Workflow extraction

Send the transcript, events, pack-validated evidence, and workflow-pack prompt context to GPT-5.6.

Generate:

* Workflow objective
* Inputs
* Steps
* Decisions
* Rules
* Exceptions
* Required approvals
* Unknowns
* Possible contradictions

Return strict structured JSON validated with Zod.

---

### 4. AI clarification interview

Generate three to five high-value questions.

Examples:

> You approved a 1.7% quantity mismatch. Should every mismatch below 2% be approved?

> Does the tolerance rule apply when the vendor has no delivery confirmation?

> You mentioned manager approval above ₹5 lakh, but the SOP says ₹3 lakh. Which threshold is current?

Let the user answer with simple buttons or text.

The system updates the rules immediately.

---

### 5. Interactive workflow graph

Use React Flow to show:

```text
Receive invoice
      ↓
Match purchase order
      ↓
Is quantity variance ≤ 2%?
   ↙ Yes                 No ↘
Check delivery           Escalate
      ↓
Is value above threshold?
   ↙ No                  Yes ↘
Approve                 Manager review
```

Colour or badge nodes by type:

* Action
* AI judgment
* Deterministic rule
* Human approval
* Exception

The graph is one of the demo’s strongest visual elements.

---

### 6. Automation-boundary recommendation

For each step, classify it as:

* Fully automated
* AI prepared, human approved
* Human required
* Unsupported

Example:

| Step                    | Recommendation | Reason                    |
| ----------------------- | -------------- | ------------------------- |
| Extract invoice         | Automate       | Structured extraction     |
| Match PO                | Automate       | Deterministic identifiers |
| Interpret vendor email  | AI + review    | Language ambiguity        |
| Approve high-value case | Human required | Financial control         |
| Create audit log        | Automate       | Deterministic output      |

---

### 7. Agent specification

Generate a downloadable or visible generic workflow specification populated by the invoice workflow pack.

```yaml
name: invoice_exception_agent

inputs:
  - invoice
  - purchase_order
  - delivery_record
  - vendor_email

rules:
  - id: quantity_tolerance
    condition: quantity_variance_percent <= 2
    requires:
      - delivery_confirmed
    action: continue_review

  - id: high_value_approval
    condition: invoice_value_inr > 500000
    action: request_manager_approval

escalate_when:
  - required_document_missing
  - confidence < 0.90
  - conflicting_approval_rules
```

---

### 8. Codex build console

Show an animated but truthful build log:

```text
Inspecting workflow specification
Generating invoice parser
Generating purchase-order matcher
Creating decision engine
Creating 12 evaluation fixtures
Running tests

11 tests passed
1 test failed:
Missing delivery confirmation was incorrectly approved

Updating quantity-tolerance rule
Running tests again

12 tests passed
Agent ready
```

The log must be based on real backend actions, even if the generated system is intentionally constrained.

---

### 9. Executable generated agent

The generated agent should receive a pack-validated case and return a generic decision result. For the invoice demo, it should output:

* Recommended action
* Confidence
* Rules used
* Evidence
* Missing information
* Required approval
* Explanation

Example:

```json
{
  "recommendation": "request_manager_approval",
  "confidence": 0.94,
  "reason": "The quantity variance is within tolerance, but the invoice value exceeds the SME-confirmed approval threshold.",
  "rules_applied": [
    "quantity_tolerance",
    "high_value_approval"
  ],
  "evidence": [
    "Invoice total: ₹725,000",
    "Quantity variance: 1.4%",
    "Delivery confirmed: yes"
  ]
}
```

---

### 10. Historical replay evaluation

Provide five to ten prepared cases.

Compare the agent’s action with the expert-labelled expected result.

Dashboard:

```text
Cases tested                 10
Exact matches                 8
Correct escalations           1
Incorrect decisions           1
Safe automation coverage     70%
Human-review rate            30%
```

Select the failed case and show how it becomes:

1. A clarification question
2. A new rule
3. A new test
4. A passing result

That improvement loop will be the most compelling part of the demonstration.

---

### 11. Human approval step

For a high-risk case, the system must stop.

Display:

```text
Human approval required

Reason:
Invoice exceeds the ₹500,000 approval threshold.

Agent recommendation:
Approve after manager confirmation.

[Approve] [Reject] [Request more information]
```

This makes the product appear enterprise-ready and responsible.

---

### 12. Impact dashboard

Show simple, believable metrics:

* Manual handling time
* Automated handling time
* Steps discovered
* Undocumented rules found
* Safe automation coverage
* Human-review percentage
* Test pass rate
* Estimated monthly hours saved

Do not invent huge financial savings. Use measured values from your controlled test cases.

---

# 6. Invoice workflow-pack seed data

Prepare the first workflow pack around one expert session and approximately ten invoice cases. Keep these assets inside the invoice workflow-pack directory.

## Files

* One written SOP
* Ten invoice PDFs
* Ten purchase-order records
* Ten delivery records
* Five vendor email messages
* One approval matrix
* Expected decision for each case

## Include these edge cases

1. Exact invoice and PO match
2. Quantity variance below 2%
3. Quantity variance above 2%
4. Price mismatch
5. Missing purchase order
6. Missing delivery confirmation
7. Duplicate invoice number
8. Invoice above manager threshold
9. Conditional approval in an email
10. Conflicting SOP and SME rule

Case 10 lets you demonstrate contradiction mining.

---

# 7. Suggested database tables

Keep the database small and domain-neutral.

Do not add invoice-specific columns to shared tables. Store workflow-specific payloads as validated JSON tied to a workflow-pack and schema version.

Suggested tables:

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
approval_actions
```

Version the workflow whenever an answer changes a rule:

```text
Workflow v1
Initial extraction

Workflow v2
Added 2% quantity-tolerance condition

Workflow v3
Added delivery-confirmation requirement
```

That gives you a credible governance story.

---

# 8. Repository structure

```text
tacit/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── lib/
│   └── agent-runtime/
│       ├── api/
│       ├── compiler/
│       ├── executor/
│       └── evaluators/
├── packages/
│   ├── core-schemas/
│   ├── workflow-sdk/
│   ├── workflow-registry/
│   ├── prompts/
│   ├── config/
│   └── workflows/
│       ├── invoice-exception/
│       │   ├── schemas/
│       │   ├── workspace/
│       │   ├── prompts/
│       │   ├── policies/
│       │   ├── sample-data/
│       │   └── tests/
│       └── customer-support-escalation/
│           └── placeholder/
├── generated/
│   └── <project-id>/<build-id>/
├── tests/
├── AGENTS.md
├── docker-compose.yml
└── README.md
```

Add a strong `AGENTS.md` that tells Codex:

* Generic core versus workflow-pack boundaries
* Project architecture
* Coding conventions
* Validation requirements
* Commands to run
* Definition of done
* Security restrictions
* Files Codex may generate
* Tests required for every change

OpenAI has described using `AGENTS.md`, repository structure, tests and agent-readable guidance as important elements of agent-first engineering with Codex. ([OpenAI][4])

---

# 9. AI prompts you need

Create five prompts rather than one giant prompt.

## Prompt A — Workflow reconstruction

Input:

* Transcript
* Structured actions
* Pack-validated evidence
* Workflow-pack prompt context
* Final decision

Output:

* Steps
* Decisions
* Rules
* Exceptions
* Unknowns

## Prompt B — Contradiction detection

Compare:

* SOP
* Narration
* Actual behaviour
* Historical examples

Output:

* Contradictions
* Severity
* Evidence
* Clarification required

## Prompt C — SME interview

Generate only questions that materially affect:

* Safety
* Accuracy
* Automation coverage
* Approval boundaries

## Prompt D — Agent specification

Convert confirmed knowledge into a typed executable workflow specification.

## Prompt E — Failure analysis

Given a failed test:

* Explain the failure
* Identify whether the problem is code, knowledge or ambiguous policy
* Propose a fix
* Generate a regression test

---

# 10. What not to build during the hackathon

Skip these unless all P0 features are complete:

* Real Salesforce integration
* Real SAP integration
* Arbitrary desktop control
* Chrome extension
* Multi-user organizations
* Billing
* Full permissions system
* Workflow marketplace
* Vector database
* Complex RAG infrastructure
* Slack integration
* A second fully implemented business workflow
* Autonomous execution of real financial actions

Your product can show mocked connectors labelled clearly as demo integrations.

Create only a minimal placeholder second workflow pack to verify that the platform is extensible. Do not spend demo time implementing its full business flow.

---

# 11. Development sequence

## Phase 1 — Demo foundation

* Create Next.js application
* Define the workflow-pack interface and registry
* Build the reusable observation shell
* Configure the invoice workspace
* Create sample data
* Record structured actions
* Store observation session

## Phase 2 — Intelligence

* Implement GPT-5.6 workflow extraction
* Add structured output validation
* Generate clarification questions
* Update rules from SME responses
* Render workflow graph

## Phase 3 — Compilation

* Define workflow specification schema
* Generate Python decision functions
* Generate tests
* Run generated code in sandbox
* Stream build logs

## Phase 4 — Verification

* Create historical test cases
* Build replay runner
* Compare expected and actual decisions
* Implement failure-to-clarification loop
* Add approval checkpoint

## Phase 5 — Presentation

* Polish the core screens
* Add seeded demo reset
* Add loading and error states
* Write README
* Record Codex contribution
* Prepare submission video

---

# 12. Three-minute demo script

The official rules require footage of the functioning project, audio explaining what was built and how GPT-5.6 and Codex were used, with judges not required to watch beyond three minutes. ([OpenAI Build Week][5])

## 0:00–0:20 — Problem

> Companies want to automate expert workflows, but the important rules are rarely written down. They live in employee judgment, exceptions and workarounds.

## 0:20–0:50 — Observe

Perform the invoice-review workflow.

Show that Tacit records actions and narration.

## 0:50–1:15 — Discover hidden knowledge

Show the extracted workflow and contradiction:

> The SOP requires approval above ₹300,000, but the expert used ₹500,000.

Answer the generated clarification question.

## 1:15–1:45 — Compile

Press **Build Agent**.

Show Codex generating:

* Workflow code
* Tests
* Approval policy
* Audit logic

Show one failed test and automatic repair.

## 1:45–2:20 — Run new case

Upload a new invoice.

Show the agent:

* Applying the learned rules
* Citing evidence
* Stopping for manager approval

## 2:20–2:45 — Verification

Show historical replay:

```text
10 cases
9 correct
1 policy conflict discovered
70% safe automation coverage
```

## 2:45–3:00 — Close

> Tacit turns real expert work into tested, reviewable agents—allowing one AI engineer to scale across many subject-matter experts.

---

# 13. Final MVP checklist

## Product

* [ ] Simulated invoice-review workspace
* [ ] SME narration capture
* [ ] Structured action recording
* [ ] Observation timeline
* [ ] GPT-5.6 workflow extraction
* [ ] Contradiction detection
* [ ] Adaptive clarification interview
* [ ] Workflow graph
* [ ] Automation-boundary classification
* [ ] Agent specification
* [ ] Codex generation console
* [ ] Executable invoice agent
* [ ] Historical replay
* [ ] Failure repair loop
* [ ] Human approval screen
* [ ] Impact dashboard
* [ ] Demo reset button

## Extensibility

* [ ] Generic core contains no invoice-specific fields
* [ ] Invoice behavior is isolated in a workflow pack
* [ ] Workflow-pack registry resolves schemas, UI, prompts, policies, and evaluation
* [ ] Observation shell is configurable
* [ ] Generated output uses project/build paths
* [ ] Minimal second workflow pack can register and render

## Engineering

* [ ] OpenAI Responses API
* [ ] Structured output validation
* [ ] Model names configured through environment variables
* [ ] Database migrations
* [ ] Seed script
* [ ] Generated-code sandbox
* [ ] Unit tests
* [ ] Error handling
* [ ] Streaming progress
* [ ] Deployment configuration
* [ ] Public repository
* [ ] Clear README

## Submission

* [ ] Explain the business problem
* [ ] Explain the GPT-5.6 role
* [ ] Explain the Codex role
* [ ] Show the functioning application
* [ ] Show a real test failure and repair
* [ ] Document important Codex sessions
* [ ] Include setup instructions
* [ ] Record a public video under three minutes
* [ ] Verify the demo from a fresh browser
* [ ] Submit before the Devpost deadline

# Recommended final stack

```text
Architecture:
Generic Tacit core + workflow-pack registry + invoice exception workflow pack

Frontend:
Next.js + TypeScript + Tailwind + shadcn/ui + React Flow

Backend:
Next.js APIs + Python FastAPI agent runtime

Database and storage:
Supabase PostgreSQL + Supabase Storage

AI:
GPT-5.6 Sol — workflow reasoning and contradiction analysis
GPT-5.6 Terra — extraction, evaluation and explanations
GPT-5.6 Luna — optional batch classification
Codex — product development and executable agent generation

Execution:
Docker sandbox + Python + pytest

Deployment:
Vercel for web
Railway, Render or Fly.io for Python runtime
Supabase for database and files

Observability:
Structured JSON logs + SSE progress stream
```

The most important implementation priority is this loop:

> **Observe → question → compile → test → fail → clarify → repair → verify**

A complete version of that single loop, implemented through a reusable core and one polished workflow pack, will be more competitive than a broad platform with several unfinished integrations.

[1]: https://openai.com/index/gpt-5-6/?utm_source=chatgpt.com "GPT-5.6: Frontier intelligence that scales with your ambition"
[2]: https://openai.com/index/introducing-codex/?utm_source=chatgpt.com "Introducing Codex"
[3]: https://platform.openai.com/docs/api-reference/run-steps/listRunSteps?utm_source=chatgpt.com "List run steps | OpenAI API Reference"
[4]: https://openai.com/index/harness-engineering/?utm_source=chatgpt.com "Harness engineering: leveraging Codex in an agent-first ..."
[5]: https://openai.devpost.com/rules?utm_source=chatgpt.com "OpenAI Build Week(the “Hackathon”) Official Rules - Devpost"