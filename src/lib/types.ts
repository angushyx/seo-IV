// Shared types for the application
// Used by both client (page.tsx) and server (API routes, markdown builder)

export interface OutlineSection {
  heading: string;
  description: string;
  source: 'serp_gap' | 'compliance' | 'seo_strategy';
}

export interface PlanningReport {
  title: string;
  outline: OutlineSection[];
  complianceNotes: string[];
  contentStrategy: string;
  riskWarnings: string[];
  disclaimer: string;
  isFallback?: boolean;
}

export interface ContentGap {
  topic: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

export interface KeywordFrequency {
  keyword: string;
  count: number;
  appearsIn: number[];
}

export interface HeadingAnalysis {
  rank: number;
  title: string;
  h1: string;
  h2List: string[];
  source_authority: string;
}

export interface SerpAnalysisData {
  headingStructure: HeadingAnalysis[];
  keywordDistribution: KeywordFrequency[];
  contentGaps: ContentGap[];
  competitorCount: number;
}

export interface RetrievedDocument {
  content: string;
  chapter: string;
  score: number;
  source: string;
}

export interface AnalysisResult {
  success: boolean;
  keyword: string;
  serpAnalysis: {
    summary: string;
    data: SerpAnalysisData;
  };
  ragRetrieval: {
    summary: string;
    documents: RetrievedDocument[];
    skipped?: RetrievedDocument[];
    threshold?: number;
  };
  planningReport: PlanningReport;
  metadata: {
    timestamp: string;
    skillsUsed: string[];
    ragChunksRetrieved: number;
  };
}

export interface SavedReport {
  filename: string;
  title: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export type ProcessStep = 'idle' | 'serp' | 'rag' | 'llm' | 'done' | 'error';
