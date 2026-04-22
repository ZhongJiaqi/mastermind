export interface Character {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  color: string;
}

export interface DecisionResult {
  characterName: string;
  conclusion: string;
  reasoning: string;
  principles: string[];
}

export const CHARACTERS: Character[] = [
  {
    id: 'buffett',
    name: '巴菲特',
    description: '价值投资、长期主义、安全边际',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'munger',
    name: '查理·芒格',
    description: '多元思维模型、逆向思考、普世智慧',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    id: 'musk',
    name: '埃隆·马斯克',
    description: '第一性原理、物理学思维、极致野心',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    id: 'caocao',
    name: '曹操',
    description: '实用主义、杀伐果断、唯才是举',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    id: 'duanyongping',
    name: '段永平',
    description: '本分、做对的事情、把事情做对',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    id: 'zhangxiaolong',
    name: '张小龙',
    description: '同理心、极简主义、直击本质',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    id: 'zhenhuan',
    name: '甄嬛',
    description: '高情商、隐忍克制、复杂环境生存',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'trump',
    name: '特朗普',
    description: '交易的艺术、极限施压、利益至上',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
];

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
