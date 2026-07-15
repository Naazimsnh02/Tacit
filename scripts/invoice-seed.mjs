import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixtureUrl = new URL('../packages/workflows/invoice-exception/fixtures/demo-seed.json', import.meta.url);

export async function loadInvoiceSeed() {
  return JSON.parse(await readFile(fixtureUrl, 'utf8'));
}

export function validateInvoiceSeed(seed) {
  const recordsByType = Object.groupBy(seed.domainRecords, ({ type }) => type);
  const counts = {
    documents: seed.documents.length,
    invoices: recordsByType.invoice_record?.length ?? 0,
    purchaseOrders: recordsByType.purchase_order_record?.length ?? 0,
    deliveries: recordsByType.delivery_record?.length ?? 0,
    vendorEmails: recordsByType.vendor_email?.length ?? 0,
    approvalMatrices: recordsByType.approval_matrix?.length ?? 0,
    expertDemonstrations: recordsByType.expert_demonstration?.length ?? 0,
    historicalCases: seed.testCases.length,
  };
  const expected = { documents: 1, invoices: 10, purchaseOrders: 10, deliveries: 10, vendorEmails: 5, approvalMatrices: 1, expertDemonstrations: 1, historicalCases: 10 };
  for (const [key, value] of Object.entries(expected)) {
    if (counts[key] !== value) throw new Error(`Expected ${value} ${key}; received ${counts[key]}.`);
  }
  if (seed.project.workflowType !== 'invoice_exception') throw new Error('Seed project has an unexpected workflow type.');
  if (seed.testCases.some(({ label, expectedOutcome }) => !label || !expectedOutcome?.decision)) throw new Error('Every historical case requires a label and expected result.');
  return counts;
}

function toProject(project) {
  return { id: project.id, name: project.name, workflow_type: project.workflowType, status: project.status, configuration: project.configuration, created_at: project.createdAt, updated_at: project.updatedAt };
}

function toDocument(document) {
  return { id: document.id, project_id: document.projectId, observation_session_id: document.observationSessionId, evidence_type: document.evidenceType, title: document.title, media_type: document.mediaType, storage_key: document.storageKey, schema_version: document.schemaVersion, metadata: document.metadata, created_at: document.createdAt };
}

function toTestCase(testCase) {
  return { id: testCase.id, project_id: testCase.projectId, label: testCase.label, input: testCase.input, expected_outcome: testCase.expectedOutcome, evidence_ids: testCase.evidenceIds, created_at: testCase.createdAt };
}

function supabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function request(config, method, tableOrQuery, body) {
  const response = await fetch(`${config.url}/rest/v1/${tableOrQuery}`, {
    method,
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase ${method} ${tableOrQuery} failed: ${await response.text()}`);
}

export async function persistInvoiceSeed(seed) {
  const config = supabaseConfiguration();
  if (!config) return false;
  await request(config, 'DELETE', `projects?id=eq.${seed.project.id}`);
  await request(config, 'POST', 'projects', [toProject(seed.project)]);
  await request(config, 'POST', 'documents', seed.documents.map(toDocument));
  await request(config, 'POST', 'test_cases', seed.testCases.map(toTestCase));
  await request(config, 'POST', 'invoice_exception_records', seed.domainRecords.map((record) => ({ project_id: seed.project.id, record_id: record.id, record_type: record.type, schema_version: record.schemaVersion, payload: record.payload })));
  return true;
}

export async function seedInvoiceDemo() {
  const seed = await loadInvoiceSeed();
  const counts = validateInvoiceSeed(seed);
  return { counts, persisted: await persistInvoiceSeed(seed) };
}

export const fixturePath = fileURLToPath(fixtureUrl);
