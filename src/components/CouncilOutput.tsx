// Discussion + Results presentational components extracted from App.tsx
// so the live editor and the /?c=<id> share view can render the same UI
// from the same code path. Pure components — no hooks, no fetching.

import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react';
import { ADVISORS } from '../generated/advisors';
import { ADVISOR_COLORS, DEFAULT_ADVISOR_COLOR } from '../constants';
import type { DecisionCard, DiscussionMessage } from '../types/session';

interface DiscussionProps {
  messages: DiscussionMessage[];
  heading?: string;
}

export function Discussion({ messages, heading = '智囊团讨论中...' }: DiscussionProps) {
  return (
    <div className="mb-8 space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <MessageSquare size={20} />
        {heading}
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

interface ResultsProps {
  cards: DecisionCard[];
  heading?: string;
}

export function Results({ cards, heading = '最终决策建议' }: ResultsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
        <CheckCircle2 size={20} />
        {heading}
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
