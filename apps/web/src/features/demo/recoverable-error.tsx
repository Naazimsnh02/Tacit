'use client';

export function RecoverableError({ message, onRetry, onUseSeededResult, previousHref }: { readonly message: string; readonly onRetry: () => void; readonly onUseSeededResult?: () => void; readonly previousHref?: string }) {
  return <section role="alert" className="notice">
    <h2>This step needs attention</h2><p>{message}</p>
    <div className="header-actions" style={{ justifyContent: 'flex-start' }}><button className="btn btn-secondary" type="button" onClick={onRetry}>Retry</button>{onUseSeededResult ? <button className="btn btn-secondary" type="button" onClick={onUseSeededResult}>Use seeded result</button> : null}{previousHref ? <a className="btn btn-secondary" href={previousHref}>Return to workflow</a> : null}<button className="btn btn-danger" type="button" onClick={() => window.location.assign('/')}>Reset demo</button></div>
  </section>;
}
