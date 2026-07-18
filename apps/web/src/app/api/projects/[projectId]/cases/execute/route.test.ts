import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const caseId = '44444444-4444-4444-8444-444444444444';
const buildId = '55555555-5555-4555-8555-555555555555';
const workflowVersionId = '66666666-6666-4666-8666-666666666666';
const evidenceId = '77777777-7777-4777-8777-777777777777';
const approvalId = '88888888-8888-4888-8888-888888888888';
const originalFetch = globalThis.fetch;
const originalEnvironment = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY, runtime: process.env.AGENT_RUNTIME_URL };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvironment.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnvironment.anon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.service;
  process.env.AGENT_RUNTIME_URL = originalEnvironment.runtime;
});

describe('supervised case execution API', () => {
  it('creates a durable approval request for a human-review outcome without writing replay results', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.AGENT_RUNTIME_URL = 'https://runtime.example';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method ?? 'GET';
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: actorId, email: 'reviewer@example.com' }));
      if (url.includes('/rest/v1/projects?')) return new Response(JSON.stringify([{ id: projectId, organization_id: organizationId, mode: 'production' }]));
      if (url.includes('/rest/v1/organization_memberships?')) return new Response(JSON.stringify([{ role: 'owner' }]));
      if (url.includes('/rest/v1/idempotency_keys?')) return new Response(JSON.stringify([]));
      if (url.includes('/rest/v1/agent_builds?')) return new Response(JSON.stringify([{ id: buildId, workflow_version_id: workflowVersionId, projects: { workflow_type: 'invoice_exception' } }]));
      if (url.includes('/rest/v1/test_cases?')) return new Response(JSON.stringify([{ id: caseId, project_id: projectId, label: 'High value invoice', input: { invoiceReference: 'INV-1', purchaseOrderReference: 'PO-1', invoiceQuantity: 1, purchaseOrderQuantity: 1, invoiceUnitPrice: 725000, purchaseOrderUnitPrice: 725000, deliveryConfirmed: true, invoiceValue: 725000, duplicateInvoice: false, emailApproval: 'none' }, expected_outcome: { decision: 'manager_approval', reason: 'Threshold exceeded.' }, evidence_ids: [evidenceId], created_at: '2026-07-18T09:00:00.000Z' }]));
      if (url.startsWith('https://runtime.example/')) return new Response(JSON.stringify({ status: 'passed', stdout: JSON.stringify({ decision: 'human_review', reason: 'Manager approval is required.' }) }));
      if (url.endsWith('/rest/v1/approval_requests') && method === 'POST') return new Response(JSON.stringify([{ id: approvalId, project_id: projectId, workflow_version_id: workflowVersionId, status: 'pending', reason: 'Manager approval is required.', risk_level: 'high', requested_action: 'Review invoice exception recommendation', agent_recommendation: 'Human review required before an invoice exception can proceed.', confidence: 0.68, applied_rule_ids: ['manager_threshold'], agent_build_id: buildId, evidence_ids: [evidenceId], payload: {}, created_at: '2026-07-18T09:00:00.000Z' }]));
      if (url.endsWith('/rest/v1/audit_events') || url.endsWith('/rest/v1/idempotency_keys')) return new Response(null, { status: 201 });
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    globalThis.fetch = fetchMock;

    const response = await POST(new Request(`http://localhost/api/projects/${projectId}/cases/execute`, {
      method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', 'Idempotency-Key': 'supervised-case-1' }, body: JSON.stringify({ testCaseId: caseId }),
    }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ outcome: { decision: 'human_review' }, approval: { id: approvalId, status: 'pending' } });
    const approvalCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/rest/v1/approval_requests'));
    expect(String(approvalCall?.[1]?.body)).toContain(`"requested_by":"${actorId}"`);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/rest/v1/test_runs'))).toBe(false);
  });
});
