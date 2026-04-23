import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import type { Plugin } from 'vite';
import type {
  AdvisorFrontmatter,
  AdvisorMentalModel,
  AdvisorSkill,
} from '../src/types/advisor';

const VIRTUAL_ID = 'virtual:advisors';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

const frontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1).max(32),
  avatarColor: z.string().regex(/^oklch\(/),
  speakStyle: z.string().min(1).max(60),
  sources: z.array(z.string()).optional(),
  version: z.string().min(1),
});

function parseMentalModels(body: string): AdvisorMentalModel[] {
  const mSectionMatch = body.match(/##\s*M\s*[—-][^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!mSectionMatch) return [];
  const section = mSectionMatch[1];
  const modelChunks = section.split(/\n###\s+/).slice(1);
  return modelChunks.map((chunk) => {
    const [nameLine, ...rest] = chunk.split('\n');
    const name = nameLine.trim();
    const body = rest.join('\n');
    const method = extractLabeled(body, '方法本体');
    const tendency = extractLabeled(body, '典型决策倾向');
    const signal = extractLabeled(body, '适用信号');
    return { name, method, tendency, signal };
  });
}

function extractLabeled(text: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}\\*\\*\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|\\n---|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function parseSection(body: string, header: string): string {
  const re = new RegExp(`##\\s*${header}\\s*[—-][^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export async function loadAdvisors(root: string): Promise<AdvisorSkill[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const advisors: AdvisorSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(root, entry.name, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillPath, 'utf8');
      const parsed = matter(raw);
      advisors.push({
        frontmatter: parsed.data as AdvisorFrontmatter,
        mentalModels: parseMentalModels(parsed.content),
        quotes: parseSection(parsed.content, 'Q'),
        blindspots: parseSection(parsed.content, 'B'),
        speakStyle: parseSection(parsed.content, 'S'),
        raw: parsed.content,
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  advisors.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return advisors;
}

export function validateAdvisors(advisors: AdvisorSkill[]): void {
  for (const a of advisors) {
    try {
      frontmatterSchema.parse(a.frontmatter);
    } catch (err) {
      throw new Error(
        `advisor ${a.frontmatter?.id ?? '(unknown)'}: invalid frontmatter ${(err as Error).message}`,
      );
    }
    if (a.mentalModels.length < 3) {
      throw new Error(
        `advisor ${a.frontmatter.id}: requires at least 3 mental models, got ${a.mentalModels.length}`,
      );
    }
    for (const m of a.mentalModels) {
      if (!m.method || !m.tendency || !m.signal) {
        throw new Error(
          `advisor ${a.frontmatter.id}: mental model "${m.name}" missing one of 方法本体/典型决策倾向/适用信号`,
        );
      }
    }
  }
}

export function advisorsPlugin(options?: { root?: string }): Plugin {
  const advisorRoot = options?.root ?? path.resolve(process.cwd(), 'advisors');
  let cached: AdvisorSkill[] | null = null;

  return {
    name: 'advisors',
    async resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      if (!cached) {
        cached = await loadAdvisors(advisorRoot);
        validateAdvisors(cached.filter((a) => !a.frontmatter.id.startsWith('_')));
      }
      return `export const ADVISORS = ${JSON.stringify(cached)};`;
    },
    async handleHotUpdate(ctx) {
      if (ctx.file.includes(path.sep + 'advisors' + path.sep)) {
        cached = null;
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        ctx.server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
