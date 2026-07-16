import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../../supabase/migrations/20260715000100_create_tacit_core.sql', import.meta.url);
const identityMigrationUrl = new URL('../../../supabase/migrations/20260716001000_add_product_modes_identity_and_tenant_rls.sql', import.meta.url);
const privateRlsMigrationUrl = new URL('../../../supabase/migrations/20260716001100_move_rls_helpers_to_private_schema.sql', import.meta.url);
const privateRlsGrantMigrationUrl = new URL('../../../supabase/migrations/20260716001200_grant_private_rls_helpers_to_authenticated.sql', import.meta.url);

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

  it('keeps RLS helper functions out of the exposed RPC schema', async () => {
    const migration = await readFile(privateRlsMigrationUrl, 'utf8');
    expect(migration).toContain('create schema if not exists private');
    expect(migration).toContain('alter function public.can_read_project(uuid) set schema private');
    expect(migration).toContain('revoke all on all functions in schema private from public, anon, authenticated');
  });

  it('allows authenticated policy evaluation without exposing private RPCs', async () => {
    const migration = await readFile(privateRlsGrantMigrationUrl, 'utf8');
    expect(migration).toContain('grant usage on schema private to authenticated');
    expect(migration).toContain('grant execute on all functions in schema private to authenticated');
  });
});

describe('Phase 0 and 1 migration', () => {
  it('isolates the demo tenant and adds tenant policies for every existing project table', async () => {
    const migration = await readFile(identityMigrationUrl, 'utf8');
    expect(migration).toContain("'Tacit Demo', 'tacit-demo', 'demo'");
    expect(migration).toContain('create table organizations');
    expect(migration).toContain('create table organization_memberships');
    expect(migration).toContain('create table audit_events');
    expect(migration).toContain('create table idempotency_keys');
    expect(migration).toContain("'tacit-artifacts'");
    for (const table of ['projects', 'documents', 'workflow_events', 'workflow_versions', 'agent_builds', 'approval_requests', 'agent_build_logs']) {
      expect(migration).toMatch(new RegExp(`policy ${table.replace(/_/g, '_')}.*`));
    }
    expect(migration).toContain('public.can_read_project');
    expect(migration).toContain('public.can_write_project');
  });
});
