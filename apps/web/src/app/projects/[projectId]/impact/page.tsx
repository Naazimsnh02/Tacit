'use client';
import { useEffect, useState } from 'react';
import { ImpactDashboard } from '../../../../features/impact/impact-dashboard';
export default function ImpactPage({ params }: { readonly params: Promise<{ projectId: string }> }) { const [projectId, setProjectId] = useState<string | null>(null); useEffect(() => { void params.then(({ projectId: id }) => setProjectId(id)); }, [params]); return projectId ? <ImpactDashboard projectId={projectId} /> : <main>Loading impact dashboard…</main>; }
