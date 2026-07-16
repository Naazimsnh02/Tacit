import { describe, expect, it } from 'vitest';
import { createProjectRequestSchema, mapProject, pilotProjectLimit, slugifyOrganizationName, updateProjectRequestSchema } from './api';

describe('production project API contracts', () => {
  it('accepts only generic project creation fields', () => {
    expect(createProjectRequestSchema.safeParse({ organizationId: '11111111-1111-4111-8111-111111111111', name: 'Claims review', workflowType: 'customer_support_escalation' }).success).toBe(true);
    expect(createProjectRequestSchema.safeParse({ organizationId: '11111111-1111-4111-8111-111111111111', name: '', workflowType: 'invoice-exception' }).success).toBe(false);
  });

  it('does not permit an empty project update', () => {
    expect(updateProjectRequestSchema.safeParse({}).success).toBe(false);
  });

  it('maps tenant ownership and mode from persistence rows', () => {
    expect(mapProject({ id: '11111111-1111-4111-8111-111111111111', organization_id: '22222222-2222-4222-8222-222222222222', mode: 'production', created_by: '33333333-3333-4333-8333-333333333333', name: 'Claims', workflow_type: 'customer_support_escalation', status: 'draft', configuration: {}, created_at: '2026-07-16T09:00:00.000Z', updated_at: '2026-07-16T09:00:00.000Z' })).toMatchObject({ organizationId: '22222222-2222-4222-8222-222222222222', mode: 'production' });
  });

  it('creates URL-safe organization slugs without retaining the original casing', () => {
    expect(slugifyOrganizationName('Northwind & Co.')).toMatch(/^northwind-co-[a-f0-9]{8}$/);
  });
  it('keeps the pilot active-project limit bounded even with an invalid environment value', () => {
    expect(pilotProjectLimit('8')).toBe(8);
    expect(pilotProjectLimit('0')).toBe(5);
    expect(pilotProjectLimit('unbounded')).toBe(5);
  });
});
