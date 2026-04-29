// 军师配色（Tailwind class），沿用原项目 mastermind 视觉系。
// 新增军师：为 id 添加一条即可。
export const ADVISOR_COLORS: Record<string, string> = {
  buffett: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  munger: 'bg-blue-100 text-blue-800 border-blue-200',
  musk: 'bg-slate-100 text-slate-800 border-slate-200',
  caocao: 'bg-red-100 text-red-800 border-red-200',
  duanyongping: 'bg-orange-100 text-orange-800 border-orange-200',
  zhenhuan: 'bg-purple-100 text-purple-800 border-purple-200',
  trump: 'bg-amber-100 text-amber-800 border-amber-200',
  jobs: 'bg-zinc-100 text-zinc-800 border-zinc-200',
  cialdini: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  kahneman: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  holmes: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export const DEFAULT_ADVISOR_COLOR = 'bg-stone-100 text-stone-800 border-stone-200';

export const SCENARIOS = [
  {
    label: '职业决策',
    prompt: '我目前在一家大厂工作，薪水不错但经常加班，感觉没有成长空间。现在有一家创业公司邀请我加入，薪水降了30%，但给期权，且方向我很看好。我该不该换工作？',
  },
  {
    label: '情感决策',
    prompt: '我和伴侣相处了三年，感情稳定但缺乏激情，最近遇到一个让我很心动的人，我该如何抉择？',
  },
  {
    label: '投资决策',
    prompt: '最近某AI概念股大跌了40%，我之前一直很看好这家公司的技术，现在是抄底的好时机吗？',
  },
  {
    label: '日常轻决策',
    prompt: '今晚有一个重要的行业交流晚宴，我应该穿正装出席显得专业，还是穿休闲装显得平易近人？',
  },
];
