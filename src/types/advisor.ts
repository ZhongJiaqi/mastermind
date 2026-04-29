export interface AdvisorFrontmatter {
  id: string;
  name: string;
  tagline: string;
  avatarColor: string;
  speakStyle: string;
  sources?: string[];
  version: string;
}

export interface AdvisorMentalModel {
  name: string;
  method: string;
  tendency: string;
  signal: string;
}

export interface AdvisorSkill {
  frontmatter: AdvisorFrontmatter;
  mentalModels: AdvisorMentalModel[];
  quotes: string;
  blindspots: string;
  speakStyle: string;
  // `raw` 仅在 vite-plugin 内部使用（loadAdvisors 返回），运行时的 ADVISORS
  // 常量已经把它剔除（见 writeGeneratedFile）。
  raw?: string;
}
