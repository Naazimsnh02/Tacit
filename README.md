# Tacit

<p align="center">
  <strong>Turn expert work into tested, reviewable AI agents.</strong>
</p>

<p align="center">
  Tacit observes how subject-matter experts complete business workflows, discovers hidden decision rules, asks targeted clarification questions, generates executable agents, and verifies them against historical cases.
</p>

<p align="center">
  <a href="#demo">Demo</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#hackathon-submission">Hackathon Submission</a>
</p>

<p align="center">
  <img alt="Hackathon" src="https://img.shields.io/badge/OpenAI-Build%20Week-111827?logo=openai&logoColor=white">
  <img alt="Track" src="https://img.shields.io/badge/Track-Work%20%26%20Productivity-2563EB">
  <img alt="GPT-5.6" src="https://img.shields.io/badge/Powered%20by-GPT--5.6-7C3AED">
  <img alt="Codex" src="https://img.shields.io/badge/Built%20with-Codex-0F172A">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-TypeScript-black?logo=next.js">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## Overview

Most business workflows are only partially documented. The critical logic often lives in expert judgment, exceptions, informal rules, email context, and approval habits.

Tacit helps teams capture that knowledge and convert it into a safe, testable automation workflow.

The core loop is:

```text
Observe
→ Reconstruct
→ Clarify
→ Compile
→ Test
→ Repair
→ Verify
→ Human approval
```

For the hackathon demo, Tacit uses **invoice exception review** as its first workflow pack. The underlying platform remains domain-agnostic so future workflow packs can support areas such as customer support, procurement, compliance, onboarding, claims, and operational approvals.

---

## Hackathon Track

**Work and Productivity**

Tacit helps teams document, automate, validate, and safely scale expert business processes.

---

## Problem

Traditional workflow automation usually starts with a written process document.

In practice:

- SOPs are incomplete or outdated
- Experts make undocumented decisions
- Exceptions are handled inconsistently
- Automation teams spend weeks interviewing stakeholders
- Generated agents are difficult to validate
- High-risk decisions require governance and human approval

Tacit starts with the work itself rather than assuming the process is already fully documented.

---

## Solution

Tacit records structured actions and expert narration while a workflow is performed.

GPT-5.6 then:

1. Reconstructs the workflow
2. Identifies hidden rules and exceptions
3. Detects contradictions between observed behavior and written policy
4. Generates high-value clarification questions
5. Recommends automation boundaries
6. Produces a structured workflow specification
7. Analyzes agent failures and proposes corrections

Codex then helps generate and refine:

- Typed workflow code
- Decision functions
- Validation logic
- Approval checkpoints
- Test fixtures
- Regression tests
- Runtime manifests

The generated agent is tested in a restricted runtime before it is considered ready.

---

## Features

### Observe expert work

- Simulated business workspace
- Structured action recording
- Narration capture
- Evidence references
- Activity timeline

### Discover tacit knowledge

- Workflow reconstruction
- Decision-rule extraction
- Exception detection
- Contradiction mining
- Evidence-backed reasoning

### Clarify uncertainty

- Adaptive SME questions
- Suggested answer types
- Rule-level evidence
- Workflow versioning
- AI-inferred versus SME-confirmed states

### Generate an executable agent

- Typed workflow specification
- Deterministic rule compilation
- Generated Python decision logic
- Generated tests
- Build progress console

### Verify before deployment

- Static code validation
- Restricted execution
- Historical replay
- Failure categorization
- Regression tests
- Confidence and evidence reporting

### Keep humans in control

- Approval thresholds
- Missing-evidence escalation
- Low-confidence review
- Policy-conflict handling
- Audit trail

### Measure impact

- Safe automation coverage
- Human-review rate
- Test pass rate
- Rules discovered
- Undocumented exceptions
- Estimated handling-time reduction

---

## Demo

The demo uses invoice exception review.

### Example workflow

1. An expert reviews an invoice
2. Tacit records the actions and narration
3. GPT-5.6 reconstructs the workflow
4. Tacit detects a policy contradiction
5. The expert answers a clarification question
6. Codex generates executable workflow logic and tests
7. One test fails because a hidden condition is missing
8. GPT-5.6 identifies the missing rule
9. Codex updates the implementation and regression test
10. Historical cases are replayed
11. A high-value invoice stops for human approval

