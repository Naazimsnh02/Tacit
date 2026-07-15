import { z } from 'zod';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export async function GET(_request: Request, context: { params: Promise<{ testRunId: string }> }) {
  try {
    const { testRunId } = await context.params;
    z.string().uuid().parse(testRunId);
    const connection = config();
    const response = await fetch(`${connection.url}/rest/v1/test_case_results?test_run_id=eq.${encodeURIComponent(testRunId)}&select=*,test_cases!inner(label,input,expected_outcome)&order=created_at.asc`, { headers: { apikey: connection.key, Authorization: `Bearer ${connection.key}` } });
    if (!response.ok) throw new Error('Unable to load replay results.');
    return Response.json(await response.json());
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to load replay results.' }, { status: 400 }); }
}
