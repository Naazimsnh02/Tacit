Uber recently introduced **“Agentic Pods.”** It selected roughly 30 AI-proficient engineers and paired each one with a domain expert from functions such as finance, legal, HR, operations and marketing. Each pair received a two-week sprint to observe the real workflow and build an agent alongside the employee performing it. ([X (formerly Twitter)][1])

The process reportedly looked like this:

* **Days 1–2:** Shadow the domain expert, document every step and ask questions.
* **Day 3:** Rank opportunities based on repetition, scale, business impact and data availability.
* **Days 4–5:** Build a working agent together.
* **Remaining time:** Test it against real scenarios, improve it and prepare deployment.

Uber says this approach reduced some financial reports from two days to around ten minutes, while a capital-allocation process covering 150 cities fell from approximately 15 hours to 30 minutes. Uber had conducted 16 pods over the preceding two months and was forming a dedicated team to scale the model. ([Business Insider][2])

The most important insight from Uber’s CTO was that these workflows cannot be understood only from SOPs and process diagrams. Engineers have to observe how the work is actually performed, including undocumented judgment, workarounds and exceptions. ([Business Insider][2])

That is exactly the opening for **Tacit**.

# The better version of Tacit

Do not build a product that merely converts a recorded interview into an SOP.

Build:

> **An AI forward-deployed engineer that shadows a subject-matter expert, discovers the real workflow, and produces a tested automation prototype.**

The product automates much of what Uber currently needs a highly skilled AI engineer to do manually.

## Core concept

### Tacit

**From work observation to a verified agent**

A subject-matter expert shares their screen and completes a real task while explaining what they are doing. Tacit observes:

* Applications opened
* Pages visited
* Fields read
* Files consulted
* Data copied between systems
* Decisions made
* Questions asked of colleagues
* Exceptions encountered
* Final outputs produced

It then reconstructs the workflow as a structured, testable process.

The output is not just documentation. It creates:

1. A workflow map
2. A decision graph
3. A list of required integrations
4. An automation opportunity score
5. A working agent prototype
6. Tests generated from observed examples
7. A human-review and escalation policy
8. An editable “skill” containing the expert’s knowledge

# The automated Agentic Pod

The product can turn Uber’s two-week pod process into a software-guided workflow.

## Phase 1: Observe

The SME performs the task normally using screen sharing or a browser extension.

Tacit records an event stream such as:

```text
09:02 Opened weekly sales spreadsheet
09:03 Filtered region = South
09:04 Opened Salesforce opportunity
09:05 Compared close date with contract email
09:07 Changed forecast category to Commit
09:08 Added note: “Legal approval received”
```

The model should not rely only on the narration. It compares three evidence channels:

* What the expert said
* What the expert actually did
* What changed in the underlying data

This is critical because people often describe the official procedure while performing a different practical procedure.

## Phase 2: Interrogate

After observing the task, Tacit conducts an adaptive interview.

Instead of generic questions, it asks questions grounded in specific moments:

> “At 09:05, you changed the forecast from Best Case to Commit after reading an email. Which exact sentence made that decision safe?”

> “You skipped the approval check for accounts below ₹5 lakh. Is that an official rule or your personal shortcut?”

> “What would you have done if the legal email had contained conditional approval?”

This is where GPT-5.6’s reasoning becomes central. The system identifies ambiguities, hidden rules and unexplained actions, then generates the smallest useful set of follow-up questions.

## Phase 3: Compile the workflow

The platform translates the session into a structured workflow representation:

```yaml
trigger:
  schedule: every Monday

inputs:
  - sales_forecast
  - crm_opportunities
  - contract_emails

steps:
  - fetch_open_opportunities
  - match_contract_communications
  - classify_approval_status
  - update_forecast_category

decision_rules:
  - if legal_approval == unconditional
    and close_date <= quarter_end
    then category = commit

  - if approval_is_ambiguous
    then escalate_to = sales_operations

human_review:
  required_when:
    - confidence < 0.90
    - deal_value > 5000000
```

The SME can edit this through normal language rather than editing YAML.

## Phase 4: Find the best automation boundary

Not every workflow should be fully automated.

Tacit divides each process into:

* **Deterministic steps:** safe to automate conventionally
* **AI judgment steps:** appropriate for model reasoning
* **Human approval steps:** require explicit confirmation
* **Unsupported steps:** missing access or reliable information

It then recommends an automation level:

| Level    | Behaviour                                   |
| -------- | ------------------------------------------- |
| Assist   | Collect information and recommend an action |
| Prepare  | Complete the work but wait for approval     |
| Execute  | Perform low-risk actions automatically      |
| Escalate | Route unusual cases to a human              |

