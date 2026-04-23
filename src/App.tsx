import { useState } from 'react';
import { SCENARIOS } from './constants';
import { ADVISORS } from 'virtual:advisors';
import { BrainCircuit, Sparkles, User, Dices } from 'lucide-react';

export default function App() {
  const [question, setQuestion] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleCharacter = (id: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleScenarioClick = (prompt: string) => {
    setQuestion(prompt);
  };

  const handleRandomSelect = () => {
    // Pick 2 to 4 random characters
    const count = Math.floor(Math.random() * 3) + 2; 
    const shuffled = [...ADVISORS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count).map(a => a.frontmatter.id);
    setSelectedCharacters(selected);
  };

  const handleConsult = async () => {
    if (!question.trim()) { setError('请输入您的问题'); return; }
    if (selectedCharacters.length === 0) { setError('请至少选择一位顶级思维'); return; }
    setError('会议功能正在迁移中（Sprint 0），请稍后');
  };

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

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-5 space-y-8">
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
                    onClick={() => handleScenarioClick(scenario.prompt)}
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
                onClick={handleRandomSelect}
                className="text-xs flex items-center gap-1 text-stone-500 hover:text-stone-900 transition-colors bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md"
              >
                <Dices size={14} />
                随机挑选
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ADVISORS.map((advisor) => {
                const isSelected = selectedCharacters.includes(advisor.frontmatter.id);
                return (
                  <button
                    key={advisor.frontmatter.id}
                    onClick={() => toggleCharacter(advisor.frontmatter.id)}
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
            disabled={!question.trim() || selectedCharacters.length === 0}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium shadow-md hover:bg-stone-800 focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            <span>向智囊团请教</span>
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 min-h-[600px] shadow-sm">
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-20">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
                <User size={32} className="text-stone-300" />
              </div>
              <p className="text-sm font-medium">描述问题并选择人物，获取顶级思维的决策建议</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
