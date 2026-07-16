import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../../../../supabase/migrations/20260717000100_add_workflow_confirmations.sql', import.meta.url);

describe('Phase 3 workflow confirmation migration', () => {
  it('creates a domain-neutral, immutable confirmation gate with tenant RLS', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    expect(migration).toContain('create table workflow_confirmations');
    expect(migration).toContain('confirmed_by uuid not null references auth.users');
    expect(migration).toContain('alter table workflow_confirmations enable row level security');
    expect(migration).toContain('create policy workflow_confirmations_read');
    expect(migration).toContain('create policy workflow_confirmations_insert');
    expect(migration).not.toMatch(/invoice|vendor|purchase_order/i);
  });
});