### Demo data

The seeded dataset includes:

- Invoice records
- Purchase orders
- Delivery confirmations
- Vendor emails
- Approval matrix
- Written SOP
- Expert-labelled historical outcomes

### Seeded edge cases

- Exact invoice and purchase-order match
- Quantity variance within tolerance
- Quantity variance above tolerance
- Price mismatch
- Missing purchase order
- Missing delivery confirmation
- Duplicate invoice
- High-value invoice
- Conditional email approval
- Conflict between SOP and expert behavior

---

## Architecture

Tacit uses a generic core plus workflow packs.

```text
┌───────────────────────────────────────────────────────────┐
│                       Tacit Web App                       │
│ Observe │ Discover │ Workflow │ Build │ Test │ Approvals │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                    Generic Application API                │
│ Projects │ Sessions │ Evidence │ Builds │ Tests │ Audit  │
└───────────────┬────────────────────────┬──────────────────┘
                │                        │
┌───────────────▼─────────────┐  ┌───────▼─────────────────┐
│ Core Platform Services      │  │ Workflow Pack Registry  │
│ Observation                 │  │                         │
│ Reconstruction              │  │ invoice_exception       │
│ Clarification               │  │ future_workflow_pack    │
│ Versioning                  │  │ ...                     │
│ Evaluation                  │  └───────────┬─────────────┘
│ Approval and audit          │              │
└───────────────┬─────────────┘              │
                │                            │
        ┌───────▼─────────┐         ┌────────▼────────────┐
        │ OpenAI API      │         │ Pack-specific data │
        │ GPT-5.6         │         │ UI, schemas, tests │
        │ Codex           │         │ prompts, policies  │
        └───────┬─────────┘         └─────────────────────┘
                │
        ┌───────▼─────────────────────────────────────────┐
        │              Python Agent Runtime               │
        │ Compiler │ Validator │ Sandbox │ pytest │ Replay│
        └─────────────────────────────────────────────────┘
```

### Core platform responsibilities

- Projects
- Observation sessions
- Workflow events
- Evidence references
- Workflow versions
- Clarification
- Agent builds
- Evaluations
- Approvals
- Audit history
- Impact metrics

### Workflow pack responsibilities

- Domain input schemas
- Workspace configuration
- Supported actions
- Evidence types
- Prompt context
- Approval defaults
- Seed data
- Evaluation fixtures
- Domain-specific tests

Invoice-specific fields must not be added to generic core models.

---

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Flow
- TanStack Query
- Zod

### Backend

- Next.js route handlers
- FastAPI
- Python
- Pydantic
- PostgreSQL
- Supabase
- Server-Sent Events

### AI

- GPT-5.6 for workflow reasoning, clarification, evaluation, and failure analysis
- Codex for product implementation and executable agent generation
- OpenAI Responses API

### Runtime and testing

- Docker or restricted process execution
- Python AST validation
- pytest
- Vitest
- Playwright

---

## GPT-5.6 Usage

GPT-5.6 is used for the reasoning-heavy parts of Tacit:

- Reconstructing workflows from mixed evidence
- Extracting hidden decision rules
- Detecting contradictions
- Generating targeted SME questions
- Recommending safe automation boundaries
- Producing structured workflow specifications
- Comparing expected and actual outcomes
- Analyzing failed tests
- Explaining agent decisions

All model outputs used by application logic are validated with typed schemas.

Uploaded files, transcripts, emails, and SOPs are treated as untrusted content.

---

## Codex Usage

Codex accelerated both product development and the in-product agent-generation flow.

### Building Tacit

Codex was used to help:

- Scaffold the monorepo
- Implement UI components
- Create API routes
- Define shared schemas
- Write database migrations
- Build the workflow-pack registry
- Create tests
- Debug integration issues
- Review architecture
- Prepare deployment configuration

### Powering Tacit

Inside the product, Codex helps generate:

- Typed input models
- Decision functions
- Rule registries
- Approval policies
- Test fixtures
- pytest tests
- Runtime manifests
- Regression tests

Generated code is treated as untrusted and must pass validation before execution.

---

## Key Technical Decisions

### Generic core with workflow packs

Tacit separates platform concerns from domain-specific behavior. Invoice processing is the first workflow pack, not part of the shared core.

