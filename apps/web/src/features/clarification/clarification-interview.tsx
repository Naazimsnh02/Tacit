'use client';

import type { ClarificationQuestion } from '@tacit/core-schemas';
import { useState } from 'react';

export function ClarificationInterview({ questions, onAnswer }: { readonly questions: readonly ClarificationQuestion[]; readonly onAnswer: (questionId: string, answer: unknown) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function submit(question: ClarificationQuestion) {
    try { setError(null); const raw = answers[question.id] ?? ''; if (!raw) throw new Error('Provide an answer before continuing.'); await onAnswer(question.id, question.answerType === 'boolean' ? raw === 'true' : question.answerType === 'number' ? Number(raw) : raw); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the answer.'); }
  }
  return <section aria-label="Clarification interview"><h2>Clarification interview</h2><p>Open questions identify <strong>AI-inferred</strong> rules. Once answered, the next workflow version marks the affected rule <strong>SME-confirmed</strong>.</p>{questions.filter((question) => question.status === 'open').map((question) => <article key={question.id}><h3>{question.question}</h3><p>{question.rationale}</p><p><small>Risk if unanswered: {question.riskIfUnanswered}</small></p>{question.answerType === 'boolean' || question.answerType === 'single_select' ? <select value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}><option value="">Choose an answer</option>{question.suggestedAnswers.map((answer) => <option key={answer.value} value={answer.value}>{answer.label}</option>)}</select> : <input value={answers[question.id] ?? ''} type={question.answerType === 'number' ? 'number' : 'text'} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />}<button onClick={() => void submit(question)}>Confirm answer</button></article>)}{error && <p role="alert">{error}</p>}</section>;
}
