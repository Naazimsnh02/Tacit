import { compileAgent, AgentBuildInputError, AgentBuildOutputError } from '../../../../../lib/agent-builds/service';
import { localAgentBuildWorkspace, supabaseAgentArtifactStore } from '../../../../../lib/agent-builds/file-writer';
import { createOpenAiCodexModel } from '../../../../../lib/agent-builds/openai-codex-model';
import { RuntimeAgentBuildRunner } from '../../../../../lib/agent-builds/runtime-client';
import { SupabaseAgentBuildRepository } from '../../../../../lib/agent-builds/supabase-repository';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';
import { authenticateRequest, canWrite, enforceRateLimit, organizationRoleFor, serviceRequest, ApiError } from '../../../../../lib/platform/api';
import { z } from 'zod';

const requestSchema = z.object({ workflowVersionId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const [{ projectId }, actor, body] = await Promise.all([context.params, authenticateRequest(request), request.json()]);
        const payload = requestSchema.parse(body);
        enforceRateLimit(actor.id, 'agent-build:create', 5);
        const [project] = await serviceRequest<Array<{ organization_id: string; mode: string }>>(`projects?id=eq.${encodeURIComponent(projectId)}&mode=eq.production&select=organization_id,mode&limit=1`);
        if (!project) throw new ApiError(404, 'Production project not found.');
        if (!canWrite(await organizationRoleFor(actor.id, project.organization_id))) throw new ApiError(403, 'You do not have permission to compile this workflow.');
        const result = await compileAgent({ projectId, workflowVersionId: payload.workflowVersionId, requestedBy: actor.id, registry: createWorkflowRegistry(), repository: new SupabaseAgentBuildRepository(), workspace: localAgentBuildWorkspace, artifactStore: supabaseAgentArtifactStore, runner: new RuntimeAgentBuildRunner(), model: createOpenAiCodexModel(), onProgress: (progress) => send('progress', progress) });
        send('complete', result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to compile the agent.';
        send('error', { error: message, recoverable: error instanceof z.ZodError || error instanceof AgentBuildInputError || error instanceof AgentBuildOutputError });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
