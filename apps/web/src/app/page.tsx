import Image from 'next/image';

const process = [
  ['01', 'Ingest evidence', 'Bring SOPs, recordings, documents, and expert context into one traceable project record.'],
  ['02', 'Observe the work', 'Capture the actions, narration, exceptions, and sources behind a real decision.'],
  ['03', 'Confirm the workflow', 'Turn hidden rules and contradictions into a versioned specification an SME can review.'],
  ['04', 'Test the agent', 'Compile only the confirmed workflow, replay historical cases, and keep review boundaries explicit.'],
];

export default function HomePage() {
  return <main className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <Image className="landing-hero-media" src="/images/landing/tacit-hero-workflow.webp" alt="A hand arranging a physical workflow map made from documents and tracing paper." fill priority sizes="100vw" />
      <div className="landing-hero-wash" />
      <header className="landing-nav" aria-label="Primary navigation">
        <a className="landing-brand" href="#top" aria-label="Tacit home"><span className="landing-brand-mark">T</span><span>Tacit</span></a>
        <nav className="landing-nav-links" aria-label="Explore Tacit"><a href="#method">How it works</a><a href="#product">Product</a><a href="/demo">Guided demo</a></nav>
        <a className="landing-nav-cta" href="/projects">Open workspace <span aria-hidden="true">↗</span></a>
      </header>
      <div className="landing-hero-copy" id="top">
        <p className="landing-kicker landing-kicker-light"><span />Workflow learning, with evidence</p>
        <h1 id="landing-title">Turn expert work into working software.</h1>
        <p className="landing-lede">Tacit captures how subject-matter experts make decisions, confirms the workflow behind them, and builds a tested agent with people kept in control.</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="/projects">Start a project <span aria-hidden="true">→</span></a><a className="landing-text-link landing-text-link-light" href="#method">See the method <span aria-hidden="true">↓</span></a></div>
      </div>
      <p className="landing-hero-caption">Evidence is the source of truth.</p>
    </section>

    <section className="landing-statement" aria-labelledby="statement-title">
      <div className="landing-container landing-statement-grid">
        <p className="landing-index">01 — The problem</p>
        <div><h2 id="statement-title">The work that matters most is rarely written down.</h2></div>
        <div className="landing-statement-note"><span className="landing-note-line" /><p>Operational rules live in judgment calls: when to trust a document, allow a small variance, or stop for approval. Tacit starts with the work itself—not an idealized SOP.</p></div>
      </div>
    </section>

    <section className="landing-evidence" aria-labelledby="evidence-title">
      <Image className="landing-evidence-media" src="/images/landing/tacit-evidence-archive.webp" alt="An evidence archive of documents connected by a blue thread." fill loading="eager" sizes="(max-width: 760px) 100vw, 58vw" />
      <div className="landing-evidence-copy"><p className="landing-kicker"><span />From evidence, not assumption</p><h2 id="evidence-title">Make the invisible parts of a process visible.</h2><p>Documents say one thing. Experts sometimes do another. Tacit brings together source material, observation, and narration to surface the rules, exceptions, and missing context that make a workflow safe to automate.</p><a className="landing-inline-link" href="#method">Follow the path <span aria-hidden="true">→</span></a></div>
    </section>

    <section className="landing-method" id="method" aria-labelledby="method-title">
      <div className="landing-container">
        <div className="landing-method-intro"><p className="landing-index landing-index-dark">02 — The Tacit method</p><h2 id="method-title">A disciplined path from observed work to a governed agent.</h2><p>Every stage makes the next one more accountable. Code does not begin with a raw recording or an unreviewed document.</p></div>
        <ol className="landing-process">{process.map(([number, title, description]) => <li key={number}><span className="landing-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="landing-step-arrow" aria-hidden="true">↘</span></li>)}</ol>
      </div>
    </section>

    <section className="landing-product" id="product" aria-labelledby="product-title">
      <div className="landing-container">
        <div className="landing-product-heading"><div><p className="landing-kicker"><span />Inside Tacit</p><h2 id="product-title">Follow a decision back to its evidence.</h2></div><p>The production workspace is built around projects, evidence intake, structured observation, workflow confirmation, tested builds, replay, and human approvals.</p></div>
        <div className="landing-product-stage">
          <div className="landing-product-sidebar"><span>Live workspace</span><strong>Observe expert review</strong><small>Invoice Exception Review</small><div className="landing-sidebar-rule" /><p>Capture action, narration, and source material in the same working view.</p></div>
          <figure><Image src="/images/landing/tacit-observation-workspace.webp" alt="Tacit's implemented invoice exception observation workspace showing evidence, a document, and a live expert decision timeline." width={1440} height={900} loading="eager" sizes="(max-width: 760px) 100vw, 88vw" /><figcaption>Real product interface: the guided observation workspace.</figcaption></figure>
        </div>
      </div>
    </section>

    <section className="landing-boundary" aria-labelledby="boundary-title">
      <div className="landing-container landing-boundary-grid"><div className="landing-boundary-diagram" aria-hidden="true"><span className="boundary-ring boundary-ring-one" /><span className="boundary-ring boundary-ring-two" /><span className="boundary-node boundary-node-a" /><span className="boundary-node boundary-node-b" /><span className="boundary-node boundary-node-c" /><span className="boundary-axis" /></div><div><p className="landing-kicker landing-kicker-light"><span />Automation boundaries</p><h2 id="boundary-title">Some decisions should stop and ask.</h2><p>Tacit identifies deterministic work, AI-assisted judgment, and human-required actions as part of the workflow. High-risk or ambiguous cases are held for review, with the applied rule and supporting evidence retained.</p><div className="landing-boundary-list"><span>Evidence-backed rules</span><span>Versioned workflow changes</span><span>Explicit approval gates</span></div></div></div>
    </section>

    <section className="landing-review" aria-labelledby="review-title">
      <Image className="landing-review-media" src="/images/landing/tacit-human-review.webp" alt="A reviewer assessing a printed workflow in a quiet, dark room." fill loading="eager" sizes="100vw" />
      <div className="landing-review-shade" /><div className="landing-container landing-review-copy"><p className="landing-index landing-index-light">03 — Human control</p><blockquote id="review-title">“The goal is not a black-box automation. It is a workflow you can inspect, test, and trust.”</blockquote><p>Tacit v1 prepares recommendations and keeps high-risk actions behind a human approval boundary.</p></div>
    </section>

    <section className="landing-availability" aria-labelledby="availability-title"><div className="landing-container landing-availability-grid"><p className="landing-index">04 — Available now</p><div><h2 id="availability-title">Begin with Invoice Exception Review.</h2><p>Tacit’s first production workflow pack is built for supervised invoice exception work: evidence intake, expert observation, clarified decision rules, tested recommendations, replay, and approvals.</p></div><a className="landing-button landing-button-dark" href="/demo">Explore the guided demo <span aria-hidden="true">→</span></a></div></section>

    <section className="landing-closing" aria-labelledby="closing-title">
      <Image className="landing-closing-media" src="/images/landing/tacit-closing-threshold.webp" alt="A cobalt-blue line travelling through a dark architectural space toward a bright threshold." fill loading="eager" sizes="100vw" />
      <div className="landing-closing-shade" /><div className="landing-container landing-closing-content"><p className="landing-kicker landing-kicker-light"><span />The next workflow starts here</p><h2 id="closing-title">Put your expert work on solid ground.</h2><p>Create a project, bring the evidence, and make the real workflow reviewable before it becomes software.</p><a className="landing-button landing-button-light" href="/projects">Open production workspace <span aria-hidden="true">↗</span></a></div>
    </section>

    <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-top"><a className="landing-brand landing-brand-footer" href="#top"><span className="landing-brand-mark">T</span><span>Tacit</span></a><p>From work observation to a verified agent.</p><div><a href="#method">Method</a><a href="#product">Product</a><a href="/demo">Guided demo</a><a href="/projects">Workspace</a></div></div><div className="landing-footer-wordmark">Tacit</div><div className="landing-footer-bottom"><span>Workflow learning and agent compilation</span><span>Evidence first. Human control by design.</span></div></div></footer>
  </main>;
}
