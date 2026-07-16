import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AgentArtifactWriter } from './service';

// Next runs with apps/web as its working directory, while the restricted
// runtime is started from the repository root. Keep generated artifacts in
// the shared root-level directory used by both processes.
const generatedRoot = resolve(process.cwd(), '..', '..', 'generated');

export const localAgentArtifactWriter: AgentArtifactWriter = {
  async write(buildPath, files) {
    const destination = resolve(generatedRoot, '..', buildPath);
    if (!destination.startsWith(`${generatedRoot}\\`) && !destination.startsWith(`${generatedRoot}/`)) throw new Error('Generated artifacts must be written under generated/.');
    await mkdir(destination, { recursive: true });
    await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(destination, name), contents, 'utf8')));
  },
};
