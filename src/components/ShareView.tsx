// Read-only council renderer for /?c=<shareId>.
//
// Fetches the blob written by the Feishu webhook flow from /api/share?id=…,
// parses fullText via the same parser the live editor uses, and renders
// the discussion + decision cards through CouncilOutput.

import { useEffect, useState } from 'react';
import { BrainCircuit, Loader2, ExternalLink } from 'lucide-react';
import { parseCouncilStream } from '../lib/councilParser';
import { Discussion, Results } from './CouncilOutput';

interface ShareBlob {
  question: string;
  selectedAdvisorIds: string[];
  fullText: string;
  modelUsed?: string;
  source?: string;
  createdAt: number;
}

interface ShareViewProps {
  shareId: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; blob: ShareBlob };

function formatCreatedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ShareView({ shareId }: ShareViewProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
        if (!res.ok) {
          const body = await res.text();
          let msg = `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(body) as { error?: { message?: string } };
            if (parsed.error?.message) msg = parsed.error.message;
          } catch {
            /* keep default */
          }
          if (!cancelled) setState({ kind: 'error', message: msg });
          return;
        }
        const blob = (await res.json()) as ShareBlob;
        if (!cancelled) setState({ kind: 'ready', blob });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center shadow-sm">
            <BrainCircuit size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Mastermind 智囊团</h1>
            <p className="text-xs text-stone-500 font-medium">分享的圆桌讨论 · 只读</p>
          </div>
          <a
            href="/"
            className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1"
          >
            <ExternalLink size={14} /> 自己问一个
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {state.kind === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 size={28} className="text-stone-300 animate-spin" />
            <p className="text-sm text-stone-500">加载中……</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="border border-rose-200 bg-rose-50 rounded-2xl p-6 space-y-2">
            <h2 className="text-sm font-semibold text-rose-700">无法加载分享内容</h2>
            <p className="text-sm text-rose-600">{state.message}</p>
            <a
              href="/"
              className="inline-block mt-2 text-sm font-medium text-stone-700 underline"
            >
              去主页自己问一次 →
            </a>
          </div>
        )}

        {state.kind === 'ready' && (
          <ShareContent blob={state.blob} />
        )}
      </main>
    </div>
  );
}

function ShareContent({ blob }: { blob: ShareBlob }) {
  const parsed = parseCouncilStream(blob.fullText);
  const createdAt = formatCreatedAt(blob.createdAt);
  const source =
    blob.source === 'feishu'
      ? '飞书 DM'
      : blob.source === 'web'
        ? '网页'
        : blob.source ?? '';
  const subline = [source, createdAt].filter(Boolean).join(' · ');

  return (
    <>
      <section className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          原问题
        </h2>
        <p className="text-lg text-stone-900 leading-snug whitespace-pre-wrap">
          {blob.question}
        </p>
        {subline && (
          <p className="text-xs text-stone-400">{subline}</p>
        )}
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm space-y-8">
        {parsed.messages.length > 0 ? (
          <Discussion messages={parsed.messages} heading="圆桌讨论" />
        ) : (
          <div className="text-sm text-stone-500">（讨论解析失败）</div>
        )}
        {parsed.cards && parsed.cards.length > 0 && (
          <Results cards={parsed.cards} heading="决策建议" />
        )}
      </section>

      {blob.modelUsed && (
        <p className="text-center text-xs text-stone-400">
          本场模型: {blob.modelUsed}
        </p>
      )}
    </>
  );
}
