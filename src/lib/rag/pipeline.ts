// RAG Pipeline - Embedding, Vector Storage, and Retrieval
// Uses Gemini Embedding API + Qdrant Cloud (primary) or In-Memory (fallback)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';

// ============================================================
// Types
// ============================================================

export interface TextChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chapter: string;
    chunkIndex: number;
  };
}

export interface RetrievedDocument {
  content: string;
  chapter: string;
  score: number;
  source: string;
}

export interface RetrieveResult {
  docs: RetrievedDocument[];        // 超過閾值
  skipped: RetrievedDocument[];     // 低於閾值被過濾
  threshold: number;                // 使用的閾值
}

// ============================================================
// Vector Store Interface
// ============================================================

interface VectorStore {
  upsert(id: string, vector: number[], payload: TextChunk): Promise<void>;
  search(queryVector: number[], topK: number): Promise<{ payload: TextChunk; score: number }[]>;
  size: number;
  readonly type: string;
}

// ============================================================
// Qdrant Cloud Vector Store
// ============================================================

const COLLECTION_NAME = 'seo_manual';
const VECTOR_DIM = 3072; // gemini-embedding-001 維度

class QdrantVectorStore implements VectorStore {
  private client: QdrantClient;
  private _size: number = 0;
  readonly type = 'Qdrant Cloud';

  constructor(url: string, apiKey: string) {
    this.client = new QdrantClient({ url, apiKey });
  }

  async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

      if (exists) {
        // 檢查維度是否正確，不正確就重建
        const info = await this.client.getCollection(COLLECTION_NAME);
        const existingDim = (info.config?.params?.vectors as { size?: number })?.size;
        if (existingDim && existingDim !== VECTOR_DIM) {
          console.log(`[Qdrant] ⚠️ 維度不符（${existingDim} → ${VECTOR_DIM}），重建 collection`);
          await this.client.deleteCollection(COLLECTION_NAME);
        } else {
          this._size = info.points_count ?? 0;
          console.log(`[Qdrant] ✅ collection 已存在，目前 ${this._size} 筆`);
          return;
        }
      }

      await this.client.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_DIM, distance: 'Cosine' },
      });
      console.log(`[Qdrant] ✅ 建立 collection: ${COLLECTION_NAME}（${VECTOR_DIM} 維）`);
    } catch (error) {
      throw new Error(`Qdrant 連線失敗: ${error instanceof Error ? error.message : error}`);
    }
  }

  async upsert(id: string, vector: number[], payload: TextChunk): Promise<void> {
    // 使用穩定的數字 ID（基於字串 hash）
    const pointId = this.hashId(id);
    await this.client.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            chunkId: payload.id,
            content: payload.content,
            source: payload.metadata.source,
            chapter: payload.metadata.chapter,
            chunkIndex: payload.metadata.chunkIndex,
          },
        },
      ],
    });
    this._size++;
  }

  async search(queryVector: number[], topK: number = 5): Promise<{ payload: TextChunk; score: number }[]> {
    const results = await this.client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
    });

    return results.map((r) => ({
      payload: {
        id: (r.payload?.chunkId as string) || '',
        content: (r.payload?.content as string) || '',
        metadata: {
          source: (r.payload?.source as string) || '',
          chapter: (r.payload?.chapter as string) || '',
          chunkIndex: (r.payload?.chunkIndex as number) || 0,
        },
      },
      score: r.score,
    }));
  }

  get size(): number {
    return this._size;
  }

  private hashId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================
// In-Memory Vector Store (fallback)
// ============================================================

interface VectorEntry {
  id: string;
  vector: number[];
  payload: TextChunk;
}

class InMemoryVectorStore implements VectorStore {
  private entries: VectorEntry[] = [];
  readonly type = 'In-Memory';

  async upsert(id: string, vector: number[], payload: TextChunk): Promise<void> {
    const existingIndex = this.entries.findIndex((e) => e.id === id);
    if (existingIndex >= 0) {
      this.entries[existingIndex] = { id, vector, payload };
    } else {
      this.entries.push({ id, vector, payload });
    }
  }

