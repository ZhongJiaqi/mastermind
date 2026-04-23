import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

const EDGE_ENTRIES = [
  'api/intake-clarify.ts',
  'api/advisor/[id].ts',
  'api/analyze.ts',
];

describe('edge function bundling', () => {
  it.each(EDGE_ENTRIES)(
    '%s bundles without unresolvable imports (Vercel edge compatibility)',
    (entry) => {
      const cmd = [
        'npx',
        'esbuild',
        `"${entry}"`,
        '--bundle',
        '--platform=neutral',
        '--format=esm',
        '--target=es2022',
        '--external:openai',
        '--outfile=/dev/null',
      ].join(' ');
      expect(() => {
        execSync(cmd, { cwd: projectRoot, stdio: 'pipe' });
      }).not.toThrow();
    },
    30_000,
  );
});
