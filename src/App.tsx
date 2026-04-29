import { useState } from 'react';
import { ADVISORS } from './generated/advisors';
import { SCENARIOS, ADVISOR_COLORS, DEFAULT_ADVISOR_COLOR } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import {
  BrainCircuit,
  Loader2,
  Sparkles,
  User,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  Dices,
} from 'lucide-react';
import { useMeeting } from './hooks/useMeeting';
import type { DiscussionMessage, DecisionCard } from './types/session';
import { ErrorBanner } from './components/ErrorBanner';

export default function App() {
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
        <div className="lg:col-span-5 space-y-6 lg:space-y-8">
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

function Discussion({ messages }: { messages: DiscussionMessage[] }) {
  return (
    <div className="mb-8 space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <MessageSquare size={20} />
        智囊团讨论中...
      </h3>
      <div className="space-y-4 bg-stone-50 rounded-2xl p-5 border border-stone-200">
        {messages.map((msg) => {
          const color = ADVISOR_COLORS[msg.advisorId] ?? DEFAULT_ADVISOR_COLOR;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-1"
              data-role="discussion-message"
              data-advisor-id={msg.advisorId}
            >
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md w-fit border ${color}`}
              >
                {msg.advisorName}
              </span>
              <p className="text-sm text-stone-700 leading-relaxed pl-1 whitespace-pre-wrap">
                {msg.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Results({ cards }: { cards: DecisionCard[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <CheckCircle2 size={20} />
        最终决策建议
      </h3>
      <AnimatePresence mode="popLayout">
        {cards.map((card, index) => {
          const advisor = ADVISORS.find((a) => a.frontmatter.id === card.advisorId);
          const tagline = advisor?.frontmatter.tagline ?? '';
          const color = ADVISOR_COLORS[card.advisorId] ?? DEFAULT_ADVISOR_COLOR;

          return (
            <motion.div
              key={card.advisorId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm"
            >
              <div
                className={`px-5 py-3 border-b flex items-center gap-3 ${color}`}
              >
                <div className="font-bold text-lg">{card.characterName}</div>
                <div className="text-xs opacity-80 font-medium">{tagline}</div>
              </div>
              <div className="p-5 space-y-5 bg-white">
                <SectionBlock title="结论">
                  <p className="text-stone-900 font-medium text-lg leading-snug">
                    {card.conclusion}
                  </p>
                </SectionBlock>

                <Divider />

                <SectionBlock title="推理过程">
                  <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {card.reasoning}
                  </p>
                </SectionBlock>

                <Divider />

                <SectionBlock title="心智模型">
                  <ul className="space-y-2">
                    {card.mentalModels.map((m, i) => (
                      <li
                        key={`${m.name}-${i}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-stone-800">
                            {m.name}
                          </span>
                          <span className="text-stone-500">
                            {' — '}
                            {m.briefOfUsage}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionBlock>

                {card.discrepancy && (
                  <>
                    <Divider />
                    <SectionBlock title="校验说明">
                      <p className="text-stone-500 text-xs leading-relaxed italic">
                        {card.discrepancy}
                      </p>
                    </SectionBlock>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-2">
        <ChevronRight size={14} /> {title}
      </h4>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-full h-px bg-stone-100" />;
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
