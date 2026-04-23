import { BrainCircuit } from 'lucide-react';
import { ADVISORS } from 'virtual:advisors';
import { AnimatePresence, motion } from 'motion/react';
import { useMeeting } from './hooks/useMeeting';
import { IdleView } from './views/IdleView';
import { MeetingView } from './views/MeetingView';

export default function App() {
  const { state, dispatch, start, submitClarifications, reset, retryAdvisor } = useMeeting();
  const { session } = state;
  const isIdle = session.state.kind === 'idle';

  const randomAdvisors = () => {
    const visible = ADVISORS.filter(
      (a) =>
        !a.frontmatter.id.startsWith('valid-') && !a.frontmatter.id.startsWith('invalid-'),
    );
    const count = Math.min(visible.length, Math.floor(Math.random() * 3) + 2);
    const shuffled = [...visible].sort(() => 0.5 - Math.random());
    const ids = shuffled.slice(0, count).map((a) => a.frontmatter.id);
    dispatch({ type: 'RANDOMIZE_ADVISORS', ids });
  };

  const canSubmit =
    session.input.question.trim().length > 0 && session.selectedAdvisorIds.length > 0;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center shadow-sm">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mastermind 智囊团</h1>
            <p className="text-xs text-stone-500 font-medium">顶级思维决策模拟器</p>
          </div>
        </div>
      </header>
      <main>
        <AnimatePresence mode="wait">
          {isIdle ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <IdleView
                input={session.input}
                selectedAdvisorIds={session.selectedAdvisorIds}
                onInputChange={(patch) => dispatch({ type: 'SET_INPUT', patch })}
                onAdvisorToggle={(id) => dispatch({ type: 'TOGGLE_ADVISOR', id })}
                onRandomize={randomAdvisors}
                onScenarioPick={(prompt) => dispatch({ type: 'SET_INPUT', patch: { question: prompt } })}
                onSubmit={() => start(session.input, session.selectedAdvisorIds)}
                canSubmit={canSubmit}
                error={state.error}
              />
            </motion.div>
          ) : (
            <motion.div
              key="meeting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <MeetingView
                session={session}
                onNew={reset}
                onRetryAdvisor={retryAdvisor}
                onSubmitClarifications={submitClarifications}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