This is much more credible than promising full autonomy.

## Phase 5: Generate the agent

Codex receives the workflow specification, sample inputs and tool schemas.

It creates:

* Connector code
* Transformation scripts
* Agent instructions
* API calls
* Validation logic
* Human approval screens
* Logging
* Tests
* A local runnable prototype

The product should expose the Codex activity visibly:

```text
✓ Inspected Salesforce schema
✓ Generated email-to-opportunity matching function
✓ Created 14 workflow tests
✗ Test 8 failed: conditional legal approval misclassified
✓ Updated decision logic
✓ All tests passed
```

This gives the hackathon judges visible proof that Codex is doing substantive engineering.

## Phase 6: Replay and verify

This may be the most important differentiator.

Tacit replays historical examples through the generated agent and compares its decisions with the expert’s actions.

Example report:

```text
Historical cases tested: 42

Exact action match:        33
Acceptable alternative:     5
Incorrect:                  2
Requires clarification:     2

Estimated automation rate: 81%
Estimated review rate:     14%
Unsafe failure rate:        5%
```

For disagreements, the expert reviews both decisions:

> “You selected ‘Escalate,’ but the agent selected ‘Approve.’ Which decision is correct?”

The answer becomes a new rule or test case.

Over time, the system builds a defensible workflow knowledge base rather than an opaque prompt.

# The most original feature: Contradiction Mining

Most process-mining tools observe clicks. Most AI workflow builders ask the user to describe a process.

Tacit should compare:

* The documented SOP
* The SME’s explanation
* Their actual actions
* Historical outcomes

It highlights contradictions:

```text
DOCUMENTED RULE
All refunds above $500 require manager approval.

OBSERVED BEHAVIOUR
Expert approved three refunds between $500 and $750 directly.

EXPERT EXPLANATION
Approval is not required for duplicate-charge cases.

STATUS
Undocumented exception detected.
```

This is where valuable institutional knowledge is discovered.

The platform can ask the SME to resolve it:

* Add it as an official rule
* Mark it as a personal workaround
* Require manager validation
* Exclude it from automation

That is a far stronger story than “AI records your workflow.”

# Product architecture

## 1. Observation layer

For a hackathon MVP, avoid trying to observe an entire desktop operating system.

Use a controlled environment:

* Browser extension
* Chrome-based task recorder
* Uploaded files
* Optional meeting transcript
* Application screenshots
* Simulated CRM, email and spreadsheet tools

Capture events such as:

```json
{
  "timestamp": "2026-07-15T09:05:31",
  "application": "CRM",
  "action": "update_field",
  "entity": "opportunity",
  "field": "forecast_category",
  "old_value": "best_case",
  "new_value": "commit"
}
```

## 2. Understanding layer

GPT-5.6 converts raw events into:

* Goals
* Entities
* Steps
* Inputs
* Outputs
* Decisions
* Preconditions
* Exceptions
* Uncertainties

It also clusters repeated demonstrations to separate stable rules from one-off actions.

## 3. Knowledge layer

Store domain knowledge as versioned “skills.”

A recent research architecture for scientific workflows used domain-authored skill documents to encode vocabulary, constraints and optimization knowledge. In that experiment, adding skills increased full-match intent accuracy from 44% to 83%, which supports using an explicit knowledge layer rather than hiding everything inside prompts. ([arXiv][3])

A skill could include:

```text
Skill: Review supplier invoice

Known concepts:
- PO invoice
- non-PO invoice
- three-way match
- tolerance amount

Rules:
- Quantity variance under 2% can pass automatically.
- Price variance always requires procurement review.
- Missing tax ID must be returned to supplier.

Examples:
- Case 001: approved
- Case 002: escalated
- Case 003: rejected
```

## 4. Compilation layer

Codex transforms the workflow and skills into executable artifacts:

* Python or TypeScript actions
* Agent definitions
* Workflow state machine
* Integration mocks
* Unit tests
* Evaluation cases
* Deployment configuration

## 5. Evaluation layer

Every automation receives:

* Accuracy score
* Coverage score
* Escalation rate
* Exception rate
* Time saved
* Estimated cost
* Risk rating
* Traceability report

# Best MVP for Build Week

Do not attempt to support every enterprise workflow.

Build one polished example:

## Vendor Invoice Exception Agent

The subject-matter expert demonstrates how they review an invoice that failed automatic matching.

They inspect:

* Invoice PDF
* Purchase order
* Goods-received record
* Vendor email
* Approval limits

Tacit observes the work, asks follow-up questions and generates an agent that:

