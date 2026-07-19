import Image from 'next/image';
import { BrandLogo } from '../features/ui/brand-logo';

const process = [
  ['01', 'Run knowledge transfer', 'Share SOPs, walkthroughs, records, and expert context the way you would brief a new teammate.'],
  ['02', 'Let Tacit prepare the workflow', 'The AI turns that KT package into a cited draft process, including exceptions and decision boundaries.'],
  ['03', 'Clarify and confirm', 'Answer only the questions that still matter, then confirm the policy an agent should follow.'],
  ['04', 'Build and test the agent', 'Compile only from the confirmed workflow, replay historical cases, and keep approval points clear.'],
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
          <a href="/projects">Projects</a>
        </nav>
        <a className="landing-nav-cta" href="/projects">Start a project <span aria-hidden="true">↗</span></a>
      </header>
      <div className="landing-hero-copy" id="top">
        <p className="landing-kicker landing-kicker-light">Knowledge transfer for AI agents</p>
        <h1 id="landing-title">Give AI the same knowledge transfer you give a teammate.</h1>
        <p className="landing-lede">Tacit is a knowledge transfer session with AI. Hand over how the work is done through documents, walkthroughs, and expert context. Tacit prepares an evidence-backed workflow and builds an agent that knows when to ask for human approval.</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">→</span></a><a className="landing-text-link landing-text-link-light" href="#method">See how Tacit works <span aria-hidden="true">↓</span></a></div>
      </div>
      <p className="landing-hero-caption">Every agent starts with a knowledge transfer session.</p>
    </section>

    <section className="landing-statement" aria-labelledby="statement-title">
      <div className="landing-container landing-statement-grid">
        <p className="landing-index">01 - The problem</p>
        <div><h2 id="statement-title">The most important work is rarely captured in an SOP.</h2></div>
        <div className="landing-statement-note"><span className="landing-note-line" /><p>The rules that keep operations moving often live in judgment calls: when to trust a document, allow a small variance, or stop for approval. That knowledge usually moves through human KT. Tacit makes the same handoff work for AI.</p></div>
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
        <ol className="landing-process">{process.map(([number, title, description]) => <li key={number}><span className="landing-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="landing-step-arrow" aria-hidden="true">↘</span></li>)}</ol>
      </div>
    </section>

    <section className="landing-product" id="product" aria-labelledby="product-title">
      <div className="landing-container">
        <div className="landing-product-heading"><div><p className="landing-kicker">Inside Tacit</p><h2 id="product-title">See every decision in context.</h2></div><p>The Tacit workspace brings together knowledge transfer intake, automatic process understanding, clarification, workflow review, agent testing, historical replay, and human approvals.</p></div>
        <div className="landing-product-stage">
          <div className="landing-product-sidebar"><span>Knowledge transfer in context</span><strong>Share how the work is done</strong><small>Process workspace</small><div className="landing-sidebar-rule" /><p>Hand over materials and judgment the way you would brief a colleague. Tacit prepares the workflow from that session.</p></div>
          <figure><Image src="/images/landing/tacit-observation-workspace.webp" alt="Tacit workspace showing knowledge transfer materials, process context, and a live expert decision timeline." width={1440} height={900} loading="eager" sizes="(max-width: 760px) 100vw, 88vw" /><figcaption>Real product interface: the knowledge transfer and review workspace.</figcaption></figure>
        </div>
      </div>
    </section>

    <section className="landing-boundary" aria-labelledby="boundary-title">
      <div className="landing-container landing-boundary-grid"><div className="landing-boundary-diagram" aria-hidden="true"><span className="boundary-ring boundary-ring-one" /><span className="boundary-ring boundary-ring-two" /><span className="boundary-node boundary-node-a" /><span className="boundary-node boundary-node-b" /><span className="boundary-node boundary-node-c" /><span className="boundary-axis" /></div><div><p className="landing-kicker landing-kicker-light">Automation boundaries</p><h2 id="boundary-title">Know what to automate, and what to escalate.</h2><p>Tacit separates repetitive work, AI-assisted judgment, and decisions that require human approval. High-risk or ambiguous cases stay with your team, with the applied rule and supporting evidence retained.</p><div className="landing-boundary-list"><span>Evidence-backed rules</span><span>Version-controlled workflow changes</span><span>Clear approval gates</span></div></div></div>
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
          <a className="landing-brand landing-brand-footer" href="#top" aria-label="Tacit home">
            <BrandLogo className="landing-logo" />
          </a>
          <p>From knowledge transfer to trusted AI agents.</p>
          <div>
            <a href="#why-tacit">Why Tacit</a>
            <a href="#method">How it works</a>
            <a href="#product">Product</a>
            <a href="/projects">Start a project</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Tacit. All rights reserved.</span>
          <span>Knowledge transfer first. Human control by design.</span>
        </div>
      </div>
    </footer>
  </main>;
}
