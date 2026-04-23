#!/usr/bin/env tsx
// Regenerate src/generated/advisors.ts from advisors/<id>/SKILL.md.
// Runs via npm prebuild/predev hooks (Vercel build hits prebuild before edge
// functions are bundled) and again via the advisorsPlugin on HMR.

import path from 'node:path';
import { loadAdvisors, validateAdvisors, writeGeneratedFile } from '../vite-plugins/advisors';

async function main() {
  const root = path.resolve(process.cwd(), 'advisors');
  const outPath = path.resolve(process.cwd(), 'src/generated/advisors.ts');
  const advisors = await loadAdvisors(root);
  validateAdvisors(advisors);
  await writeGeneratedFile(advisors, outPath);
  console.log(`[gen-advisors] wrote ${advisors.length} advisors → ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error('[gen-advisors] failed:', err);
  process.exit(1);
});
