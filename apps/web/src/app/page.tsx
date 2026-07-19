'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BrandLogo } from '../features/ui/brand-logo';

const process = [
  ['01', 'Run knowledge transfer', 'Share SOPs, walkthroughs, records, and expert context the way you would brief a teammate.'],
  ['02', 'Let Tacit prepare the workflow', 'The AI turns that KT package into a cited draft process, including exceptions and decision boundaries.'],
  ['03', 'Clarify and confirm', 'Answer only the questions that still matter, then confirm the policy an agent should follow.'],
  ['04', 'Build and test the agent', 'Compile only from the confirmed workflow, replay historical cases, and keep approval points clear.'],
];

const workspaceTabs = [
  {
    id: 'sources',
    label: '01 · Sources',
    sidebarTitle: 'Sources & Evidence Intake',
    description: 'Upload process documents, SOPs, walkthrough videos, and expert recordings. Tacit transcribes and indexes each source to establish durable provenance for every workflow rule.',
    image: '/images/landing/tacit-sources.png',
    alt: 'Tacit workspace showing uploaded source evidence, including SOPs, documents, and videos with extraction status.',
    figcaption: 'Real product interface: the source and evidence intake workspace.',
  },
  {
    id: 'understand',
    label: '02 · Understand',
    sidebarTitle: 'Automated Process Understanding',
    description: 'AI-first repository parsing performs cross-source understanding and extracts process steps, decision branches, and rule inferences with direct evidence citations.',
    image: '/images/landing/tacit-observation-workspace.webp',
    alt: 'Tacit workspace showing knowledge transfer materials, process context, and a live expert decision timeline.',
    figcaption: 'Real product interface: the automated process understanding and observation workspace.',
  },
  {
    id: 'clarify',
    label: '03 · Clarify',
    sidebarTitle: 'Interactive Clarification',
    description: 'Surface hidden rules, resolve contradictions, and answer AI-generated clarification questions to establish the precise logical boundaries of the policy.',
    image: '/images/landing/tacit-evidence-archive.webp',
    alt: 'An evidence archive of documents connected by a blue thread, representing clarification logic.',
    figcaption: 'Real product interface: the clarification and rule alignment console.',
  },
  {
    id: 'review',
    label: '04 · Review',
    sidebarTitle: 'Workflow Policy Review',
    description: 'Inspect version-controlled workflow graphs, view complete transition logic, and define exactly which paths can run autonomously versus what needs human escalation.',
    image: '/images/landing/tacit-human-review.webp',
    alt: 'A reviewer assessing a printed workflow, representing the workflow review interface.',
    figcaption: 'Real product interface: the version-controlled workflow review and graph builder.',
  },
  {
    id: 'build',
    label: '05 · Build',
    sidebarTitle: 'Sandbox Compilation',
    description: 'Compile verified workflows into Codex-generated agent specifications. Code syntax is validated, AST-checked, and safely sandbox-built with strict limits.',
    image: '/images/landing/tacit-closing-threshold.webp',
    alt: 'A cobalt-blue line travelling through a dark architectural space toward a bright threshold, representing compilation.',
    figcaption: 'Real product interface: the sandbox execution and agent build pipeline.',
  },
  {
    id: 'test',
    label: '06 · Test',
    sidebarTitle: 'Historical Replay Testing',
    description: 'Run regressions and evaluations against past historical cases. Compare new draft rules to old execution results to verify policy accuracy.',
    image: '/images/landing/tacit-evidence-archive.webp',
    alt: 'An evidence archive showing test cases.',
    figcaption: 'Real product interface: the evaluation run and replay testing suite.',
  },
  {
    id: 'approve',
    label: '07 · Approve',
    sidebarTitle: 'Human Approval Policy',
    description: 'Define strict role-based approval boundaries. Out-of-bounds metrics, high-risk flags, or low-confidence executions are halted for human verification.',
    image: '/images/landing/tacit-human-review.webp',
    alt: 'Human reviewer signing off on an action.',
    figcaption: 'Real product interface: the human approval gates and compliance console.',
  },
  {
    id: 'operate',
    label: '08 · Operate',
    sidebarTitle: 'Supervised Execution',
    description: 'Execute runs in production using sandboxed workers. Run tasks, monitor live queues, and trigger human-in-the-loop manual overrides.',
    image: '/images/landing/tacit-observation-workspace.webp',
    alt: 'Operator view of live queues.',
    figcaption: 'Real product interface: the operator execution queue and runtime dashboard.',
  },
  {
    id: 'impact',
    label: '09 · Impact',
    sidebarTitle: 'Business Impact Analytics',
    description: 'Track key metrics in real-time, including automation rate, SLA compliance, human review frequency, and operational time and cost savings.',
    image: '/images/landing/tacit-closing-threshold.webp',
    alt: 'An analytics dashboard.',
    figcaption: 'Real product interface: the business impact metrics and analytics page.',
  },
];

