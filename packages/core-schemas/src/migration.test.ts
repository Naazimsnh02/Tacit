import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../../supabase/migrations/20260715000100_create_tacit_core.sql', import.meta.url);

describe('Milestone 1 database migration', () => {
  it('creates every required core table without invoice fields in the shared project model', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'projects', 'observation_sessions', 'workflow_events', 'documents', 'workflow_versions', 'decision_rules',
      'clarification_questions', 'agent_builds', 'test_cases', 'test_runs', 'test_case_results', 'approval_requests',
      'approval_actions', 'impact_snapshots',
    ]) expect(migration).toContain(`create table ${table}`);
    const projectDefinition = migration.slice(migration.indexOf('create table projects'), migration.indexOf('create table observation_sessions'));
    expect(projectDefinition).not.toMatch(/invoice_number|purchase_order_id|quantity_variance|vendor_name/);
  });
});
