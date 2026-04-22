import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CHARACTERS, SCENARIOS, DecisionResult } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, Loader2, Sparkles, User, ChevronRight, MessageSquare, CheckCircle2, Dices } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [question, setQuestion] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [discussion, setDiscussion] = useState<{name: string, content: string}[]>([]);
  const [results, setResults] = useState<DecisionResult[]>([]);
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
    const shuffled = [...CHARACTERS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count).map(c => c.id);
    setSelectedCharacters(selected);
  };

  const handleConsult = async () => {
    if (!question.trim()) {
      setError('请输入您的问题');
      return;
    }
    if (selectedCharacters.length === 0) {
      setError('请至少选择一位顶级思维');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setDiscussion([]);
    setResults([]);

    const selectedNames = selectedCharacters
      .map((id) => CHARACTERS.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join('、');

    const prompt = `
      你是一个模拟多位顶级思维人物的AI决策工具。
      用户面临一个决策问题，请你让以下人物先进行一轮相互讨论（碰撞不同的思维模型），然后再分别给出他们的最终决策建议。
      人物列表：${selectedNames}
      
      用户的问题是：
      "${question}"

      请严格按照以下格式输出（务必包含 <discussion> 和 <conclusions> 标签）：

      <discussion>
      人物A：发言内容...
      人物B：发言内容...
      </discussion>

      <conclusions>
      [
        {
          "characterName": "人物A",
          "conclusion": "一句话结论",
          "reasoning": "推理过程",
          "principles": ["核心原则1", "核心原则2"]
        }
      ]
      </conclusions>
    `;

    try {
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        
        // Parse discussion
        const discussionMatch = fullText.match(/<discussion>([\s\S]*?)(?:<\/discussion>|$)/);
        if (discussionMatch) {
          const discussionText = discussionMatch[1].trim();
          const lines = discussionText.split('\n').filter(l => l.trim());
          const parsedDiscussion = lines.map(line => {
            const match = line.match(/^([^：:]+)[：:]([\s\S]*)$/);
            if (match) {
              return { name: match[1].trim(), content: match[2].trim() };
            }
            return { name: 'system', content: line };
          });
          setDiscussion(parsedDiscussion);
        }

        // Parse conclusions if available and complete
        const conclusionsMatch = fullText.match(/<conclusions>([\s\S]*?)<\/conclusions>/);
        if (conclusionsMatch) {
          try {
            const jsonStr = conclusionsMatch[1].trim();
            const cleanJsonStr = jsonStr.replace(/^```json/m, '').replace(/```$/m, '').trim();
            const parsedResults = JSON.parse(cleanJsonStr) as DecisionResult[];
            setResults(parsedResults);
          } catch (e) {
            // Ignore parse errors while streaming
          }
        }
      }
      
      // Final fallback parse just in case
      const finalConclusionsMatch = fullText.match(/<conclusions>([\s\S]*?)(?:<\/conclusions>|$)/);
      if (finalConclusionsMatch && results.length === 0) {
          try {
            const jsonStr = finalConclusionsMatch[1].trim();
            const cleanJsonStr = jsonStr.replace(/^```json/m, '').replace(/```$/m, '').trim();
            const parsedResults = JSON.parse(cleanJsonStr) as DecisionResult[];
            setResults(parsedResults);
          } catch (e) {
            console.error("Failed to parse conclusions JSON at the end", e);
          }
      }

    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || '生成过程中发生错误，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
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
              {CHARACTERS.map((char) => {
                const isSelected = selectedCharacters.includes(char.id);
                return (
                  <button
                    key={char.id}
                    onClick={() => toggleCharacter(char.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                        : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">{char.name}</div>
                    <div
                      className={`text-xs line-clamp-2 ${
                        isSelected ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {char.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            onClick={handleConsult}
            disabled={isGenerating || !question.trim() || selectedCharacters.length === 0}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium shadow-md hover:bg-stone-800 focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
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

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 min-h-[600px] shadow-sm">
            {discussion.length === 0 && results.length === 0 && !isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-20">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
                  <User size={32} className="text-stone-300" />
                </div>
                <p className="text-sm font-medium">描述问题并选择人物，获取顶级思维的决策建议</p>
              </div>
            ) : (
              <div className="space-y-8">
                {discussion.length > 0 && (
                  <div className="mb-8 space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
                      <MessageSquare size={20} />
                      智囊团讨论中...
                    </h3>
                    <div className="space-y-4 bg-stone-50 rounded-2xl p-5 border border-stone-200">
                      {discussion.map((msg, idx) => {
                        const charInfo = CHARACTERS.find(c => c.name.includes(msg.name) || msg.name.includes(c.name));
                        const colorClass = charInfo?.color || 'bg-stone-200 text-stone-800 border-stone-300';
                        
                        if (msg.name === 'system') {
                           return <div key={idx} className="text-sm text-stone-500 italic">{msg.content}</div>;
                        }

                        return (
                          <motion.div 
                            key={idx} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col gap-1"
                          >
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md w-fit border ${colorClass}`}>
                              {msg.name}
                            </span>
                            <p className="text-sm text-stone-700 leading-relaxed pl-1">
                              {msg.content}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
                      <CheckCircle2 size={20} />
                      最终决策建议
                    </h3>
                    <AnimatePresence mode="popLayout">
                      {results.map((result, index) => {
                        const characterInfo = CHARACTERS.find((c) => c.name === result.characterName);
                        const colorClass = characterInfo?.color || 'bg-stone-100 text-stone-800 border-stone-200';

                        return (
                          <motion.div
                            key={result.characterName}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm"
                          >
                            <div className={`px-5 py-3 border-b flex items-center gap-3 ${colorClass}`}>
                              <div className="font-bold text-lg">{result.characterName}</div>
                              <div className="text-xs opacity-80 font-medium">
                                {characterInfo?.description}
                              </div>
                            </div>
                            <div className="p-5 space-y-5 bg-white">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-2">
                                  <ChevronRight size={14} /> 结论
                                </h4>
                                <p className="text-stone-900 font-medium text-lg leading-snug">
                                  {result.conclusion}
                                </p>
                              </div>
                              
                              <div className="w-full h-px bg-stone-100"></div>

                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-2">
                                  <ChevronRight size={14} /> 推理过程
                                </h4>
                                <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                                  {result.reasoning}
                                </p>
                              </div>

                              <div className="w-full h-px bg-stone-100"></div>

                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
                                  <ChevronRight size={14} /> 核心原则
                                </h4>
                                <ul className="space-y-2">
                                  {result.principles.map((principle, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></span>
                                      <span>{principle}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
                
                {isGenerating && results.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 space-y-4"
                  >
                    <Loader2 size={32} className="text-stone-300 animate-spin" />
                    <p className="text-sm text-stone-500 font-medium animate-pulse">
                      {discussion.length > 0 ? "正在总结最终建议..." : "正在推演决策逻辑..."}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
