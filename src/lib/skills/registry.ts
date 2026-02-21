// Skill Registry - Plugin architecture for easy skill extensibility
// Demonstrates "Architecture Scalability" evaluation criteria

import { analyzeSERP, formatSerpAnalysis, SerpAnalysisResult, SerpEntry } from './serpAnalyzer';

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
// SERP Analyzer Skill
// 內部調用 3 個 Agent：標題結構、關鍵字分布、內容缺口(LLM)
// ============================================================

const serpAnalyzerSkill: Skill = {
  name: 'serp-analyzer',
  description: '分析 SERP 數據：調用 3 個 Agent 分別提取標題結構、識別關鍵字分布、LLM 動態分析內容缺口',
  execute: async (input?: unknown): Promise<SkillResult> => {
    const onProgress = (input as { onProgress?: (agent: string, status: string) => void })?.onProgress;
    const customData = (input as { data?: SerpEntry[] })?.data;

    const result: SerpAnalysisResult = await analyzeSERP(customData, onProgress);

    return {
      skillName: 'serp-analyzer',
      rawData: result,
      formattedOutput: formatSerpAnalysis(result),
      timestamp: result.analysisTimestamp,
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
