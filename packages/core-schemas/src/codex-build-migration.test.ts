import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Codex build provenance migration', () => {
  it('keeps build provenance tenant-scoped and build artifacts immutable to clients', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260717000200_add_codex_build_provenance.sql'), 'utf8');
    expect(migration).toContain('add column promotion_status');
    expect(migration).toContain('create table agent_build_repairs');
    expect(migration).toContain('agent_build_repairs_read');
    expect(migration).toContain("<> 'builds'");
  });
});
