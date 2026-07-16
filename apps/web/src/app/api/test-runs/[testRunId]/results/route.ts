import { z } from 'zod';
import { authorizeProjectRequest, errorResponse, serviceRequest } from '../../../../../lib/platform/api';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export async function GET(request: Request, context: { params: Promise<{ testRunId: string }> }) {
  try {
    const { testRunId } = await context.params;
    z.string().uuid().parse(testRunId);
    const runs = await serviceRequest<Array<{ project_id: string }>>(`test_runs?id=eq.${encodeURIComponent(testRunId)}&select=project_id&limit=1`);
    if (runs[0]) await authorizeProjectRequest(request, runs[0].project_id);
    const connection = config();
    const response = await fetch(`${connection.url}/rest/v1/test_case_results?test_run_id=eq.${encodeURIComponent(testRunId)}&select=*,test_cases!inner(label,input,expected_outcome)&order=created_at.asc`, { headers: { apikey: connection.key, Authorization: `Bearer ${connection.key}` } });
    if (!response.ok) throw new Error('Unable to load replay results.');
    return Response.json(await response.json());
  } catch (error) { return errorResponse(error); }
}
