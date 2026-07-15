import { compileAgent, AgentBuildInputError, AgentBuildOutputError } from '../../../../../lib/agent-builds/service';
import { localAgentArtifactWriter } from '../../../../../lib/agent-builds/file-writer';
import { SupabaseAgentBuildRepository } from '../../../../../lib/agent-builds/supabase-repository';
import { createWorkflowRegistry } from '../../../../../lib/workflow-packs';
import { z } from 'zod';

const requestSchema = z.object({ workflowVersionId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const [{ projectId }, body] = await Promise.all([context.params, request.json()]);
        const payload = requestSchema.parse(body);
        const result = await compileAgent({ projectId, workflowVersionId: payload.workflowVersionId, registry: createWorkflowRegistry(), repository: new SupabaseAgentBuildRepository(), writer: localAgentArtifactWriter, onProgress: (progress) => send('progress', progress) });
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
