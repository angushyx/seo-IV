# SEO RAG Planner

AI 驅動的 SEO 內容規劃系統，結合 **SERP 競爭分析**、**RAG 合規檢索** 與 **Gemini LLM** 自動產出符合 YMYL 規範的文章規劃建議書。

## 系統架構

```
使用者輸入關鍵字（例：房屋二胎利率）
         │
    POST /api/analyze
         │
         ├── Step 1: SERP Analyzer Skill
         │   └── 解析 SERP_Data.json
         │       ├── 競爭對手 H1/H2 標題結構
         │       ├── 關鍵字分布統計
         │       └── Content Gap 識別
         │
         ├── Step 2: RAG Pipeline
         │   └── 讀取 Manual.txt
         │       ├── 文字切塊 (chunkManualText)
         │       ├── Gemini Embedding (gemini-embedding-001)
         │       ├── In-Memory Vector Store
         │       └── Cosine Similarity Top-K 檢索
         │
         └── Step 3: LLM Generator
             └── 融合 SERP 分析 + RAG 合規段落
                 ├── Gemini 2.5 Flash (主模型)
                 ├── Gemini 2.0 Flash (備援)
                 └── 輸出 JSON 規劃建議書
         │
         ▼
   前端展示三個 Tab：
   📊 SERP 分析 │ 🛡️ 合規檢索 │ ✨ SEO 規劃建議書
```

## 技術棧

| 元件 | 技術 |
|------|------|
| 前端 | Next.js 14 (App Router) + TailwindCSS |
| 後端 API | Next.js API Routes |
| LLM | Google Gemini (2.5-flash / 2.0-flash 自動降級) |
| Embedding | Gemini Embedding API (gemini-embedding-001) |
| 向量資料庫 | **Qdrant Cloud**（免費 Starter Plan），In-Memory 為備援 |
| 容器化 | Docker + Docker Compose |

## 快速開始

### 前置需求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Gemini API Key](https://aistudio.google.com/apikey)

### 1. 設定環境變數

```bash
cp .env.example .env.local
# 編輯 .env.local，填入你的 Gemini API Key
```

### 2. Docker 一鍵啟動

```bash
docker compose up -d --build
```

### 3. 開始使用

打開瀏覽器進入 **http://localhost:3000**，輸入關鍵字即可開始分析。

### 常用指令

| 操作 | 指令 |
|------|------|
| 啟動 | `docker compose up -d` |
| 查看日誌 | `docker logs rag-system` |
| 停止 | `docker compose down` |
| 重建（修改程式碼後） | `docker compose up -d --build` |
| 重啟（修改 Manual.txt 或 .env 後） | `docker restart rag-system` |

## 目錄結構

```
rag-system/
├── data/
│   ├── Manual.txt          # 公司內部合規手冊（RAG 知識來源）
│   └── SERP_Data.json      # SERP 競爭對手數據
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts   # 主 API：協調三階段流程
│   │   │   └── skills/route.ts    # Skill 列表 API
│   │   ├── page.tsx               # 前端 UI
│   │   ├── layout.tsx             # 頁面佈局
│   │   └── globals.css            # 樣式
│   └── lib/
│       ├── skills/
│       │   ├── serpAnalyzer.ts     # SERP 分析 Skill
│       │   └── registry.ts        # Skill 註冊中心（Plugin 架構）
│       ├── rag/
│       │   └── pipeline.ts        # RAG：切塊 + Embedding + 向量檢索
│       └── llm/
│           └── generator.ts       # LLM：Prompt 工程 + JSON 解析
├── Dockerfile
├── docker-compose.yml
└── .env.local                     # 環境變數（Gemini API Key）
```

## 架構可擴展性：如何新增 Skill

系統採用 **Plugin 架構**，新增 Skill 只需兩步：

### Step 1：實作 Skill Interface

```typescript
// src/lib/skills/myNewSkill.ts
import { Skill, SkillResult } from './registry';

const myNewSkill: Skill = {
  name: 'my-new-skill',
  description: '我的新技能描述',
  execute: async (input?: unknown): Promise<SkillResult> => {
    // 你的邏輯
    const result = { /* ... */ };
    return {
      skillName: 'my-new-skill',
      rawData: result,
      formattedOutput: '格式化輸出',
      timestamp: new Date().toISOString(),
    };
  },
};

export default myNewSkill;
```

### Step 2：註冊到 Registry

```typescript
// src/lib/skills/registry.ts
import myNewSkill from './myNewSkill';

registry.register(myNewSkill);
```

完成！新 Skill 會自動出現在 `GET /api/skills` 列表中。

## 環境變數

| 變數名 | 必填 | 說明 |
|--------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API Key |
| `QDRANT_URL` | ✅ | Qdrant Cloud 連線 URL（如 `https://xxx.cloud.qdrant.io:6333`） |
| `QDRANT_API_KEY` | ✅ | Qdrant Cloud API Key |

## License

MIT
