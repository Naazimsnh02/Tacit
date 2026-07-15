import { workflowReconstructionSchema, type WorkflowReconstruction } from '@tacit/core-schemas';

interface Row { readonly specification: unknown }

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

export class SupabaseWorkflowGraphRepository {
  private readonly connection = config();

  async getReconstruction(workflowVersionId: string): Promise<WorkflowReconstruction | null> {
    const response = await fetch(`${this.connection.url}/rest/v1/workflow_versions?id=eq.${encodeURIComponent(workflowVersionId)}&select=specification`, { headers: { apikey: this.connection.key, Authorization: `Bearer ${this.connection.key}` } });
    if (!response.ok) throw new Error(`Workflow graph persistence failed (${response.status}).`);
    const rows = await response.json() as Row[];
    return rows[0] ? workflowReconstructionSchema.parse(rows[0].specification) : null;
  }
}
