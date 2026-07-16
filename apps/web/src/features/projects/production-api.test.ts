import { describe, expect, it } from 'vitest';
import { productionHeaders } from './production-api';

describe('production API headers', () => {
  it('preserves caller headers when no browser session is available', () => {
    expect(productionHeaders({ 'Content-Type': 'application/json' }).get('Content-Type')).toBe('application/json');
    expect(productionHeaders().has('Authorization')).toBe(false);
  });
});
