'use client';
import { useEffect, useState } from 'react';
import { ApprovalDashboard } from '../../../../features/approvals/approval-dashboard';
export default function ApprovalsPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return projectId ? <ApprovalDashboard projectId={projectId} /> : <main>Loading approvals…</main>; }