1. Extracts invoice details.
2. Matches the invoice to the purchase order.
3. Identifies the discrepancy.
4. Applies the expert’s tolerance rules.
5. Drafts an approval or rejection.
6. Escalates ambiguous cases.
7. Produces a complete evidence trail.

### Why this scenario works

It includes:

* Documents
* Multiple systems
* Business rules
* Judgment
* Exceptions
* Financial impact
* Human approval
* Verifiable outcomes

It also has a strong three-minute demo.

# Recommended demo

## Scene 1: “The workflow nobody documented”

Show an accounts-payable expert completing an invoice exception manually.

The expert says:

> “Normally, I just compare the invoice with the purchase order.”

But on screen, they also:

* Search an email
* Check delivery status
* Apply a 2% tolerance
* Look at the vendor’s history
* Ask for manager approval above a threshold

Tacit captures these hidden steps.

## Scene 2: AI questions the expert

Immediately after the demonstration:

> “You accepted a quantity mismatch of 1.7%. Should mismatches below 2% always be accepted?”

> “You checked the vendor’s previous disputes but did not use that information. Is it required?”

The expert confirms or corrects each rule.

## Scene 3: Compile

Press **Build Agent**.

Show Codex:

* Creating the workflow
* Writing connectors
* Generating tests
* Failing an edge case
* Repairing the logic

## Scene 4: New case

Upload a second invoice containing an unusual exception.

The generated agent:

* Performs the workflow
* Provides its evidence
* Stops for human approval
* Explains why it did not act autonomously

## Closing screen

```text
Observed demonstrations: 2
Rules discovered: 11
Undocumented exceptions: 3
Tests passed: 18/18
Estimated handling time: 18 min → 2 min
Safe automation coverage: 76%
```

# How this differs from Uber’s process

Uber’s Agentic Pods rely on scarce engineers who already understand the company’s internal systems. Tacit would make that process repeatable by automating the AI engineer’s discovery and prototyping work. ([X (formerly Twitter)][1])

| Uber Agentic Pod                  | Tacit                               |
| --------------------------------- | ---------------------------------------------- |
| Engineer manually shadows SME     | AI captures and structures work                |
| Engineer asks follow-up questions | AI generates evidence-grounded questions       |
| Engineer documents the workflow   | System builds a decision graph automatically   |
| Engineer selects opportunities    | System scores automation candidates            |
| Engineer manually builds an agent | Codex produces the prototype                   |
| SME informally tests output       | Historical cases become executable evaluations |
| Knowledge remains with the pod    | Knowledge becomes versioned reusable skills    |
| Requires one engineer per expert  | One AI team can supervise many SMEs            |

The product should not claim to remove engineers entirely. Its stronger and more believable claim is:

> **Tacit lets one AI engineer run ten Agentic Pods simultaneously.**

# Suggested positioning

## Name

**Tacit**

## Category

**AI workflow discovery and agent generation**

## One-line description

> Tacit observes experts doing real work and converts their undocumented decisions into tested, reviewable AI agents.

## Hero message

> **Turn tribal knowledge into working software.**

Supporting copy:

> Record a real workflow. Tacit discovers the rules, interviews the expert, generates an agent with Codex and verifies it against real cases.

## Hackathon pitch

> Uber showed that the best enterprise agents emerge when AI engineers work directly beside domain experts. But that process is expensive and difficult to scale. Tacit automates the forward-deployed engineer workflow—observing experts, discovering hidden decisions, generating executable agents and verifying them against historical work.

# What not to build

Avoid turning it into:

* A generic screen recorder
* Another SOP generator
* A no-code Zapier clone
* A meeting transcription tool
* A prompt generator
* A fully autonomous desktop agent
* A platform with twenty integrations but no deep workflow

The winning experience is one end-to-end transformation:

> **Watch expert → find hidden rule → ask smart question → generate agent → fail an edge case → repair it → produce verified output.**

That sequence demonstrates GPT-5.6 reasoning, Codex engineering and a commercially important idea in one coherent demo.

[1]: https://x.com/praveenTweets/status/2074605343439810922?utm_source=chatgpt.com "How do we bring agentic AI beyond engineering? Finance. ..."
[2]: https://www.businessinsider.com/uber-cto-bets-on-agentic-pods-make-ai-more-efficient-2026-7?utm_source=chatgpt.com "Uber's CTO embedded its top AI engineers in HR, finance, and legal, and found better ways to build"
[3]: https://arxiv.org/abs/2604.21910?utm_source=chatgpt.com "From Research Question to Scientific Workflow: Leveraging Agentic AI for Science Automation"
