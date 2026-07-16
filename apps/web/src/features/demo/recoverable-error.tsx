'use client';

export function RecoverableError({ message, onRetry, onUseSeededResult, previousHref }: { readonly message: string; readonly onRetry: () => void; readonly onUseSeededResult?: () => void; readonly previousHref?: string }) {
  return <section role="alert" style={{ border: '1px solid #f2b8b5', background: '#fff8f7', padding: 16, borderRadius: 10 }}>
    <h2 style={{ marginTop: 0 }}>This step needs attention</h2><p>{message}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button type="button" onClick={onRetry}>Retry</button>{onUseSeededResult ? <button type="button" onClick={onUseSeededResult}>Use seeded result</button> : null}{previousHref ? <a href={previousHref}>Return to previous workflow version</a> : null}<button type="button" onClick={() => window.location.assign('/')}>Reset demo</button></div>
  </section>;
}
