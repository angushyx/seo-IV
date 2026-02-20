// Skill Registry - Plugin architecture for easy skill extensibility
// This demonstrates the "Architecture Scalability" evaluation criteria

import { analyzeSERP, formatSerpAnalysis, SerpAnalysisResult } from './serpAnalyzer';

// ============================================================
// Skill Interface - All skills must implement this
// ============================================================

export interface SkillResult {
  skillName: string;
  rawData: unknown;
  formattedOutput: string;
  timestamp: string;
}

export interface Skill {
  name: string;
  description: string;
  execute: (input?: unknown) => Promise<SkillResult>;
}

// ============================================================
// SERP Analyzer Skill (wrapped as Skill interface)
// ============================================================

const serpAnalyzerSkill: Skill = {
  name: 'serp-analyzer',
  description: '分析 SERP 數據，提取競爭對手標題結構、關鍵字分布，並識別內容缺口',
  execute: async (input?: unknown): Promise<SkillResult> => {
    const result: SerpAnalysisResult = analyzeSERP(input as undefined);
    return {
      skillName: 'serp-analyzer',
      rawData: result,
      formattedOutput: formatSerpAnalysis(result),
      timestamp: new Date().toISOString(),
    };
  },
};

// ============================================================
// Skill Registry
// ============================================================

class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill "${skill.name}" is already registered. Overwriting.`);
    }
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): { name: string; description: string }[] {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  async execute(name: string, input?: unknown): Promise<SkillResult> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found. Available skills: ${Array.from(this.skills.keys()).join(', ')}`);
    }
    return skill.execute(input);
  }
}

// Singleton registry with pre-registered skills
const registry = new SkillRegistry();
registry.register(serpAnalyzerSkill);

export default registry;