  async search(queryVector: number[], topK: number = 5): Promise<{ payload: TextChunk; score: number }[]> {
    if (this.entries.length === 0) return [];

    const scores = this.entries.map((entry) => ({
      payload: entry.payload,
      score: cosineSimilarity(queryVector, entry.vector),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  get size(): number {
    return this.entries.length;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================================
// Embedding Function (Gemini API)
// ============================================================

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

async function getEmbedding(text: string): Promise<number[]> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ============================================================
// Text Chunking
// ============================================================

export function chunkManualText(text: string, source: string = 'Manual.txt'): TextChunk[] {
  // Split by chapter headers (第X章)
  const chapters = text.split(/(?=第[一二三四五六七八九十]+章)/);
  const chunks: TextChunk[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const lines = chapter.trim().split('\n');
    if (lines.length === 0) return;

    // Get chapter title
    const chapterTitle = lines[0]?.replace(/[-=]/g, '').trim() || `段落 ${chapterIndex + 1}`;

    // Split into sub-chunks by section markers (e.g., "2.1", "3.2")
    const sections = chapter.split(/(?=\d+\.\d+\s)/);

    sections.forEach((section, sectionIndex) => {
      const content = section.trim();
      if (content.length < 10) return; // Skip very short chunks

      chunks.push({
        id: `${source}-ch${chapterIndex}-s${sectionIndex}`,
        content,
        metadata: {
          source,
          chapter: chapterTitle,
          chunkIndex: chunks.length,
        },
      });
    });
  });

  // If no clean splits found, chunk by paragraph
  if (chunks.length === 0) {
    const paragraphs = text.split(/\n\s*\n/);
    paragraphs.forEach((p, i) => {
      const content = p.trim();
      if (content.length < 10) return;
      chunks.push({
        id: `${source}-p${i}`,
        content,
        metadata: {
          source,
          chapter: '全文',
          chunkIndex: i,
        },
      });
    });
  }

  // Final fallback: treat entire text as one chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      id: `${source}-full`,
      content: text.trim(),
      metadata: {
        source,
        chapter: '全文',
        chunkIndex: 0,
      },
    });
  }

  return chunks;
}

// ============================================================
// Vector Store Factory
// ============================================================

async function createVectorStore(): Promise<VectorStore> {
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (qdrantUrl && qdrantApiKey) {
    try {
      const store = new QdrantVectorStore(qdrantUrl, qdrantApiKey);
      await store.ensureCollection();
      console.log('[RAG] 使用 Qdrant Cloud 向量資料庫');
      return store;
    } catch (error) {
      console.warn('[RAG] ⚠️ Qdrant 連線失敗，降級為 In-Memory:', error);
    }
  } else {
    console.warn('[RAG] ⚠️ 未設定 QDRANT_URL / QDRANT_API_KEY，使用 In-Memory 向量儲存');
  }

  return new InMemoryVectorStore();
}

// ============================================================
// RAG Pipeline Class
// ============================================================

class RAGPipeline {
  private vectorStore: VectorStore | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize: embed and store the manual text
   */
  async initialize(manualText: string): Promise<{ chunksStored: number; storeType: string }> {
    // Create vector store (Qdrant or fallback)
    this.vectorStore = await createVectorStore();

    const chunks = chunkManualText(manualText);
    console.log(`[RAG] 切塊完成，共 ${chunks.length} 個 chunks`);

    let successCount = 0;
    for (const chunk of chunks) {
      try {
        const vector = await getEmbedding(chunk.content);
        await this.vectorStore.upsert(chunk.id, vector, chunk);
        successCount++;
      } catch (error) {
        console.error(`Failed to embed chunk ${chunk.id}:`, error);
      }
    }

    if (successCount === 0) {
      throw new Error(`RAG 初始化失敗：${chunks.length} 個 chunks 全部 embedding 失敗`);
    }

    this.isInitialized = true;
    console.log(`[RAG] ✅ 成功嵌入 ${successCount}/${chunks.length} 個 chunks → ${this.vectorStore.type}`);
    return { chunksStored: this.vectorStore.size, storeType: this.vectorStore.type };
  }

  /**
   * Check if the RAG pipeline is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the vector store type
   */
  get storeType(): string {
    return this.vectorStore?.type || 'Not initialized';
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(query: string, topK: number = 3): Promise<RetrieveResult> {
    if (!this.isInitialized || !this.vectorStore || this.vectorStore.size === 0) {
      throw new Error('RAG pipeline not initialized. Call initialize() first.');
    }

    const MIN_SCORE = 0.65; // 相似度閾值
    const queryVector = await getEmbedding(query);
    const results = await this.vectorStore.search(queryVector, topK);

    const docs: RetrievedDocument[] = [];
    const skipped: RetrievedDocument[] = [];

    for (const r of results) {
      const doc = {
        content: r.payload.content,
        chapter: r.payload.metadata.chapter,
        score: Math.round(r.score * 1000) / 1000,
        source: r.payload.metadata.source,
      };
      if (r.score >= MIN_SCORE) {
        docs.push(doc);
      } else {
        skipped.push(doc);
        console.warn(`[RAG] 跳過低相似度段落（${(r.score * 100).toFixed(1)}% < ${MIN_SCORE * 100}%）: ${doc.chapter.slice(0, 40)}`);
      }
    }

    console.log(`[RAG] 檢索完成：${docs.length}/${results.length} 段超過閾值`);
    return { docs, skipped, threshold: MIN_SCORE };
  }

  /**
   * Format retrieved documents for LLM consumption
   */
  formatRetrievedDocs(docs: RetrievedDocument[]): string {
    if (docs.length === 0) return '（未檢索到相關合規文件，可能關鍵字與合規手冊語義距離過遠）';

    let output = '=== 內部合規手冊 — 相關段落 ===\n\n';
    docs.forEach((doc, i) => {
      output += `【引用 #${i + 1}】（章節：${doc.chapter}，相似度：${doc.score}）\n`;
      output += `${doc.content}\n\n`;
    });
    return output;
  }
}

// Singleton
const ragPipeline = new RAGPipeline();
export default ragPipeline;
