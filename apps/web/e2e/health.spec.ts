import { expect, test } from '@playwright/test';

test('health endpoint responds', async ({ request }) => {
  const response = await request.get('/api/health');
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ service: 'web', status: 'ok' });
});
