import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv } from 'vite';

async function nodeReqToWebRequest(nodeReq: IncomingMessage, host: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of nodeReq as AsyncIterable<Buffer>) chunks.push(c);
  const body = Buffer.concat(chunks);
  const url = `${host}${nodeReq.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(','));
    else if (typeof v === 'string') headers.set(k, v);
  }
  const method = nodeReq.method ?? 'GET';
  return new Request(url, {
    method,
    headers,
    body: body.length > 0 && method !== 'GET' && method !== 'HEAD' ? new Uint8Array(body) : undefined,
  });
}

async function webResponseToNodeRes(webRes: Response, nodeRes: ServerResponse): Promise<void> {
  nodeRes.statusCode = webRes.status;
  webRes.headers.forEach((v, k) => nodeRes.setHeader(k, v));
  if (!webRes.body) {
    nodeRes.end();
    return;
  }
  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      nodeRes.write(value);
      (nodeRes as ServerResponse & { flush?: () => void }).flush?.();
    }
  } finally {
    nodeRes.end();
  }
}

type EdgeHandler = (req: Request, ctx?: { params: Record<string, string> }) => Promise<Response>;

export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const env = loadEnv('development', process.cwd(), '');
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      server.middlewares.use(async (nodeReq, nodeRes, next) => {
        if (!nodeReq.url || !nodeReq.url.startsWith('/api/')) return next();
        const pathOnly = nodeReq.url.split('?')[0];
        const host = `http://${nodeReq.headers.host ?? 'localhost:3000'}`;

        try {
          const advisorMatch = pathOnly.match(/^\/api\/advisor\/([^/]+)$/);
          let modPath: string | null = null;
          let params: Record<string, string> | undefined;
          if (pathOnly === '/api/intake-clarify') modPath = '/api/intake-clarify.ts';
          else if (pathOnly === '/api/analyze') modPath = '/api/analyze.ts';
          else if (advisorMatch) {
            modPath = '/api/advisor/[id].ts';
            params = { id: decodeURIComponent(advisorMatch[1]) };
          }
          if (!modPath) return next();

          const mod = await server.ssrLoadModule(modPath);
          const handler = mod.default as EdgeHandler;
          const webReq = await nodeReqToWebRequest(nodeReq, host);
          const webRes = await handler(webReq, params ? { params } : undefined);
          return webResponseToNodeRes(webRes, nodeRes);
        } catch (err) {
          console.error('[dev-api] error on', pathOnly, err);
          nodeRes.statusCode = 500;
          nodeRes.setHeader('Content-Type', 'application/json');
          nodeRes.end(
            JSON.stringify({
              error: { code: 'DEV_API', message: err instanceof Error ? err.message : String(err) },
            }),
          );
        }
      });
    },
  };
}
