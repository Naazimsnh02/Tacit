'use client';

import type { ClarificationQuestion } from '@tacit/core-schemas';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClarificationInterview } from '../../../../features/clarification/clarification-interview';
import { WorkflowConfirmation } from '../../../../features/clarification/workflow-confirmation';
import { PageHeader, WorkspaceShell } from '../../../../features/ui/app-shell';
import { productionHeaders } from '../../../../features/projects/production-api';
import { tabCache } from '../../../../lib/tab-cache';

export default function ClarificationPage({ params }: { readonly params: Promise<{ versionId: string }> }) {
  const [versionId, setVersionId] = useState<string | null>(null);
  const projectId = useSearchParams().get('projectId');
  const [questions, setQuestions] = useState<readonly ClarificationQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void params.then(({ versionId: id }) => setVersionId(id));
  }, [params]);

  useEffect(() => {
    if (!versionId) return;
    const cacheKey = `${versionId}/questions`;
    const cached = tabCache.get<ClarificationQuestion[]>(cacheKey);
    if (cached) {
      setQuestions(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void fetch(`/api/workflow-versions/${versionId}/questions`, { headers: productionHeaders() })
      .then(async (response) => {
        const body = await response.json() as ClarificationQuestion[] | { error: string };
        if (!response.ok || !Array.isArray(body)) throw new Error('error' in body ? body.error : 'Unable to load questions.');
        setQuestions(body);
        tabCache.set(cacheKey, body);
      })
      .catch((reason: unknown) => {
        if (!cached) {
          setError(reason instanceof Error ? reason.message : 'Unable to load questions.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [versionId]);

  const handleAnswer = async (questionId: string, answer: unknown) => {
    const response = await fetch(`/api/questions/${questionId}/answer`, {
      method: 'POST',
      headers: productionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ answer })
    });
    const body = await response.json() as { error?: string; workflowVersionId?: string };
    if (!response.ok || !body.workflowVersionId) {
      throw new Error(body.error ?? 'Unable to apply the answer.');
    }
    
    // Invalidate the cache for the current questions version since it changes
    if (versionId) {
      tabCache.clear(`${versionId}/questions`);
    }
    
    window.location.assign(`/workflow-versions/${body.workflowVersionId}/clarify?projectId=${encodeURIComponent(projectId ?? '')}`);
  };

  return (
    <WorkspaceShell active="Clarify" mode="production" projectId={projectId ?? undefined} versionId={versionId ?? undefined}>
      <PageHeader
        breadcrumb="Clarify"
        title="Confirm decision boundaries"
        description="Resolve the few highest-impact inferred rules with their supporting evidence."
        actions={projectId && versionId ? <a className="btn btn-secondary" href={`/workflow-versions/${versionId}/graph?projectId=${encodeURIComponent(projectId)}`}>Review workflow graph</a> : undefined}
      />
      {error ? (
        <section className="notice" role="alert">
          <p>{error}</p>
        </section>
      ) : loading || !versionId ? (
        <div className="stack" style={{ gap: '20px' }}>
          <div className="card card-subtle" style={{ minHeight: '60px' }}>
            <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '320px', height: '12px' }} />
          </div>
          <div className="card" style={{ minHeight: '220px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div style={{ width: '70%' }}>
                <div className="skeleton" style={{ width: '140px', height: '12px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '280px', height: '20px' }} />
              </div>
              <div className="skeleton" style={{ width: '100px', height: '24px', borderRadius: '999px' }} />
            </div>
            <div className="stack" style={{ gap: '10px', marginBottom: '20px' }}>
              <div className="skeleton" style={{ width: '90%', height: '14px' }} />
              <div className="skeleton" style={{ width: '85%', height: '14px' }} />
              <div className="skeleton" style={{ width: '70%', height: '14px' }} />
            </div>
            <div className="header-actions" style={{ justifyContent: 'flex-start', gap: '12px' }}>
              <div className="skeleton" style={{ width: '180px', height: '36px', borderRadius: '8px' }} />
              <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }} />
              <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <ClarificationInterview questions={questions} onAnswer={handleAnswer} />
          {questions.length === 0 && projectId ? (
            <>
              <WorkflowConfirmation projectId={projectId} workflowVersionId={versionId} />
              <div style={{ marginTop: 16 }}>
                <a className="btn btn-secondary" href={`/projects/${projectId}/workflow-versions/${versionId}/build`}>
                  Continue to build
                </a>
              </div>
            </>
          ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}