### Structured events over raw screen recordings

The hackathon implementation records structured user actions instead of relying on full desktop video interpretation.

### Deterministic logic where possible

Tacit uses normal code for numeric comparisons, required-field validation, threshold checks, duplicate detection, and state transitions.

GPT-5.6 is used where language understanding, ambiguity, and reasoning are required.

### Version every important change

A new workflow version is created when:

- A clarification answer changes a rule
- A contradiction is resolved
- A failed evaluation produces a correction
- Approval boundaries change
- Generated agent behavior changes

### Test before trust

Generated code must pass:

- Schema validation
- Static security checks
- Unit tests
- Historical replay
- Approval-boundary tests

---

## Repository Structure

```text
tacit/
├── apps/
│   ├── web/
│   └── agent-runtime/
├── packages/
│   ├── core-schemas/
│   ├── workflow-sdk/
│   ├── workflow-registry/
│   ├── prompts/
│   ├── config/
│   └── workflows/
│       ├── invoice-exception/
│       └── customer-support-escalation/
├── generated/
│   └── <project-id>/<build-id>/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── scripts/
├── tests/
├── AGENTS.md
├── idea.md
├── plan.md
├── implementation_plan.md
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

Install:

- Node.js 20 or later
- npm 10 or later
- Python 3.11 or later
- Docker Desktop
- Supabase project or local Supabase
- OpenAI API key

### Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd tacit
```

### Install JavaScript dependencies

```bash
npm install
```

### Install Python dependencies

```bash
cd apps/agent-runtime
python -m venv .venv
```

macOS or Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
cd ../..
```

### Configure environment variables

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Configure:

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

### Start supporting services

```bash
docker compose up -d
```

### Run database migrations

```bash
npm run db:migrate
```

### Load sample data

```bash
npm run seed
```

### Start development

```bash
npm run dev
```

In a second terminal:

```bash
npm run runtime:dev
```

Open:

```text
http://localhost:3000
```

---

## Quick Demo Setup

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run db:migrate
npm run seed
npm run dev
```

In another terminal:

```bash
npm run runtime:dev
```

Then select:

```text
Start guided demo
```

Reset the demo:

```bash
npm run demo:reset
```

---

## Available Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run seed
npm run demo:reset
npm run db:migrate
npm run runtime:dev
npm run runtime:test
```

Check `package.json` for the authoritative list.

---

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run runtime:test
npm run test:e2e
```

---

## Security

Tacit uses synthetic demo data only.

Security controls include:

- Server-side API keys
- File type and size validation
- Sanitized filenames
- Schema validation for model outputs
- Prompt-injection boundaries
- AST validation for generated Python
- Import allowlists
- No arbitrary network access
- No arbitrary filesystem access
- No process spawning
- Execution timeouts
- Human approval for high-risk outcomes
- Audit logging

Generated code must never:

- Install packages
- Read environment secrets
- Execute shell commands
- Access arbitrary files
- Connect to arbitrary endpoints
- Perform real financial actions

---

## Known Limitations

The hackathon version:

- Uses a simulated invoice-review workspace
- Uses synthetic data
- Does not connect to production ERP systems
- Does not perform real financial actions
- Supports one fully implemented workflow pack
- Includes only a lightweight placeholder second workflow pack
- Uses a constrained generated-code format
- Is a prototype, not a production deployment

---

## Roadmap

Potential workflow packs:

- Customer-support escalation
- Procurement exception review
- Compliance case handling
- Employee onboarding
- Insurance claims review
- Contract approval
- IT access requests
- Vendor risk review

Potential platform improvements:

- Real enterprise connectors
- Multi-user organizations
- Role-based access
- Production monitoring
- Workflow scheduling
- Advanced analytics
- Connector generation
- Cross-workflow knowledge reuse

---

## Hackathon Submission

### Category

**Work and Productivity**

### Project description

Tacit is a workflow-learning and agent-compilation platform that observes how experts perform business processes, discovers undocumented rules and exceptions, asks targeted clarification questions, generates executable workflow agents, and verifies them through automated tests and historical replay.

The demo focuses on invoice exception review while keeping the platform extensible through workflow packs.

### Working project

