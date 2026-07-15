import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  transpilePackages: ['@tacit/config', '@tacit/core-schemas', '@tacit/workflow-sdk', '@tacit/workflow-invoice-exception'],
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
};

export default nextConfig;
