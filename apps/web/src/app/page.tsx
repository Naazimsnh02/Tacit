import Image from 'next/image';
import { BrandLogo } from '../features/ui/brand-logo';

const process = [
  ['01', 'Bring in the evidence', 'Add SOPs, recordings, documents, and expert context to one traceable project record.'],
  ['02', 'Observe expert decisions', 'Capture actions, narration, exceptions, and the sources behind a real decision.'],
  ['03', 'Confirm the workflow', 'Surface hidden rules and contradictions, then let the expert confirm what should guide the AI agent.'],
  ['04', 'Build and test the agent', 'Build only from the confirmed workflow, replay historical cases, and keep approval points clear.'],
];

export default function HomePage() {
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
          <a href="/demo">Guided demo</a>
        </nav>
        <a className="landing-nav-cta" href="/projects">Start a project <span aria-hidden="true">↗</span></a>
      </header>
      <div className="landing-hero-copy" id="top">
        <p className="landing-kicker landing-kicker-light">Evidence-based AI workflow learning</p>
        <h1 id="landing-title">Turn expert work into trusted AI agents.</h1>
        <p className="landing-lede">Tacit observes how experts make decisions, turns that knowledge into an evidence-backed workflow, and builds an AI agent that knows when to ask for human approval.</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">→</span></a><a className="landing-text-link landing-text-link-light" href="#method">See how Tacit works <span aria-hidden="true">↓</span></a></div>
      </div>
      <p className="landing-hero-caption">Every decision starts with evidence.</p>
    </section>

    <section className="landing-statement" aria-labelledby="statement-title">
      <div className="landing-container landing-statement-grid">
        <p className="landing-index">01 — The problem</p>
        <div><h2 id="statement-title">The most important work is rarely captured in an SOP.</h2></div>
        <div className="landing-statement-note"><span className="landing-note-line" /><p>The rules that keep operations moving often live in judgment calls: when to trust a document, allow a small variance, or stop for approval. Tacit learns from real work, not an idealized process on paper.</p></div>
      </div>
    </section>

    <section className="landing-why-matters" aria-labelledby="why-matters-title">
      <div className="landing-container landing-why-matters-grid">
        <p className="landing-index">Why it matters</p>
        <div><h2 id="why-matters-title">When expert knowledge leaves, operational risk stays.</h2><p>Every undocumented exception and unwritten decision makes a business harder to scale. Tacit preserves how experienced people work before that knowledge is lost, inconsistent, or impossible to audit.</p></div>
      </div>
    </section>

    <section className="landing-evidence" aria-labelledby="evidence-title">
      <Image className="landing-evidence-media" src="/images/landing/tacit-evidence-archive.webp" alt="An evidence archive of documents connected by a blue thread." fill loading="eager" sizes="(max-width: 760px) 100vw, 58vw" />
      <div className="landing-evidence-copy"><p className="landing-kicker">From evidence, not assumption</p><h2 id="evidence-title">Make the real workflow visible.</h2><p>Documents show the intended process. Expert work reveals the exceptions, trade-offs, and missing context behind it. Tacit connects source material, observation, and narration so every workflow rule can be reviewed in context.</p><a className="landing-inline-link" href="#method">Explore the workflow <span aria-hidden="true">→</span></a></div>
    </section>

    <section className="landing-why-tacit" id="why-tacit" aria-labelledby="why-tacit-title">
      <div className="landing-container">
        <div className="landing-why-tacit-intro"><p className="landing-index">Why Tacit</p><div><h2 id="why-tacit-title">Workflow automation built from real work.</h2><p>Traditional tools document a process. Tacit captures the decisions that make it work.</p></div></div>
        <div className="landing-comparison" role="table" aria-label="Traditional workflow automation compared with Tacit">
          <div className="landing-comparison-head" role="row"><span role="columnheader">Traditional workflow automation</span><span role="columnheader">Tacit</span></div>
          <div role="row"><span role="cell">Starts with documents and static SOPs</span><span role="cell">Starts with observed work, evidence, and expert context</span></div>
          <div role="row"><span role="cell">Leaves hidden knowledge undocumented</span><span role="cell">Surfaces decision rules and exceptions</span></div>
          <div role="row"><span role="cell">Produces black-box recommendations</span><span role="cell">Links recommendations back to evidence</span></div>
          <div role="row"><span role="cell">Is difficult to inspect or audit</span><span role="cell">Keeps a traceable workflow history</span></div>
          <div role="row"><span role="cell">Stays fixed until someone rewrites it</span><span role="cell">Improves through confirmed workflow versions</span></div>
        </div>
      </div>
    </section>

    <section className="landing-method" id="method" aria-labelledby="method-title">
      <div className="landing-container">
        <div className="landing-method-intro"><p className="landing-index landing-index-dark">02 — The Tacit method</p><h2 id="method-title">From observed work to a tested AI agent.</h2><p>Each stage creates the evidence and clarity needed for the next. Tacit never builds from an unreviewed recording or document.</p></div>
        <ol className="landing-process">{process.map(([number, title, description]) => <li key={number}><span className="landing-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="landing-step-arrow" aria-hidden="true">↘</span></li>)}</ol>
      </div>
    </section>

    <section className="landing-product" id="product" aria-labelledby="product-title">
      <div className="landing-container">
        <div className="landing-product-heading"><div><p className="landing-kicker">Inside Tacit</p><h2 id="product-title">See every decision in context.</h2></div><p>The Tacit workspace brings together evidence intake, expert observation, workflow review, agent testing, historical replay, and human approvals.</p></div>
        <div className="landing-product-stage">
          <div className="landing-product-sidebar"><span>Evidence in context</span><strong>Observe expert review</strong><small>Invoice Exception Review</small><div className="landing-sidebar-rule" /><p>Capture the decision and the evidence behind it in one view.</p></div>
          <figure><Image src="/images/landing/tacit-observation-workspace.webp" alt="Tacit's implemented invoice exception observation workspace showing evidence, a document, and a live expert decision timeline." width={1440} height={900} loading="eager" sizes="(max-width: 760px) 100vw, 88vw" /><figcaption>Real product interface: the guided observation workspace.</figcaption></figure>
        </div>
      </div>
    </section>

    <section className="landing-boundary" aria-labelledby="boundary-title">
      <div className="landing-container landing-boundary-grid"><div className="landing-boundary-diagram" aria-hidden="true"><span className="boundary-ring boundary-ring-one" /><span className="boundary-ring boundary-ring-two" /><span className="boundary-node boundary-node-a" /><span className="boundary-node boundary-node-b" /><span className="boundary-node boundary-node-c" /><span className="boundary-axis" /></div><div><p className="landing-kicker landing-kicker-light">Automation boundaries</p><h2 id="boundary-title">Know what to automate—and what to escalate.</h2><p>Tacit separates repetitive work, AI-assisted judgment, and decisions that require human approval. High-risk or ambiguous cases stay with your team, with the applied rule and supporting evidence retained.</p><div className="landing-boundary-list"><span>Evidence-backed rules</span><span>Version-controlled workflow changes</span><span>Clear approval gates</span></div></div></div>
    </section>

    <section className="landing-trust" aria-labelledby="trust-title">
      <div className="landing-container landing-trust-grid"><p className="landing-index">Enterprise trust</p><div><h2 id="trust-title">Enterprise AI needs a clear line of sight.</h2><div className="landing-trust-list"><span>Every recommendation links back to evidence</span><span>Human approval where it matters</span><span>Version-controlled workflows</span><span>Test against past cases</span><span>Complete audit trail</span></div></div></div>
    </section>

    <section className="landing-review" aria-labelledby="review-title">
      <Image className="landing-review-media" src="/images/landing/tacit-human-review.webp" alt="A reviewer assessing a printed workflow in a quiet, dark room." fill loading="eager" sizes="100vw" />
      <div className="landing-review-shade" /><div className="landing-container landing-review-copy"><p className="landing-index landing-index-light">03 — Human control</p><blockquote id="review-title">“The goal is not hands-off automation. It is a workflow you can inspect, test, and trust.”</blockquote><p>Tacit prepares recommendations and keeps high-risk actions behind a human approval boundary.</p></div>
    </section>

    <section className="landing-availability" aria-labelledby="availability-title"><div className="landing-container landing-availability-grid"><p className="landing-index">04 — Available now</p><div><h2 id="availability-title">Explore Invoice Exception Review.</h2><p>Try Tacit’s guided demo for supervised invoice exception review—from evidence and expert observation to clarified rules, tested recommendations, replay, and human approval.</p></div><a className="landing-button landing-button-dark" href="/demo">Try the guided demo <span aria-hidden="true">→</span></a></div></section>

    <section className="landing-closing" aria-labelledby="closing-title">
      <Image className="landing-closing-media" src="/images/landing/tacit-closing-threshold.webp" alt="A cobalt-blue line travelling through a dark architectural space toward a bright threshold." fill loading="eager" sizes="100vw" />
      <div className="landing-closing-shade" /><div className="landing-container landing-closing-content"><p className="landing-kicker landing-kicker-light">Your next workflow starts here</p><h2 id="closing-title">Build AI agents your team can stand behind.</h2><p>Start with the evidence. Confirm the real workflow. Build an AI agent your team can inspect, test, and approve.</p><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">↗</span></a></div>
    </section>

    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          <a className="landing-brand landing-brand-footer" href="#top" aria-label="Tacit home">
            <BrandLogo className="landing-logo" />
          </a>
          <p>From observed work to trusted AI agents.</p>
          <div>
            <a href="#why-tacit">Why Tacit</a>
            <a href="#method">How it works</a>
            <a href="#product">Product</a>
            <a href="/demo">Guided demo</a>
            <a href="/projects">Start a project</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Tacit. All rights reserved.</span>
          <span>Evidence first. Human control by design.</span>
        </div>
      </div>
    </footer>
  </main>;
}
