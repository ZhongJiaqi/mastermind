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
  raw: string;
}