- Repository: `<PUBLIC_REPOSITORY_URL>`
- Demo instance: `<DEMO_URL>`
- Test account: `<OPTIONAL_TEST_ACCOUNT>`
- Demo reset: `npm run demo:reset`

### Demo video

Requirements:

- Public YouTube URL
- Under three minutes
- Functioning project shown
- Audio included
- GPT-5.6 usage explained
- Codex usage explained

Video URL:

```text
<YOUTUBE_DEMO_URL>
```

### Suggested three-minute flow

```text
0:00–0:20  Explain the problem
0:20–0:50  Observe the expert workflow
0:50–1:15  Show discovered rules and contradiction
1:15–1:45  Build the agent and show a failed test
1:45–2:20  Repair and run a new case
2:20–2:45  Show replay and approval
2:45–3:00  Close with impact
```

### Codex acceleration

Highlight:

- Repository scaffolding
- Workflow-pack architecture
- Shared schemas
- Database migrations
- UI implementation
- Agent runtime
- Generated workflow logic
- Generated tests
- Failure repair
- Code review and debugging

### Key decisions

Highlight:

- Generic core plus workflow packs
- Structured events instead of desktop video
- Deterministic logic where possible
- Restricted generated-code execution
- Evidence-backed decisions
- Historical replay before trust
- Human approval for high-risk cases

### GPT-5.6 usage

Highlight:

- Workflow reconstruction
- Hidden-rule extraction
- Contradiction detection
- SME clarification
- Automation-boundary recommendations
- Failure analysis
- Decision explanation

### Codex feedback session

Feedback upload completed.

```text
Thread ID:
019f6550-4f79-7ea1-bfcb-0ff381635ee5, 019f656f-697c-7372-9ebe-e20acad2dec6
```

Use the relevant `/feedback` Codex Session ID in the Devpost submission form.

### Repository access

The repository must be:

- Public with a relevant license, or
- Private and shared with:
  - `testing@devpost.com`
  - `build-week-event@openai.com`

### Required repository contents

- Setup instructions
- Environment-variable guidance
- Sample data
- Demo instructions
- Test commands
- Architecture documentation
- License
- GPT-5.6 usage
- Codex usage
- Known limitations

---

## Submission Checklist

### Project

- [ ] Working project
- [ ] Work and Productivity category selected
- [ ] Clear project description
- [ ] Public demo URL or reproducible setup
- [ ] Sample data included
- [ ] Demo reset works
- [ ] Public or judge-accessible repository
- [ ] Relevant license included

### Video

- [ ] Public YouTube video
- [ ] Under three minutes
- [ ] Working product shown
- [ ] Audio included
- [ ] GPT-5.6 usage explained
- [ ] Codex usage explained
- [ ] Failed test and repair shown
- [ ] Human approval shown

### Documentation

- [ ] Setup instructions verified
- [ ] Supported platforms documented
- [ ] Environment variables documented
- [ ] Test commands documented
- [ ] Architecture explained
- [ ] Sample data documented
- [ ] Known limitations documented
- [ ] Security boundaries documented

### Codex evidence

- [ ] Codex contribution documented
- [ ] Key technical decisions documented
- [ ] `/feedback` submitted
- [ ] Session or Thread ID added to Devpost
- [ ] Relevant Codex logs retained

---

## Supported Platforms

- Windows 11
- macOS
- Linux
- Docker Desktop
- Modern Chromium-based browsers

---

## Judge Testing Guide

1. Clone the repository
2. Configure `.env.local`
3. Start Docker services
4. Run migrations
5. Load seed data
6. Start the web app and runtime
7. Open the guided demo
8. Complete the observation
9. Generate the workflow
10. Answer the clarification
11. Build the agent
12. Run historical replay
13. Inspect the human approval case

Provide a hosted demo URL when available so judges can test Tacit without rebuilding it.

---

## License

This project is licensed under the MIT License.

See `LICENSE` for details.

---

## Acknowledgements

Built for OpenAI Build Week using:

- GPT-5.6
- Codex
- OpenAI Responses API
- Next.js
- FastAPI
- Supabase
- React Flow

---

## Contact

Project author:

```text
<YOUR_NAME>
<YOUR_EMAIL_OR_PROFILE>
```

Project links:

- Repository: `<REPOSITORY_URL>`
- Demo: `<DEMO_URL>`
- Video: `<YOUTUBE_URL>`