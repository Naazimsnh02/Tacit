import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AgentArtifactStore, AgentBuildWorkspace } from './service';

const generatedRoot = resolve(process.cwd(), '..', '..', 'generated');

function safeDestination(buildPath: string): string {
  const destination = resolve(generatedRoot, buildPath);
  if (!destination.startsWith(`${generatedRoot}\\`) && !destination.startsWith(`${generatedRoot}/`)) throw new Error('Generated artifacts must be written under generated/.');
  return destination;
}

/** Scoped local workspace consumed by the Phase 4 validator; Phase 5 replaces it with an isolated worker volume. */
export const localAgentBuildWorkspace: AgentBuildWorkspace = {
  async write(buildPath, files) {
    const destination = safeDestination(buildPath);
    await mkdir(destination, { recursive: true });
    await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(destination, name), contents, 'utf8')));
  },
};

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Build artifact persistence is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

function objectPath(path: string): string { return path.split('/').map(encodeURIComponent).join('/'); }

/** Persists build files under a UUID-scoped, write-once storage prefix. */
export const supabaseAgentArtifactStore: AgentArtifactStore = {
  async persist(buildPath, files) {
    const connection = config();
    const paths = await Promise.all(Object.entries(files).map(async ([name, contents]) => {
      const path = `${buildPath}/${name}`;
      const response = await fetch(`${connection.url}/storage/v1/object/tacit-artifacts/${objectPath(path)}`, {
        method: 'POST', headers: { apikey: connection.key, Authorization: `Bearer ${connection.key}`, 'Content-Type': 'text/plain; charset=utf-8', 'x-upsert': 'false' }, body: contents,
      });
      if (!response.ok) throw new Error('An immutable build artifact could not be stored.');
      return path;
    }));
    return { artifactPath: buildPath, files: paths };
  },
};
