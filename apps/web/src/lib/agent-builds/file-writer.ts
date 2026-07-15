import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AgentArtifactWriter } from './service';

const generatedRoot = resolve(process.cwd(), 'generated');

export const localAgentArtifactWriter: AgentArtifactWriter = {
  async write(buildPath, files) {
    const destination = resolve(process.cwd(), buildPath);
    if (!destination.startsWith(`${generatedRoot}\\`) && !destination.startsWith(`${generatedRoot}/`)) throw new Error('Generated artifacts must be written under generated/.');
    await mkdir(destination, { recursive: true });
    await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(destination, name), contents, 'utf8')));
  },
};
