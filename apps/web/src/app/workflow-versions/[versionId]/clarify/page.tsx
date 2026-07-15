'use client';

import type { ClarificationQuestion } from '@tacit/core-schemas';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClarificationInterview } from '../../../../features/clarification/clarification-interview';

export default function ClarificationPage({ params }: { readonly params: Promise<{ versionId: string }> }) {
  const [versionId, setVersionId] = useState<string | null>(null);
  const projectId = useSearchParams().get('projectId');
  const [questions, setQuestions] = useState<readonly ClarificationQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void params.then(({ versionId: id }) => setVersionId(id)); }, [params]);
  useEffect(() => { if (!versionId) return; void fetch(`/api/workflow-versions/${versionId}/questions`).then(async (response) => { const body = await response.json() as ClarificationQuestion[] | { error: string }; if (!response.ok || !Array.isArray(body)) throw new Error('error' in body ? body.error : 'Unable to load questions.'); setQuestions(body); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load questions.')); }, [versionId]);
  if (error) return <main><p role="alert">{error}</p></main>;
  if (!versionId) return <main>Loading clarification interview…</main>;
  return <main><ClarificationInterview questions={questions} onAnswer={async (questionId, answer) => { const response = await fetch(`/api/questions/${questionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) }); const body = await response.json() as { error?: string; workflowVersionId?: string }; if (!response.ok || !body.workflowVersionId) throw new Error(body.error ?? 'Unable to apply the answer.'); window.location.assign(`/workflow-versions/${body.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId ?? '')}`); }} />{questions.length === 0 && projectId ? <p><a href={`/projects/${projectId}/workflow-versions/${versionId}/build`}>Continue to build agent</a></p> : null}</main>;
}
