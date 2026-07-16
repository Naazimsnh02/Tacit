'use client';

import type { ClarificationQuestion } from '@tacit/core-schemas';
import { useState } from 'react';

export function ClarificationInterview({ questions, onAnswer }: { readonly questions: readonly ClarificationQuestion[]; readonly onAnswer: (questionId: string, answer: unknown) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const openQuestions = questions.filter((question) => question.status === 'open');
  async function submit(question: ClarificationQuestion) {
    try { setError(null); const raw = answers[question.id] ?? ''; if (!raw) throw new Error('Provide an answer before continuing.'); await onAnswer(question.id, question.answerType === 'boolean' ? raw === 'true' : question.answerType === 'number' ? Number(raw) : raw); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the answer.'); }
  }
  return <section aria-label="Clarification interview" className="stack"><section className="card card-subtle"><h2>Evidence-backed clarification</h2><p className="muted">Open questions identify <strong>AI-inferred</strong> rules. Confirmed answers are recorded in the next workflow version as SME-confirmed policy.</p></section>{openQuestions.length === 0 ? <section className="card"><p className="empty">No open clarifications remain. The workflow is ready to compile.</p></section> : openQuestions.map((question, index) => <article className="card" key={question.id}><div className="card-header"><div><span className="metric-label">Question {String(index + 1).padStart(2, '0')}</span><h2>{question.question}</h2></div><span className="status status-warning">Open decision</span></div><p>{question.rationale}</p><p className="muted"><strong style={{ color: 'var(--text)' }}>Risk if unanswered:</strong> {question.riskIfUnanswered}</p><div className="header-actions" style={{ justifyContent: 'flex-start' }}>{question.answerType === 'boolean' || question.answerType === 'single_select' ? <select className="select" style={{ maxWidth: 360 }} value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}><option value="">Choose an answer</option>{question.suggestedAnswers.map((answer) => <option key={answer.value} value={answer.value}>{answer.label}</option>)}</select> : <input className="input" style={{ maxWidth: 360 }} value={answers[question.id] ?? ''} type={question.answerType === 'number' ? 'number' : 'text'} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />}<button className="btn btn-primary" onClick={() => void submit(question)}>Confirm answer</button></div></article>)}{error && <p className="notice" role="alert">{error}</p>}</section>;
}