export default function HomePage() {
  const [activeTabId, setActiveTabId] = useState('sources');
  const selectedTab = workspaceTabs.find((tab) => tab.id === activeTabId) ?? workspaceTabs[0];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.landing section');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return <main className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <Image className="landing-hero-media" src="/images/landing/tacit-hero-workflow.webp" alt="A hand arranging a physical workflow map made from documents and tracing paper." fill priority sizes="100vw" />
      <div className="landing-hero-wash" />
      <header className="landing-nav" aria-label="Primary navigation">
        <a className="landing-brand" href="#top" aria-label="Tacit home"><BrandLogo className="landing-logo" /></a>
        <nav className="landing-nav-links" aria-label="Explore Tacit">
          <a href="#why-tacit">Why Tacit</a>
          <a href="#method">How it works</a>
          <a href="#product">Product</a>
          <a href="/projects">Projects</a>
        </nav>
        <a className="landing-nav-cta" href="/projects">Start a project <span aria-hidden="true">↗</span></a>
      </header>
      <div className="landing-hero-copy" id="top">
        <p className="landing-kicker landing-kicker-light">From expert knowledge to trusted AI agents</p>
        <h1 id="landing-title">Teach AI how work really gets done.</h1>
        <p className="landing-lede">Tacit learns from your documents, walkthroughs, examples, and expert judgment, then turns that knowledge into a cited workflow and a supervised AI agent your team can inspect, test, and approve.</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">→</span></a><a className="landing-text-link landing-text-link-light" href="#method">See how Tacit works <span aria-hidden="true">↓</span></a></div>
        <ul className="landing-hero-proof" aria-label="Product guarantees">
          <li>Cited workflows</li>
          <li>Clear approval gates</li>
          <li>Historical testing</li>
          <li>Complete audit trail</li>
        </ul>
      </div>
    </section>

    <section className="landing-statement" aria-labelledby="statement-title">
      <div className="landing-container landing-statement-grid">
        <p className="landing-index">01 - The problem</p>
        <div><h2 id="statement-title">The most important work is rarely captured in an SOP.</h2></div>
        <div className="landing-statement-note"><p>The rules that keep operations moving often live in judgment calls: when to trust a document, allow a small variance, or stop for approval. That knowledge usually moves through human KT. Tacit makes the same handoff work for AI.</p></div>
      </div>
    </section>

    <section className="landing-why-matters" aria-labelledby="why-matters-title">
      <div className="landing-container landing-why-matters-grid">
        <p className="landing-index">Why it matters</p>
        <div><h2 id="why-matters-title">When expert knowledge leaves, operational risk stays.</h2><p>Every undocumented exception and unwritten decision makes a business harder to scale. Tacit preserves how experienced people work before that knowledge is lost, inconsistent, or impossible to audit, and turns the transfer into a workflow an agent can follow under supervision.</p></div>
      </div>
    </section>

    <section className="landing-evidence" aria-labelledby="evidence-title">
      <Image className="landing-evidence-media" src="/images/landing/tacit-evidence-archive.webp" alt="An evidence archive of documents connected by a blue thread." fill loading="eager" sizes="(max-width: 760px) 100vw, 58vw" />
      <div className="landing-evidence-copy"><p className="landing-kicker">From knowledge transfer, not assumption</p><h2 id="evidence-title">Make the real workflow visible.</h2><p>Documents show the intended process. Expert walkthroughs and judgment reveal the exceptions, trade-offs, and missing context behind it. Tacit connects the full KT package so every workflow rule can be reviewed in context.</p><a className="landing-inline-link" href="#method">Explore the workflow <span aria-hidden="true">→</span></a></div>
    </section>

    <section className="landing-why-tacit" id="why-tacit" aria-labelledby="why-tacit-title">
      <div className="landing-container">
        <div className="landing-why-tacit-intro"><p className="landing-index">Why Tacit</p><div><h2 id="why-tacit-title">Workflow automation built from knowledge transfer.</h2><p>Traditional tools document a process on paper. Tacit receives a KT session the way a colleague would, then prepares the workflow an agent can follow.</p></div></div>
        <div className="landing-comparison" role="table" aria-label="Traditional workflow automation compared with Tacit">
          <div className="landing-comparison-head" role="row"><span role="columnheader">Traditional workflow automation</span><span role="columnheader">Tacit</span></div>
          <div role="row"><span role="cell">Starts with documents and static SOPs</span><span role="cell">Starts with a knowledge transfer session to AI</span></div>
          <div role="row"><span role="cell">Leaves hidden knowledge undocumented</span><span role="cell">Surfaces decision rules and exceptions from the handoff</span></div>
          <div role="row"><span role="cell">Produces black-box recommendations</span><span role="cell">Links recommendations back to the KT evidence</span></div>
          <div role="row"><span role="cell">Is difficult to inspect or audit</span><span role="cell">Keeps a traceable workflow history</span></div>
          <div role="row"><span role="cell">Stays fixed until someone rewrites it</span><span role="cell">Improves through confirmed workflow versions</span></div>
        </div>
      </div>
    </section>

    <section className="landing-method" id="method" aria-labelledby="method-title">
      <div className="landing-container">
        <div className="landing-method-intro"><p className="landing-index landing-index-dark">02 - The Tacit method</p><h2 id="method-title">From knowledge transfer to a tested AI agent.</h2><p>Each stage turns the expert handoff into clearer policy for the next. Tacit never compiles from an unreviewed KT package.</p></div>
        <ol className="landing-process">{process.map(([number, title, description]) => <li key={number}><span className="landing-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="landing-step-arrow" aria-hidden="true">→</span></li>)}</ol>
      </div>
    </section>

    <section className="landing-product" id="product" aria-labelledby="product-title">
      <div className="landing-container">
        <div className="landing-product-heading">
          <div>
            <p className="landing-kicker">Inside Tacit</p>
            <h2 id="product-title">See every decision in context.</h2>
          </div>
          <p>
            The Tacit workspace maps your entire automation lifecycle: from source evidence ingestion and AI-first process understanding, to clarification loops, interactive workflow review, sandbox agent builds, historical replay evaluations, human approval boundaries, run execution, and business impact analytics.
          </p>
        </div>
        <div className="landing-product-stage">
          <div className="landing-product-sidebar">
            <span>Inside the Workspace</span>
            <div className="landing-sidebar-tabs" role="tablist" aria-label="Tacit workspace tabs">
              {workspaceTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTabId === tab.id}
                  className={`landing-sidebar-tab-button ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="landing-sidebar-rule" style={{ marginTop: '24px', marginBottom: '16px' }} />
            <strong style={{ marginTop: '0' }}>{selectedTab.sidebarTitle}</strong>
            <p style={{ marginTop: '8px', minHeight: '80px' }}>{selectedTab.description}</p>
          </div>
          <figure>
            <Image
              src={selectedTab.image}
              alt={selectedTab.alt}
              width={1440}
              height={900}
              loading="eager"
              sizes="(max-width: 760px) 100vw, 88vw"
            />
            <figcaption>{selectedTab.figcaption}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section className="landing-boundary" aria-labelledby="boundary-title">
      <div className="landing-container landing-boundary-grid">
        <div className="landing-boundary-diagram" aria-hidden="true">
          <svg className="landing-boundary-svg" viewBox="0 0 500 440" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="50" y1="220" x2="450" y2="220" stroke="url(#axis-grad)" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="250" cy="220" r="160" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
            <circle cx="250" cy="220" r="100" stroke="rgba(147,176,228,0.18)" strokeWidth="1.5" strokeDasharray="6 4" className="rotating-orbit" />
            <circle cx="250" cy="220" r="8" fill="#93b0e4" className="pulse-node" />
            <path d="M250,220 L160,130" stroke="rgba(147,176,228,0.22)" strokeWidth="1" />
            <path d="M250,220 L350,150" stroke="rgba(147,176,228,0.22)" strokeWidth="1" />
            <path d="M250,220 L220,320" stroke="rgba(147,176,228,0.22)" strokeWidth="1" />
            <g className="pulsing-g" style={{ transformOrigin: '160px 130px' }}>
              <circle cx="160" cy="130" r="6" fill="#93b0e4" />
              <circle cx="160" cy="130" r="12" stroke="rgba(147,176,228,0.3)" strokeWidth="1" className="ping-ring" />
              <text x="160" y="112" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold" letterSpacing="0.08em">AUTOMATED</text>
            </g>
            <g className="pulsing-g" style={{ transformOrigin: '350px 150px' }}>
              <circle cx="350" cy="150" r="6" fill="#f0ede5" />
              <circle cx="350" cy="150" r="12" stroke="rgba(240,237,229,0.3)" strokeWidth="1" className="ping-ring" />
              <text x="350" y="132" textAnchor="middle" fill="#f0ede5" fontSize="9" fontWeight="bold" letterSpacing="0.08em">HUMAN APPROVAL</text>
            </g>
            <g className="pulsing-g" style={{ transformOrigin: '220px 320px' }}>
              <circle cx="220" cy="320" r="6" fill="#93b0e4" />
              <circle cx="220" cy="320" r="12" stroke="rgba(147,176,228,0.3)" strokeWidth="1" className="ping-ring" />
              <text x="220" y="342" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold" letterSpacing="0.08em">EVALUATED</text>
            </g>
            <circle cx="150" cy="220" r="4" fill="#93b0e4" className="orbiting-particle-1" />
            <circle cx="350" cy="220" r="4" fill="#f0ede5" className="orbiting-particle-2" />
            <defs>
              <linearGradient id="axis-grad" x1="50" y1="220" x2="450" y2="220" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="25%" stopColor="#4b6fa9" />
                <stop offset="50%" stopColor="#f0ede5" />
                <stop offset="75%" stopColor="#4b6fa9" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div><p className="landing-kicker landing-kicker-light">Automation boundaries</p><h2 id="boundary-title">Know what to automate, and what to escalate.</h2><p>Tacit separates repetitive work, AI-assisted judgment, and decisions that require human approval. High-risk or ambiguous cases stay with your team, with the applied rule and supporting evidence retained.</p><div className="landing-boundary-list"><span>Evidence-backed rules</span><span>Version-controlled workflow changes</span><span>Clear approval gates</span></div></div>
      </div>
    </section>

    <section className="landing-trust" aria-labelledby="trust-title">
      <div className="landing-container landing-trust-grid"><p className="landing-index">Enterprise trust</p><div><h2 id="trust-title">Enterprise AI needs a clear line of sight.</h2><div className="landing-trust-list"><span>Every recommendation links back to the KT evidence</span><span>Human approval where it matters</span><span>Version-controlled workflows</span><span>Test against past cases</span><span>Complete audit trail</span></div></div></div>
    </section>

    <section className="landing-review" aria-labelledby="review-title">
      <Image className="landing-review-media" src="/images/landing/tacit-human-review.webp" alt="A reviewer assessing a printed workflow in a quiet, dark room." fill loading="eager" sizes="100vw" />
      <div className="landing-review-shade" /><div className="landing-container landing-review-copy"><p className="landing-index landing-index-light">03 - Human control</p><blockquote id="review-title">“The goal is not hands-off automation. It is a workflow you can inspect, test, and trust.”</blockquote><p>Tacit prepares recommendations and keeps high-risk actions behind a human approval boundary.</p></div>
    </section>

    <section className="landing-availability" aria-labelledby="availability-title"><div className="landing-container landing-availability-grid"><p className="landing-index">04 - Available now</p><div><h2 id="availability-title">Start a knowledge transfer project.</h2><p>Create a project, upload process materials, let Tacit understand the workflow, then clarify, build, test, and approve a supervised agent.</p></div><a className="landing-button landing-button-dark" href="/projects">Start a project <span aria-hidden="true">→</span></a></div></section>

    <section className="landing-closing" aria-labelledby="closing-title">
      <Image className="landing-closing-media" src="/images/landing/tacit-closing-threshold.webp" alt="A cobalt-blue line travelling through a dark architectural space toward a bright threshold." fill loading="eager" sizes="100vw" />
      <div className="landing-closing-shade" /><div className="landing-container landing-closing-content"><p className="landing-kicker landing-kicker-light">Your next workflow starts here</p><h2 id="closing-title">Build AI agents your team can stand behind.</h2><p>Start with a knowledge transfer session. Confirm the real workflow. Build an AI agent your team can inspect, test, and approve.</p><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">↗</span></a></div>
    </section>

    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          <a className="landing-brand" href="#top" aria-label="Tacit home">
            <BrandLogo className="landing-logo" />
          </a>
          <p>From expert knowledge to trusted AI agents.</p>
          <div>
            <a href="#why-tacit">Why Tacit</a>
            <a href="#method">How it works</a>
            <a href="#product">Product</a>
            <a href="/projects">Start a project</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; 2026 Tacit. All rights reserved.</span>
        </div>
      </div>
    </footer>
  </main>;
}
