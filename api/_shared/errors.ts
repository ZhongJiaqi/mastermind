export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function errorResponse(code: string, message: string, status = 500): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function normalizeError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) return { code: 'INTERNAL', message: err.message };
  return { code: 'INTERNAL', message: 'Unknown error' };
}
