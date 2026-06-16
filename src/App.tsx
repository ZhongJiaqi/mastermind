import { useState } from 'react';
import { ADVISORS } from './generated/advisors';
import { SCENARIOS } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import {
  BrainCircuit,
  Loader2,
  Sparkles,
  User,
  Dices,
} from 'lucide-react';
import { useMeeting } from './hooks/useMeeting';
import { ErrorBanner } from './components/ErrorBanner';
import { Discussion, Results } from './components/CouncilOutput';
import { ShareView } from './components/ShareView';

// /?c=<shareId> short-circuits the editor: render a read-only view of
// a previously stored council (currently written by the Feishu webhook
// flow). Strictly base62, 4-32 chars — anything else falls through to
// the normal editor.
function readShareIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const c = params.get('c');
  if (!c) return null;
  return /^[A-Za-z0-9]{4,32}$/.test(c) ? c : null;
}

export default function App() {
  const shareId = readShareIdFromUrl();
  if (shareId) return <ShareView shareId={shareId} />;
  return <MastermindEditor />;
}

function MastermindEditor() {
  const { state, start, reset } = useMeeting();
  const session = state.session;
  const messages = session.messages;
  const cards = session.analysis.cards;

  const [question, setQuestion] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const isRunning = session.state.kind === 'meeting-running';
  const hasContent = messages.length > 0 || cards.length > 0;
  const displayError = localError || session.analysis.error;

  const toggleAdvisor = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleScenario = (prompt: string) => {
    setQuestion(prompt);
  };

  const handleRandom = () => {
    const count = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...ADVISORS].sort(() => 0.5 - Math.random());
    setSelectedIds(shuffled.slice(0, count).map((a) => a.frontmatter.id));
  };

  const handleConsult = async () => {
    if (!question.trim()) return setLocalError('请输入您的问题');
    if (selectedIds.length === 0) return setLocalError('请至少选择一位顶级思维');
    setLocalError(null);
    reset();
    await start({ question: question.trim() }, selectedIds);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center shadow-sm">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mastermind 智囊团</h1>
            <p className="text-xs text-stone-500 font-medium">顶级思维决策模拟器</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-5 space-y-6 lg:space-y-8 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
                1. 描述你的困境
              </h2>
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：我目前在一家大厂工作，薪水不错但经常加班，感觉没有成长空间。现在有一家创业公司邀请我加入..."
              className="w-full h-40 p-4 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all resize-none text-sm leading-relaxed"
            />

            <div className="space-y-2">
              <p className="text-xs text-stone-500 font-medium">快捷场景：</p>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.label}
                    onClick={() => handleScenario(scenario.prompt)}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 rounded-full hover:bg-stone-100 hover:border-stone-300 transition-colors text-stone-600"
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
                2. 选择智囊团成员
              </h2>
              <button
                onClick={handleRandom}
                className="text-xs flex items-center gap-1 text-stone-500 hover:text-stone-900 transition-colors bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md"
              >
                <Dices size={14} />
                随机挑选
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ADVISORS.map((advisor) => {
                const id = advisor.frontmatter.id;
                const isSelected = selectedIds.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleAdvisor(id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                        : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">{advisor.frontmatter.name}</div>
                    <div
                      className={`text-xs line-clamp-2 ${
                        isSelected ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {advisor.frontmatter.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={handleConsult}
            disabled={isRunning || !question.trim() || selectedIds.length === 0}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium shadow-md hover:bg-stone-800 focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>智囊团正在思考中...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>向智囊团请教</span>
              </>
            )}
          </button>

          <AnimatePresence>
            {displayError && (
              <ErrorBanner
                key="error-banner"
                message={displayError}
                onRetry={
                  // 仅服务端错误支持重试；前端校验错误（localError）只需关闭后重新填表
                  session.analysis.error
                    ? () => {
                        setLocalError(null);
                        void handleConsult();
                      }
                    : undefined
                }
                onDismiss={() => {
                  setLocalError(null);
                  if (session.analysis.error) reset();
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-stone-200 rounded-2xl lg:rounded-3xl p-4 sm:p-6 md:p-8 min-h-[400px] lg:min-h-[600px] shadow-sm">
            {!hasContent && !isRunning ? (
              <EmptyState />
            ) : (
              <div className="space-y-8">
                {messages.length > 0 && <Discussion messages={messages} />}
                {cards.length > 0 && <Results cards={cards} />}
                {isRunning && cards.length === 0 && (
                  <LoadingHint hasMessages={messages.length > 0} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-20">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
        <User size={32} className="text-stone-300" />
      </div>
      <p className="text-sm font-medium">描述问题并选择人物，获取顶级思维的决策建议</p>
    </div>
  );
}

function LoadingHint({ hasMessages }: { hasMessages: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 space-y-4"
    >
      <Loader2 size={32} className="text-stone-300 animate-spin" />
      <p className="text-sm text-stone-500 font-medium animate-pulse">
        {hasMessages ? '正在总结最终建议...' : '正在召集军师...'}
      </p>
    </motion.div>
  );
}
