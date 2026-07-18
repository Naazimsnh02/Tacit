import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const extractionId = '44444444-4444-4444-8444-444444444444';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
});

describe('historical-case import API', () => {
  it('imports pack-valid cases only when their evidence filenames resolve in the project', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: projectId, organization_id: organizationId, mode: 'production' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: actorId })))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'owner' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ workflow_type: 'invoice_exception' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: extractionId, evidence_artifacts: { filename: 'invoice.md', display_name: 'Invoice' } }])))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    globalThis.fetch = fetchMock;

    const response = await POST(new Request(`http://localhost/api/projects/${projectId}/test-cases`, {
      method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify({ cases: [{
        label: 'Hold damaged delivery', evidenceFiles: ['invoice.md'], expectedOutcome: { decision: 'hold', reason: 'Damaged delivery.' },
        input: { invoiceReference: 'INV-1', purchaseOrderReference: 'PO-1', invoiceQuantity: 2, purchaseOrderQuantity: 2, invoiceUnitPrice: 100, purchaseOrderUnitPrice: 100, deliveryConfirmed: true, invoiceValue: 200, duplicateInvoice: false, emailApproval: 'none' },
      }] }),
    }), { params: Promise.resolve({ projectId }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ imported: 1 });
    const [, insert] = fetchMock.mock.calls[6];
    expect(String(insert.body)).toContain(extractionId);
  });
});
