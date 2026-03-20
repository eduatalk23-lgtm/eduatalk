# 입시 컨설팅 도메인 에이전트 아키텍처

> 작성일: 2026-03-19
> 버전: 5.2 (2026-03-20 Phase A~E-3 + CMS C2.5+C3+C3.1+C4 완료)
> 상태: Phase A~E-3 ✅ + CMS C2.5~C4 ✅
> 기반: `student-record-roadmap.md`, `student-record-implementation-plan.md` v5, `student-record-extension-design.md` v6

---

## 1. 개요

### 1.1 목적

TimeLevelUp의 입시 컨설팅 기능을 6개 전문 도메인 에이전트 + 1개 오케스트레이터로 구조화하여,
컨설턴트와 학생이 자연어로 상호작용할 수 있는 AI 어시스턴트 시스템을 구축한다.

### 1.2 현재 상태 (2026-03-20, Phase A+B+C+D 완료)

| 영역 | 현황 |
|------|------|
| **LLM 프로바이더** | ✅ Vercel AI SDK v6 (`ai-sdk.ts` 래퍼) — `generateTextWithRateLimit`, `generateObjectWithRateLimit`, `streamTextWithRateLimit` |
| **스트리밍** | ✅ AI SDK `streamText` + `toUIMessageStreamResponse()` — `POST /api/agent` |
| **검색 전략** | ✅ pgvector 하이브리드 검색 (벡터 + SQL 메타데이터 필터) + Gemini Grounding |
| **벡터 인프라** | ✅ pgvector 활성화, `exploration_guide_content.embedding` vector(768), 7,836건 임베딩 완료 |
| **도메인 AI** | ✅ plan LLM + student-record LLM + admission + 오케스트레이터 26도구 (Agent 1·2·3·4·5·6) |
| **Tool Calling** | ✅ AI SDK `tool()` + `inputSchema` — 26개 도구 등록 |
| **멀티턴 대화** | ✅ `useChat` + `DefaultChatTransport` + `stopWhen: stepCountIs(5)` |

### 1.3 아키텍처 결정 근거

**현재 Phase에서 RAG 불필요, 에이전트 레이어가 우선:**

| 판단 근거 | 상세 |
|-----------|------|
| 도메인 지식 크기 | 42개 루브릭(~800 토큰) + 18개 계열 추천교과(~2,000 토큰) → 컨텍스트에 충분 |
| 세특 텍스트 길이 | 500자 제한 → 이미 최적 청크 크기, 별도 청킹 불필요 |
| 학생 수 | 84명 → 시맨틱 캐시 과잉, exact-match 캐시로 충분 |
| 월 비용 | Gemini Flash로 전체 분석 시 ~$0.25/월 → 예산($30~50) 대비 극도 여유 |

**RAG가 필요해지는 시점:**
- **C1** (탐구 가이드 DB 이관): 7,836건 비정형 텍스트 → 벡터 검색 필수
- **Phase 8.1** (대학 입시 DB): 26,777건 입시 데이터 → 하이브리드 검색 필요
- 졸업생 사례 축적 시 (2,000건+): 유사 프로필 매칭

---

## 2. 전체 아키텍처

### 2.1 에이전트 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎯 Orchestrator (라우터)                      │
│         "자연어 질문 분석 → 적절한 전문 에이전트로 위임"           │
│         모델: Gemini Flash (빠른 분류)                           │
└──────┬────────┬────────┬────────┬────────┬────────┬────────────┘
       │        │        │        │        │        │
       ▼        ▼        ▼        ▼        ▼        ▼
   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
   │ 📊   │ │ 🔬   │ │ 🎓   │ │ 📋   │ │ 🎤   │ │ 📝   │
   │Agent1│ │Agent2│ │Agent3│ │Agent4│ │Agent5│ │Agent6│
   │생기부 │ │탐구   │ │입시   │ │전략   │ │면접   │ │리포트 │
   │분석   │ │가이드 │ │배치   │ │수립   │ │대비   │ │생성   │
   │      │ │(CMS) │ │      │ │      │ │      │ │      │
   │Phase │ │C1~C5 │ │Phase │ │Phase │ │Phase │ │Phase │
   │5~7   │ │      │ │8.1~  │ │7     │ │6.5   │ │9     │
   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

### 2.2 에이전트 간 데이터 흐름

```
Agent 1 (생기부 분석)
  │ 역량 진단, 강약점
  ├──────────────────→ Agent 4 (전략): 약점 기반 보완 전략
  ├──────────────────→ Agent 2 (탐구): 역량 갭에 맞는 가이드 추천
  ├──────────────────→ Agent 5 (면접): 세특 기반 질문 생성
  └──────────────────→ Agent 3 (배치): 교과이수적합도 연동

Agent 3 (입시 배치)
  │ 합격권 분석
  ├──────────────────→ Agent 4 (전략): 목표 대학 기준 전략 조정
  └──────────────────→ Agent 5 (면접): 지원 대학별 면접 준비

Agent 2 (탐구 가이드)
  │ 배정된 가이드
  └──────────────────→ Agent 1 (생기부): 활동→세특 연결 추적

                    모든 에이전트
                        │
                        ▼
                Agent 6 (리포트): 종합 보고서
```

---

## 3. 기술 스택 결정

### 3.1 AI SDK 마이그레이션 (Vercel AI SDK v6)

**결정: 기존 자체 구현 → AI SDK v6으로 점진 마이그레이션**

| 현재 자체 구현 | AI SDK v6 대체 | 효과 |
|--------------|---------------|------|
| `BaseLLMProvider` 추상화 (~500줄) | `google('gemini-2.0-flash')` 한 줄 | 프로바이더 코드 대폭 감소 |
| `buildGroundingTools()` (~60줄) | `google.tools.googleSearch({})` | 내장 지원 |
| `extractJSON()` 수동 파싱 | `generateObject()` + Zod 스키마 | 타입 안전 + 파싱 에러 제거 |
| SSE 스트리밍 수동 구현 | `streamText().toDataStreamResponse()` | 클라이언트 `useChat()` 연동 |
| Tool Calling 없음 | `tool()` + `stopWhen` + `ToolLoopAgent` | **에이전트 핵심 기능** |
| 임베딩 없음 | `embed()` / `embedMany()` | pgvector 연동 내장 |

**유지해야 할 것:**
- `GeminiQuotaTracker` — AI SDK에 동등 기능 없음 (Free Tier 보호)
- `GeminiRateLimiter` (4초 간격) — Free Tier 필수
- 도메인 프롬프트 코드 — SDK와 무관
- LLM 메트릭스 시스템 — 에이전트용으로 확장

**마이그레이션 코드 비교:**

```typescript
// === 현재: suggestStrategies.ts (자체 구현) ===
const provider = getGeminiProvider();
const result = await provider.createMessage({
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }],
  modelTier: "fast",
  grounding: { enabled: true, mode: "dynamic" },
});
const parsed = parseResponse(result.content);

// === AI SDK v6: 동일 기능 ===
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const { text, sources } = await generateText({
  model: google("gemini-2.0-flash"),
  tools: { google_search: google.tools.googleSearch({}) },
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  output: strategySchema,  // Zod → 자동 파싱 + 타입 안전
});
```

**패키지:**
```bash
pnpm add ai @ai-sdk/google @ai-sdk/anthropic @ai-sdk/openai
```

### 3.2 임베딩 모델

**결정: `gemini-embedding-001` (768차원)**

| 항목 | 선택 | 근거 |
|------|------|------|
| 모델 | `gemini-embedding-001` | 이미 Google 생태계 사용 중, 추가 API 키 불필요 |
| 차원 | 768 | 10K~50K 스케일에 충분, MRL로 필요 시 1536d 확장 가능 |
| 비용 | $0.15/1M 토큰 | 7,836건 최초 임베딩 ~$0.01 (사실상 무료) |

> **주의**: `text-embedding-004`는 2026-01-14 deprecated. 반드시 `gemini-embedding-001` 사용.

### 3.3 벡터 검색 (pgvector)

**결정: Supabase pgvector + HNSW 인덱싱**

| 항목 | 선택 | 근거 |
|------|------|------|
| 확장 | pgvector (HNSW) | 10K~50K 스케일에 충분, Supabase 기본 제공 |
| 거리 함수 | 코사인 (`<=>`) | 안전한 기본값, 대부분 임베딩 API와 호환 |
| HNSW 파라미터 | m=16, ef_construction=64 | 현재 스케일에서 기본값 적절 |
| 아키텍처 | 도메인 테이블에 임베딩 컬럼 추가 | Supabase 공식 권장, 기존 RLS 정책 유지 |
| 동기화 | Trigger → pgmq → pg_cron → Edge Function | Supabase 네이티브, 외부 인프라 불필요 |

**하이브리드 검색 (벡터 + SQL 필터):**

```sql
CREATE OR REPLACE FUNCTION search_guides(
  query_embedding vector(768),
  career_filter text DEFAULT NULL,
  subject_filter text DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE (id uuid, title text, overview text, score float)
LANGUAGE sql STABLE
AS $$
  SELECT g.id, g.title, c.overview,
    1 - (c.embedding <=> query_embedding) AS score
  FROM exploration_guides g
  JOIN exploration_guide_content c ON c.guide_id = g.id
  WHERE (career_filter IS NULL OR career_filter = ANY(g.career_fields))
    AND (subject_filter IS NULL OR subject_filter = ANY(g.subject_names))
    AND g.status = 'published'
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 3.4 한국어 교육 도메인 고려사항

| 이슈 | 대응 |
|------|------|
| 세특 500자 제한 | 청킹 불필요 — 원문 그대로 임베딩 (이미 최적 크기) |
| 교육 전문용어 | `gemini-embedding-001` 다국어 학습 데이터에 포함, 추가 처리 불필요 |
| STEM 한영 혼용 | 다국어 모델이 자연스럽게 처리 |
| 한국어 BM25 | `ko_kiwi` 형태소 분석 > `simple` 단순 분리 (하이브리드 검색 시) |
| 도메인 지식 주입 | 현재 방식 유지 (42개 루브릭 ~800토큰 직접 프롬프트 주입) — 현 스케일에서 RAG보다 효율적 |

---

## 4. 에이전트 상세 설계

### 4.1 Agent 1: 생기부 분석 에이전트 (Record Analyst)

| 항목 | 내용 |
|------|------|
| **역할** | 세특/창체/행특/독서 → 역량 진단, 강약점, 스토리라인 분석 |
| **현재 상태** | Phase 5~7 **구현 완료** — 에이전트 래핑만 필요 |
| **데이터 소스** | `seteks`, `changche`, `haengteuk`, `reading`, `competency_scores`, `diagnosis`, `storylines`, `strategies` |
| **벡터화 대상** | 세특 서술 텍스트, 창체 기록 → 임베딩 (Phase 9에서 활성화) |
| **최적 모델** | Claude standard (서사 분석 강점) |
| **쿼리 예시** | "이 학생의 2학년 세특에서 탐구역량이 어떻게 드러나?" |
| **구현 파일** | `lib/domains/student-record/llm/actions/` (suggestTags, analyzeWithHighlight, analyzeCompetency, generateDiagnosis, detectInquiryLinks, generateInterviewQuestions, suggestStrategies) |

**도구(Tools):**

```typescript
// 기존 구현을 AI SDK tool()로 래핑
const tools = {
  analyzeCompetency: tool({
    description: "전체 세특/창체/행특 → 10개 역량 항목 등급+근거 평가",
    inputSchema: z.object({
      studentId: z.string(),
      grade: z.number().optional(),
    }),
    execute: async ({ studentId, grade }) => {
      // 기존 analyzeCompetency.ts 호출
    },
  }),
  extractHighlights: tool({
    description: "세특 원문에서 역량별 근거 구절 하이라이트 추출",
    inputSchema: z.object({
      content: z.string(),
      recordType: z.enum(["setek", "changche", "haengteuk"]),
      subject: z.string().optional(),
    }),
    execute: async (input) => {
      // 기존 analyzeWithHighlight.ts 호출
    },
  }),
  detectStoryline: tool({
    description: "학년간 후속탐구 연결 감지 + 스토리라인 제안",
    inputSchema: z.object({ studentId: z.string() }),
    execute: async ({ studentId }) => {
      // 기존 detectInquiryLinks.ts 호출
    },
  }),
  getWarnings: tool({
    description: "현재 경보 항목 조회 (기록 누락, 역량 약점, 최저 미달 등)",
    inputSchema: z.object({ studentId: z.string() }),
    execute: async ({ studentId }) => {
      // 기존 warnings/engine.ts 호출
    },
  }),
};
```

---

### 4.2 Agent 2: 탐구 가이드 에이전트 (Exploration Guide / CMS)

| 항목 | 내용 |
|------|------|
| **역할** | 학생 수준/진로에 맞는 교과 연계 탐구 가이드 추천/생성 |
| **현재 상태** | **C1 DB 완료** (2026-03-20): 7+2 테이블 + 도메인 `lib/domains/guide/` + Import CLI. RAG 핵심 적용처 |
| **데이터 소스** | `exploration_guides` (7,836건), `exploration_guide_content`, `exploration_guide_career/subject_mappings`, `exploration_guide_assignments` |
| **참조 설계** | `student-record-extension-design.md` E7, E16 (exploration_guides 3분할: meta/content/review) |
| **벡터화 대상** | 가이드 overview + theory_sections + setek_examples → 임베딩 (**핵심**) |
| **최적 모델** | Gemini Flash (검색) + Claude standard (생성) |
| **쿼리 예시** | "법학 계열 지망인데 수학 세특에 쓸 탐구 주제 추천해줘" |

**도구(Tools):**

```typescript
const tools = {
  searchGuides: tool({
    description: "벡터+SQL 하이브리드 검색으로 관련 탐구 가이드 검색",
    inputSchema: z.object({
      query: z.string(),
      careerField: z.string().optional(),
      subject: z.string().optional(),
      difficultyLevel: z.enum(["basic", "intermediate", "advanced"]).optional(),
      matchCount: z.number().default(10),
    }),
    execute: async (input) => {
      const { embedding } = await embed({
        model: google("gemini-embedding-001"),
        value: input.query,
      });
      return supabase.rpc("search_guides", {
        query_embedding: embedding,
        career_filter: input.careerField,
        subject_filter: input.subject,
        match_count: input.matchCount,
      });
    },
  }),
  checkSchoolUsage: tool({
    description: "학교별 가이드 사용 이력 확인 (3년 중복 방지)",
    inputSchema: z.object({
      guideId: z.string(),
      schoolId: z.string(),
    }),
    execute: async ({ guideId, schoolId }) => {
      // guide_usage_history 조회
    },
  }),
  generateGuide: tool({
    description: "5가지 소스에서 새 탐구 가이드 AI 생성",
    inputSchema: z.object({
      source: z.enum(["keyword", "pdf", "url", "clone", "enhance"]),
      input: z.string(),
      targetCareer: z.string().optional(),
      targetSubject: z.string().optional(),
    }),
    execute: async (input) => {
      // C3 AI 생성 파이프라인 호출
    },
  }),
  checkSimilarity: tool({
    description: "기존 가이드와의 유사도 탐지 (중복 방지)",
    inputSchema: z.object({ guideId: z.string() }),
    execute: async ({ guideId }) => {
      // pgvector 코사인 유사도 계산
    },
  }),
};
```

**pgvector 스키마 (C3에서 별도 테이블로 생성 — C1 3분할 설계 반영):**

```sql
-- exploration_guide_content 테이블에 임베딩 컬럼 추가
ALTER TABLE exploration_guide_content
  ADD COLUMN embedding vector(768);

CREATE INDEX idx_guide_content_embedding ON exploration_guide_content
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 임베딩 동기화 트리거 (Supabase 공식 패턴)
-- INSERT/UPDATE 시 pgmq 큐에 임베딩 작업 등록
-- pg_cron (10초 폴링) → Edge Function → gemini-embedding-001 호출 → DB 업데이트
```

---

### 4.3 Agent 3: 입시 배치 에이전트 (Admissions Placement)

| 항목 | 내용 |
|------|------|
| **역할** | 내신/모의고사 기반 합격권 분석, 6장 최적 배분 |
| **현재 상태** | ✅ **Phase D 완료** — 6도구 래핑 (searchAdmissionData, getUniversityScoreInfo, runPlacementAnalysis, filterPlacementResults, simulateCardAllocation, analyzeScoreImpact) |
| **데이터 소스** | `university_admissions` (26,305건), `admission_score_configs` (552건), `admission_score_conversions` (628K건), `admission_restrictions` (586건), `applications`, `min_score_targets` |
| **벡터화 대상** | 불필요 — 순수 구조화 데이터, **결정론적 엔진** 중심 |
| **최적 모델** | 계산은 코드, LLM은 해석/추천 텍스트 생성만 |
| **쿼리 예시** | "내신 2.3인데 서울대 경영 학종 가능성은?" |
| **구현 파일** | `lib/domains/admission/calculator/` (10파일, 63패턴 레지스트리), `lib/domains/admission/import/` (6파일) |

> **핵심**: 이 에이전트는 **LLM 의존도가 가장 낮음**. 계산은 이미 100+ 테스트된 결정론적 엔진,
> LLM은 결과를 자연어로 설명할 때만 사용.

**도구(Tools):**

```typescript
const tools = {
  calculatePlacement: tool({
    description: "합격 가능성 판정 (소신/적정/안정)",
    inputSchema: z.object({
      studentId: z.string(),
      universityId: z.string(),
      admissionType: z.string(),
    }),
    execute: async (input) => {
      // Phase 8.5 결정론적 엔진 호출
    },
  }),
  simulateMinScore: tool({
    description: "수능최저 시뮬레이션 (what-if 시나리오 포함)",
    inputSchema: z.object({
      targetId: z.string(),
      whatIf: z.record(z.string(), z.number()).optional(),
    }),
    execute: async (input) => {
      // 기존 min-score-simulator.ts 호출 (14 tests)
    },
  }),
  optimize6Slots: tool({
    description: "수시 6장 최적 배분 (소신/적정/안정 분포)",
    inputSchema: z.object({
      studentId: z.string(),
      candidates: z.array(z.object({
        universityId: z.string(),
        admissionType: z.string(),
      })),
    }),
    execute: async (input) => {
      // Phase 8.5 6장 배분 엔진
    },
  }),
  searchAlumni: tool({
    description: "유사 프로필 졸업생 검색 (SQL 기반)",
    inputSchema: z.object({
      gpaRange: z.tuple([z.number(), z.number()]),
      careerField: z.string().optional(),
      targetUniversity: z.string().optional(),
    }),
    execute: async (input) => {
      // 기존 alumni-search.ts 호출
    },
  }),
  checkInterviewConflict: tool({
    description: "면접일 겹침 확인",
    inputSchema: z.object({ studentId: z.string() }),
    execute: async ({ studentId }) => {
      // 기존 interview-conflict-checker.ts 호출 (12 tests)
    },
  }),
};
```

---

### 4.4 Agent 4: 전략 수립 에이전트 (Strategy Advisor)

| 항목 | 내용 |
|------|------|
| **역할** | 진단 결과 → 보완 전략 + 로드맵 + 우선순위 |
| **현재 상태** | Phase 7 **구현 완료** (Gemini Grounding) — 에이전트 래핑만 필요 |
| **데이터 소스** | `strategies`, `roadmap_items`, `warnings`, Agent 1 진단 결과 |
| **구현 파일** | `lib/domains/student-record/llm/actions/suggestStrategies.ts`, `lib/domains/student-record/llm/prompts/strategyRecommend.ts` |
| **벡터화 대상** | 전략 텍스트 → 임베딩 (유사 전략 재활용, 선택적) |
| **최적 모델** | Gemini Grounding (웹 검색으로 최신 정보 반영) |
| **쿼리 예시** | "탐구역량이 약한데 남은 학기에 뭘 해야 해?" |

**도구(Tools):**

```typescript
const tools = {
  getWarnings: tool({
    description: "현재 경보 항목 조회",
    inputSchema: z.object({ studentId: z.string() }),
    execute: async ({ studentId }) => {
      // 기존 warnings/engine.ts
    },
  }),
  getDiagnosis: tool({
    description: "AI/수동 진단 조회",
    inputSchema: z.object({
      studentId: z.string(),
      source: z.enum(["ai", "manual"]).optional(),
    }),
    execute: async (input) => {
      // 기존 diagnosis-repository.ts
    },
  }),
  suggestStrategies: tool({
    description: "보완 전략 생성 (Gemini Grounding 웹 검색 포함)",
    inputSchema: z.object({
      weaknesses: z.array(z.string()),
      careerField: z.string().optional(),
      grade: z.number(),
    }),
    execute: async (input) => {
      // 기존 suggestStrategies.ts 호출
    },
  }),
  updateRoadmap: tool({
    description: "로드맵 항목 추가/수정",
    inputSchema: z.object({
      studentId: z.string(),
      item: z.object({
        title: z.string(),
        targetDate: z.string(),
        category: z.string(),
      }),
    }),
    execute: async (input) => {
      // 기존 roadmap-repository.ts
    },
  }),
};
```

---

### 4.5 Agent 5: 면접 대비 에이전트 (Interview Coach)

| 항목 | 내용 |
|------|------|
| **역할** | 생기부 기반 예상 질문 + 답변 가이드 + 모의 면접 |
| **현재 상태** | Phase 6.5 **기초 구현** — 확장 필요 |
| **데이터 소스** | 전체 생기부 + `applications` (지원 대학/전형) + `interview_questions` |
| **벡터화 대상** | 면접 기출 문제 DB (향후 축적 시) |
| **최적 모델** | Claude standard (추론 + 대화 시뮬레이션) |
| **쿼리 예시** | "서울대 경영 면접에서 이 세특 내용으로 뭘 물어볼까?" |

**도구(Tools):**

```typescript
const tools = {
  generateQuestions: tool({
    description: "유형별 10문항 생성 (factual/reasoning/application/value/controversial)",
    inputSchema: z.object({
      studentId: z.string(),
      targetUniversity: z.string().optional(),
      recordIds: z.array(z.string()).optional(),
    }),
    execute: async (input) => {
      // 기존 generateInterviewQuestions.ts
    },
  }),
  evaluateAnswer: tool({
    description: "학생 답변 피드백 (강점/약점/개선 방향)",
    inputSchema: z.object({
      question: z.string(),
      answer: z.string(),
      context: z.string(), // 관련 세특 원문
    }),
    execute: async (input) => {
      // 신규 구현 필요
    },
  }),
  simulateInterview: tool({
    description: "모의 면접 (멀티턴 대화)",
    inputSchema: z.object({
      studentId: z.string(),
      mode: z.enum(["gentle", "challenging"]),
    }),
    execute: async (input) => {
      // 신규 구현 필요 (멀티턴)
    },
  }),
};
```

---

### 4.6 Agent 6: 리포트 생성 에이전트 (Report Generator)

| 항목 | 내용 |
|------|------|
| **역할** | 종합 분석 → 학부모/학생 보고서 자동 생성 |
| **현재 상태** | Phase 9 설계, **미착수** |
| **데이터 소스** | Agent 1~5의 결과물 전체 |
| **벡터화 대상** | 불필요 — 다른 에이전트 출력 조합 |
| **최적 모델** | Claude standard (긴 문서 생성) |
| **쿼리 예시** | "김세린 학생 수시 종합 보고서 만들어줘" |

---

## 5. 오케스트레이터 설계

### 5.1 라우터 패턴 (AI SDK v6 ToolLoopAgent)

```typescript
// lib/agents/orchestrator.ts
import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const orchestrator = new ToolLoopAgent({
  model: google("gemini-2.0-flash"),  // 빠른 분류용
  instructions: `당신은 입시 컨설팅 AI 코디네이터입니다.
사용자 질문을 분석하여 적절한 전문가 에이전트에게 위임하세요.

가용 전문가:
1. analyzeRecord — 생기부 분석 (역량 진단, 강약점, 하이라이트, 스토리라인)
2. searchGuides — 탐구 가이드 검색/추천 (교과 연계)
3. analyzePlacement — 합격권 분석, 6장 배분
4. suggestStrategy — 보완 전략, 로드맵
5. prepareInterview — 면접 대비, 예상 질문
6. generateReport — 종합 보고서 생성

여러 전문가가 필요하면 병렬로 호출하세요.
질문이 모호하면 사용자에게 구체적으로 물어보세요.`,

  tools: {
    analyzeRecord: tool({
      description: "생기부 분석 에이전트에게 위임",
      inputSchema: z.object({ task: z.string(), studentId: z.string() }),
      execute: async ({ task, studentId }) => {
        const result = await recordAnalysisAgent.generate({
          prompt: task,
          options: { studentId },
        });
        return result.text;
      },
    }),
    searchGuides: tool({
      description: "탐구 가이드 에이전트에게 위임",
      inputSchema: z.object({
        task: z.string(),
        careerField: z.string().optional(),
        subject: z.string().optional(),
      }),
      execute: async (input) => {
        const result = await guideSearchAgent.generate({ prompt: input.task });
        return result.text;
      },
    }),
    // ... 나머지 에이전트 도구
  },
  stopWhen: stepCountIs(5),
});
```

### 5.2 API Route (스트리밍)

```typescript
// app/api/agent/route.ts
import { createAgentUIStreamResponse } from "ai";
import { orchestrator } from "@/lib/agents/orchestrator";

export const maxDuration = 60;  // Vercel Hobby: 최대 60초

export async function POST(request: Request) {
  const { messages } = await request.json();
  // TODO: auth check + studentId 추출

  return createAgentUIStreamResponse({
    agent: orchestrator,
    uiMessages: messages,
  });
}
```

### 5.3 클라이언트 UI

```typescript
// components/agent/AgentChat.tsx
"use client";
import { useChat } from "ai/react";

export function AgentChat({ studentId }: { studentId: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/agent",
    body: { studentId },
  });

  return (
    <div>
      {messages.map((m) =>
        m.parts.map((part, i) => {
          if (part.type === "text") return <p key={i}>{part.text}</p>;
          // 도구 실행 중 상태 표시
          if (part.type === "tool-analyzeRecord" && part.state === "pending")
            return <div key={i}>생기부 분석 중...</div>;
          return null;
        })
      )}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### 5.4 에러 처리 (Graceful Degradation)

```typescript
// 멀티 에이전트 병렬 실행 시 부분 실패 허용
const results = await Promise.allSettled(
  selectedAgents.map((agent) =>
    executeWithFallback(agent.execute, agent.fallback, task, context)
  )
);

// 성공한 결과만 조합하여 응답
const successful = results
  .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === "fulfilled")
  .map((r) => r.value);

if (successful.length === 0) {
  return "모든 분석이 실패했습니다. 잠시 후 다시 시도해주세요.";
}
```

### 5.5 상태 관리 (서버리스)

| 접근 방식 | 권장 여부 | 근거 |
|-----------|----------|------|
| 프론트엔드 주도 (매 요청 시 컨텍스트 전송) | **권장** | 각 분석이 self-contained, 세션 저장 불필요 |
| DB 세션 저장 | 선택적 | 모의 면접(멀티턴) 시에만 필요 |
| Vercel KV (Redis) | 불필요 | 현재 스케일에서 과잉 |

---

## 6. 벡터 스토어 설계

### 6.1 도메인별 임베딩 테이블

```sql
-- [C1 시점] 탐구 가이드 임베딩
ALTER TABLE exploration_guide_content
  ADD COLUMN embedding vector(768);

CREATE INDEX idx_guide_embedding ON exploration_guide_content
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- [Phase 9 시점] 세특 임베딩 (유사 사례 검색용)
ALTER TABLE seteks
  ADD COLUMN embedding vector(768);

CREATE INDEX idx_setek_embedding ON seteks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- [Phase 9 시점] 전략 임베딩 (유사 전략 재활용)
ALTER TABLE strategies
  ADD COLUMN embedding vector(768);

CREATE INDEX idx_strategy_embedding ON strategies
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 6.2 임베딩 동기화 (Supabase 공식 패턴)

```
[INSERT/UPDATE on content columns]
    ↓
SQL Trigger → pgmq (메시지 큐에 작업 등록)
    ↓
pg_cron (10초마다 폴링) → 배치 수집 (10~50건)
    ↓
Supabase Edge Function 호출
    ↓
gemini-embedding-001 API → 임베딩 벡터 반환
    ↓
UPDATE table SET embedding = vector WHERE id = ?
```

### 6.3 청킹 전략

| 콘텐츠 유형 | 평균 길이 | 청킹 전략 |
|------------|----------|----------|
| 세특 레코드 | ~500자 (~200-250 토큰) | **단일 청크** (원문 그대로) |
| 탐구 가이드 overview | ~1000자 | **단일 청크** |
| 탐구 가이드 theory_sections | ~2000+자 | 재귀 청킹 (500 토큰, 50 오버랩) |
| 전략 텍스트 | ~300-500자 | **단일 청크** |

**메타데이터 프리픽스 패턴 (세특):**

```typescript
function buildEmbeddingInput(record: SetekRecord): string {
  return [
    `과목: ${record.subject}`,
    `학년: ${record.grade}학년`,
    `유형: ${record.recordType}`,
    `---`,
    record.content,
  ].join("\n");
}
```

---

## 7. 파일 구조

```
lib/agents/                              # 에이전트 레이어
├── types.ts                             # ✅ AgentContext, AgentToolResult
├── orchestrator.ts                      # ✅ createOrchestrator(ctx) → { tools: 19개, systemPrompt }
├── tools/
│   ├── data-tools.ts                    # ✅ 읽기 전용 3도구 (records, diagnosis, storylines)
│   ├── record-tools.ts                  # ✅ Agent 1: 5도구 (tags, competency, highlight, storyline, diagnosis)
│   ├── strategy-tools.ts               # ✅ Agent 4: 2도구 (strategies + warnings)
│   ├── guide-tools.ts                   # ✅ Agent 2: 4도구 (search, detail, assignments, generateGuide)
│   ├── admission-tools.ts              # ✅ Agent 3: 6도구 (search, scoreInfo, placement, filter, allocation, impact)
│   ├── interview-tools.ts              # ✅ Agent 5: 3도구 (generateInterviewQuestions, evaluateAnswer, getInterviewPrep)
│   └── report-tools.ts                 # ✅ Agent 6: 3도구 (generateReport, fetchSavedReports, getStudentOverview)
└── __tests__/
    └── orchestrator.test.ts             # ✅ 11 tests (26도구 검증)

lib/domains/guide/llm/extract/              # ✅ C3.1 콘텐츠 추출
├── pdf-extractor.ts                        # PDF URL → 텍스트 (pdf-parse v2)
└── url-extractor.ts                        # URL → 텍스트 (HTML 정제)

lib/domains/guide/vector/                # ✅ Phase C 벡터 검색
├── embedding-service.ts                 # embedSingleGuide, embedBatchGuides
└── search-service.ts                    # searchGuidesByVector → search_guides RPC

app/api/agent/
└── route.ts                             # ✅ POST: streamText + toUIMessageStreamResponse

app/(admin)/admin/agent/
├── page.tsx                             # ✅ 독립 페이지 (학생 선택 + 전폭 채팅)
└── AgentPageClient.tsx                  # ✅ 클라이언트 컴포넌트

components/agent/
├── AgentChat.tsx                        # ✅ useChat + DefaultChatTransport
└── AgentMessageBubble.tsx              # ✅ UIMessage 파트 렌더링 (text + dynamic-tool)

lib/domains/guide/llm/                   # ✅ CMS C3 AI 가이드 생성
├── types.ts                             # GeneratedGuideOutput/GuideReviewOutput Zod 스키마
├── prompts/
│   ├── keyword-guide.ts                 # 키워드→가이드 프롬프트
│   ├── clone-variant.ts                 # 기존 가이드 변형 프롬프트
│   └── review.ts                        # AI 품질 리뷰 프롬프트
└── actions/
    ├── generateGuide.ts                 # 키워드/클론 생성 Server Action
    └── reviewGuide.ts                   # AI 품질 리뷰 Server Action

lib/domains/guide/actions/
└── ai-image.ts                          # ✅ CMS C2.5 Imagen 3 이미지 생성

components/editor/
├── AiImageDialog.tsx                    # ✅ AI 이미지 프롬프트 다이얼로그
└── EditorToolbar.tsx                    # ✅ DropdownMenu (업로드/AI 생성)

lib/domains/student-record/export/          # ✅ E-3 리포트 내보내기
└── report-export.ts                        # PDF (jspdf+html2canvas) + Word (docx)

scripts/
└── embed-guides.ts                      # ✅ 배치 임베딩 CLI (--dry-run, --limit)
```

---

## 8. 구현 로드맵

### Phase A: AI SDK 마이그레이션 — ✅ 완료 (2026-03-20)

> **의존**: 없음
> **실제 공수**: 0.5일

**구현 결과:**

| 단계 | 작업 | 상태 |
|------|------|------|
| A-1 | 패키지 설치 (`ai@6`, `@ai-sdk/google@3`, `@ai-sdk/anthropic@3`, `@ai-sdk/openai@3`) | ✅ |
| A-2 | AI SDK 래퍼 생성 (`lib/domains/plan/llm/ai-sdk.ts`) | ✅ |
| A-3 | student-record 9개 LLM action 전환 | ✅ |
| A-4 | plan LLM action 전환 (직접 2개 + client.ts 경유 6개) | ✅ |
| A-5 | client.ts → AI SDK 기반 전환, Provider 타입 하위 호환 유지 | ✅ |
| A-6 | 빌드 성공 + 기존 테스트 0 regression | ✅ |

**핵심 파일**: `lib/domains/plan/llm/ai-sdk.ts`
- `generateTextWithRateLimit()` — `getGeminiProvider().createMessage()` 대체
- `generateObjectWithRateLimit()` — 구조화 출력 + Zod
- `streamTextWithRateLimit()` — 스트리밍 대체
- 모델: fast/standard → `gemini-2.0-flash`, advanced → `gemini-2.5-pro`
- `GeminiRateLimiter`/`GeminiQuotaTracker` 싱글톤 export 후 직접 통합

**검증 완료:**
- [x] 기존 모든 LLM 기능 동일 동작
- [x] `pnpm build` 성공
- [x] `pnpm test` 147 passed (0 new failures)
- [x] Gemini Grounding 웹 검색 호환 (`google.tools.googleSearch({})`)

---

### Phase B: 에이전트 오케스트레이터 — ✅ 완료 (2026-03-20)

> **의존**: Phase A
> **실제 공수**: ~1일 (B+C 병렬)

**구현 결과:**

| 단계 | 작업 | 상태 |
|------|------|------|
| B-1 | 에이전트 인프라 (`lib/agents/types.ts`, `orchestrator.ts`) | ✅ |
| B-2 | Agent 1 래핑 — 5도구 (suggestTags, analyzeCompetency, analyzeHighlight, detectStoryline, generateDiagnosis) | ✅ |
| B-3 | Agent 4 래핑 — 2도구 (suggestStrategies w/ Grounding, getWarnings) | ✅ |
| B-4 | 데이터 도구 — 3도구 (getStudentRecords, getStudentDiagnosis, getStudentStorylines) | ✅ |
| B-5 | API Route (`app/api/agent/route.ts`) — `streamText` + `stepCountIs(5)` + `toUIMessageStreamResponse()` | ✅ |
| B-6 | AgentChat UI — `useChat` + `DefaultChatTransport` + tool invocation 상태 렌더링 | ✅ |
| B-7 | 사이드 패널 — RecordSidePanelContainer에 `"agent"` 앱 추가 (Bot 아이콘) | ✅ |
| B-8 | 독립 페이지 — `/admin/agent` (학생 선택 + 전폭 채팅) | ✅ |
| B-9 | 테스트 — `lib/agents/__tests__/orchestrator.test.ts` (8개 통과) | ✅ |

**핵심 파일:**
- `lib/agents/orchestrator.ts` — `createOrchestrator(ctx)` → `{ tools: 13개, systemPrompt }`
- `lib/agents/tools/` — `data-tools.ts`, `record-tools.ts`, `strategy-tools.ts`, `guide-tools.ts`
- `app/api/agent/route.ts` — POST, `requireAdminOrConsultant()` + closure로 `studentId` 보호
- `components/agent/AgentChat.tsx` — `useChat` + `DefaultChatTransport`
- `components/agent/AgentMessageBubble.tsx` — `UIMessage` 파트별 렌더링 (text, dynamic-tool, tool-*)

**AI SDK v6 핵심 차이점 (설계 대비 실제):**
- `parameters` → `inputSchema` (tool 정의 시)
- `maxSteps: 5` → `stopWhen: stepCountIs(5)`
- `toDataStreamResponse()` → `toUIMessageStreamResponse()`
- `useChat({ api, body })` → `useChat({ transport: new DefaultChatTransport({ api, body }) })`
- `input`/`handleInputChange`/`handleSubmit` 제거 → 로컬 state + `sendMessage({ text })`
- tool parts: `tool-invocation` → `dynamic-tool` (state: `input-streaming`/`input-available`/`output-available`)

**검증 완료:**
- [x] `pnpm build` 성공
- [x] 8개 orchestrator 테스트 통과
- [x] 13개 도구 등록 확인

---

### Phase C: pgvector + CMS RAG — ✅ 완료 (2026-03-20)

> **의존**: Phase A + CMS C1 ✅
> **실제 공수**: ~1일 (Phase B와 병렬)

**구현 결과:**

| 단계 | 작업 | 상태 |
|------|------|------|
| C-1 | DB 마이그레이션 (`20260332800000_pgvector_guide_embedding.sql`) — `CREATE EXTENSION vector` + `embedding vector(768)` + HNSW 인덱스 + `search_guides` RPC | ✅ |
| C-2 | 임베딩 서비스 (`lib/domains/guide/vector/embedding-service.ts`) — `buildEmbeddingInput()`, `embedSingleGuide()`, `embedBatchGuides()` | ✅ |
| C-3 | 벡터 검색 서비스 (`lib/domains/guide/vector/search-service.ts`) — `searchGuidesByVector()` → embed query → `search_guides` RPC | ✅ |
| C-4 | 배치 스크립트 (`scripts/embed-guides.ts`) — `--dry-run`, `--limit=N`, 50건 배치 | ✅ |
| C-5 | on-save 임베딩 훅 — `createGuideAction`/`updateGuideAction` → `embedSingleGuide()` (try/catch, 실패해도 저장 유지) | ✅ |
| C-6 | Agent 2 도구 — 3도구 (searchGuides, getGuideDetail, getStudentAssignments) → 오케스트레이터 통합 | ✅ |

**핵심 파일:**
- `supabase/migrations/20260332800000_pgvector_guide_embedding.sql` — pgvector 확장 + HNSW + `search_guides` RPC (벡터 유사도 + 계열/과목/유형 필터)
- `lib/domains/guide/vector/embedding-service.ts` — `gemini-embedding-001` (768d), `embed`/`embedMany` from AI SDK
- `lib/domains/guide/vector/search-service.ts` — 쿼리 임베딩 → RPC 호출
- `scripts/embed-guides.ts` — 7,836건 배치 처리 CLI
- `lib/agents/tools/guide-tools.ts` — 오케스트레이터에 통합된 3개 가이드 도구

**설계 변경사항:**
- 임베딩 동기화: Trigger→pgmq→Edge Function 대신 **on-save 훅 + 배치 스크립트** 채택 (가이드 편집 빈도 낮음, 인프라 단순화)
- `search_guides` RPC: `SECURITY INVOKER` (설계의 `SECURITY DEFINER` 대신 — RLS 자동 적용)
- 검색 필터: `career_filter bigint` (FK ID), `subject_filter uuid`, `guide_type_filter text` — 설계의 text 배열 대신 정규화된 FK 조인

**운영 완료:**
- [x] `pnpm build` 성공
- [x] 마이그레이션 프로덕션 적용 (`apply_migration`)
- [x] 7,836건 전체 임베딩 완료 (768d, 971초, 실패 0건)
- [x] RPC 테이블명 수정 (`_career_mappings`, `_subject_mappings`)
- [x] `providerOptions: { google: { outputDimensionality: 768 } }` 추가 (기본 3072d 대응)

---

### Phase D: 입시 배치 에이전트 — ✅ 완료 (2026-03-20)

> **의존**: Phase B + Phase 8.1~8.6
> **실제 공수**: ~0.5일

**구현 결과:**

| 단계 | 작업 | 상태 |
|------|------|------|
| D-1 | `admission-tools.ts` — 6개 도구 (searchAdmissionData, getUniversityScoreInfo, runPlacementAnalysis, filterPlacementResults, simulateCardAllocation, analyzeScoreImpact) | ✅ |
| D-2 | MockScoreInput 기반 자연어 파라미터 추출 — LLM이 12개 flat 필드 채움 | ✅ |
| D-3 | simulateCardAllocation — 6장 최적 배분 + 면접 겹침 감지 통합 | ✅ |
| D-4 | 오케스트레이터 연동 — `createAdmissionTools(ctx)` + 시스템 프롬프트 업데이트 | ✅ |
| D-5 | 테스트 — orchestrator.test.ts 9개 통과 (19개 도구 등록 확인) | ✅ |

**핵심 설계:**
- **Closure 캐시**: `runPlacementAnalysis` → `cachedAnalysis`/`cachedScoreInput` → `filterPlacementResults`/`analyzeScoreImpact` 공유 (요청 범위)
- **토큰 절약**: `truncateVerdict()` — `calculationResult.breakdown`, `historicalComparisons` 생략, 상위 20건만
- **What-If**: `analyzeScoreImpact` — 캐시된 점수 수정 → 재분석 → 판정 변동 diff

**핵심 파일:**
- `lib/agents/tools/admission-tools.ts` — 6개 도구
- `lib/domains/admission/placement/service.ts` — `analyzePlacement()` (래핑 대상, 수정 없음)
- `lib/domains/admission/allocation/engine.ts` — `simulateAllocation()` (래핑 대상, 수정 없음)

---

### Phase E: 면접·리포트 확장 ✅ 완료 (2026-03-20)

> **의존**: Phase B + Phase D
> **완료일**: 2026-03-20

| 단계 | 작업 | 상세 | 상태 |
|------|------|------|------|
| E-1 | Agent 5: 면접 코칭 3도구 | generateInterviewQuestions(기록→질문10개), evaluateAnswer(답변평가+피드백), getInterviewPrep(준비현황) | ✅ |
| E-2 | Agent 6: 리포트 생성 3도구 | generateReport(요약서/가이드 생성), fetchSavedReports(목록), getStudentOverview(종합프로필) | ✅ |
| E-3 | PDF/Word 내보내기 | jspdf+html2canvas(PDF) + docx(Word) — 활동요약서/세특가이드 | ✅ |

**구현 파일:**
- `lib/agents/tools/interview-tools.ts` — Agent 5: 3도구 (~220줄)
- `lib/agents/tools/report-tools.ts` — Agent 6: 3도구 (~210줄)
- `lib/agents/orchestrator.ts` — 시스템 프롬프트 Agent 5·6 섹션 + 규칙 2개 추가
- 오케스트레이터 도구: 19 → 25개 (3+5+2+3+6+3+3)

---

### CMS C2.5: AI 이미지 생성 — ✅ 완료 (2026-03-20)

| 단계 | 작업 | 상태 |
|------|------|------|
| C2.5-1 | `lib/domains/guide/actions/ai-image.ts` — Imagen 3 (`imagen-3.0-generate-002`) Server Action | ✅ |
| C2.5-2 | `components/editor/AiImageDialog.tsx` — 프롬프트 입력 + 비율 선택 (1:1/16:9/9:16/4:3/3:4) | ✅ |
| C2.5-3 | `EditorToolbar.tsx` — DropdownMenu 분기 (파일 업로드 / AI 이미지 생성) | ✅ |
| C2.5-4 | prop 전달 체인: EditorToolbar → RichTextEditor → GuideContentEditor → GuideEditorClient | ✅ |

**핵심 파일:**
- `lib/domains/guide/actions/ai-image.ts` — `generateGuideImageAction()` (Rate Limiter + Quota 재사용)
- `components/editor/AiImageDialog.tsx` — Dialog UI
- `components/editor/EditorToolbar.tsx` — DropdownMenu 통합

---

### CMS C3: AI 가이드 생성 — ✅ 완료 (2026-03-20)

> **의존**: CMS C2 + Phase C (임베딩)

| 단계 | 작업 | 상태 |
|------|------|------|
| C3-1 | `llm/types.ts` — Zod 스키마 (GeneratedGuideOutput, GuideReviewOutput) + 스코어→상태 매핑 | ✅ |
| C3-2 | `llm/prompts/` — 키워드/클론/리뷰 3개 프롬프트 | ✅ |
| C3-3 | `repository.ts` + `types.ts` — GuideUpsertInput AI 필드 (qualityScore, qualityTier, aiModelVersion) | ✅ |
| C3-4 | `llm/actions/generateGuide.ts` — 키워드/클론 생성 (generateObjectWithRateLimit + SubjectMatcher) | ✅ |
| C3-5 | `llm/actions/reviewGuide.ts` — AI 품질 리뷰 (4차원 평가, 0~100) → 상태 전환 | ✅ |
| C3-6 | `/admin/guides/generate` — 2단계 위자드 UI + GuideListClient "AI 생성" 버튼 | ✅ |

**핵심 설계:**
- **소스 2종**: `ai_keyword` (키워드→가이드), `ai_clone_variant` (기존 가이드→변형)
- **모델**: Gemini Flash (`fast`) + `zodSchema()` 래핑 — 구조화 출력
- **매핑**: SubjectMatcher/CareerFieldMatcher (Import 파이프라인 재사용) — AI 출력 과목/계열명 → DB ID
- **리뷰 워크플로**: draft → ai_reviewing → pending_approval(60+점) / review_failed(60미만)
- **임베딩**: 생성 완료 후 `embedSingleGuide()` fire-and-forget

**핵심 파일:**
- `lib/domains/guide/llm/` — types, prompts(3), actions(2)
- `app/(admin)/admin/guides/generate/` — page + GuideGeneratorClient

---

### CMS C3.1: PDF/URL 추출 + Agent 도구 — ✅ 완료 (2026-03-20)

> **의존**: CMS C3 + Phase B

| 단계 | 작업 | 상태 |
|------|------|------|
| C3.1-1 | `llm/extract/pdf-extractor.ts` — PDF URL → 텍스트 추출 (pdf-parse v2, 50페이지 제한, 20K자 truncate) | ✅ |
| C3.1-2 | `llm/extract/url-extractor.ts` — URL → HTML 정제 → 텍스트 (보안: SSRF 방지, 15초 타임아웃) | ✅ |
| C3.1-3 | `llm/prompts/extraction-guide.ts` — 추출문 기반 가이드 생성 전용 프롬프트 | ✅ |
| C3.1-4 | `llm/types.ts` — PDFExtractionInput, URLExtractionInput + GuideGenerationSource 확장 | ✅ |
| C3.1-5 | `llm/actions/generateGuide.ts` — pdf_extract/url_extract 소스 분기 추가 (buildPrompt 리팩토링) | ✅ |
| C3.1-6 | `agents/tools/guide-tools.ts` — generateGuide 도구 추가 (keyword/pdf/url/clone 4소스) | ✅ |
| C3.1-7 | `agents/orchestrator.ts` — 시스템 프롬프트 Agent 2 섹션 + 규칙 #11 추가 | ✅ |
| C3.1-8 | 테스트 — orchestrator.test.ts 11개 통과 (26도구 검증) | ✅ |

**핵심 설계:**
- **추출→생성 파이프라인**: PDF/URL → 텍스트 추출 → `EXTRACTION_SYSTEM_PROMPT` + 추출문 → Gemini → `generatedGuideSchema` (기존과 동일)
- **보안**: URL SSRF 방지 (사설IP/localhost 차단), Content-Type 검증, 타임아웃
- **Agent 통합**: `generateGuide` 도구가 source 파라미터로 4가지 소스 분기 → 내부적으로 `generateGuideAction` 호출

---

### CMS C4: 가이드 버전 관리 — ✅ 완료 (2026-03-20)

> **의존**: CMS C3.1

| 단계 | 작업 | 상태 |
|------|------|------|
| C4-1 | DB 마이그레이션 — `version` int, `is_latest` bool, `original_guide_id` uuid + 인덱스 2개 | ✅ |
| C4-2 | `types.ts` — ExplorationGuide/GuideUpsertInput 버전 필드 + GuideVersionItem 타입 | ✅ |
| C4-3 | `repository.ts` — `findVersionHistory()`, `createNewVersion()`, `revertToVersion()` | ✅ |
| C4-4 | `actions/crud.ts` — `getVersionHistoryAction`, `saveAsNewVersionAction`, `revertToVersionAction` | ✅ |
| C4-5 | `GuideVersionHistory.tsx` — 버전 히스토리 패널 (접기/펼치기, 되돌리기 버튼) | ✅ |
| C4-6 | `GuideEditorClient.tsx` — "새 버전" 버튼 + 버전 배지 + 히스토리 패널 통합 | ✅ |
| C4-7 | `findGuides()` — `is_latest=true` 기본 필터 (목록에서 최신만 표시) | ✅ |

**핵심 설계:**
- **3컬럼**: `version` (순번), `is_latest` (최신 플래그), `original_guide_id` (버전 체인 그룹핑)
- `parent_guide_id`와 분리: AI 클론 추적은 parent_guide_id, 버전 체인은 original_guide_id
- **새 버전 생성 흐름**: 현재 저장 → 메타+본문+매핑 복제 → version+1, is_latest=true → 이전 is_latest=false
- **되돌리기**: 대상 버전 내용으로 새 버전 생성 (비파괴적)
- **목록 기본 필터**: `latestOnly !== false`면 `is_latest = true`

**다음**: Agent 운영 안정화, E-3 (PDF export)

---

## 9. 비용 추정

### 에이전트 추가 비용 (기존 대비)

| 항목 | 월 비용 |
|------|--------|
| 기존 LLM (84명 전체 분석) | ~$0.25 |
| 오케스트레이터 라우팅 호출 | +~$0.50 |
| 7,836건 최초 임베딩 (일회성) | ~$0.01 |
| 임베딩 검색 쿼리 | ~$0.01/월 |
| CMS C2.5 AI 이미지 (Imagen 3) | ~$0.05/건 (예: 50건/월 = $2.50) |
| CMS C3 AI 가이드 생성 (Flash) | ~$0.005/건 (예: 100건/월 = $0.50) |
| CMS C3 AI 리뷰 (Flash) | ~$0.003/건 (예: 100건/월 = $0.30) |
| pgvector 저장 | Supabase 기존 플랜 내 |
| **합계** | **~$4.50/월** |

> 예산 $30~50 대비 극도의 여유. LLM 캐시 적용 후 전체 시스템 (기존 + 에이전트) 합산 $30~50 범위.

### 인프라 비용

| 항목 | 비용 |
|------|------|
| Vercel Hobby | 무료 (Edge Function 60초 제한 주의) |
| Supabase Free/Pro | 기존 플랜 내 (pgvector 추가 비용 없음) |
| Gemini API | Free Tier 충분 (분 1,500 임베딩 요청) |

---

## 10. 경쟁사 대비 차별점

| 서비스 | 접근 방식 | TimeLevelUp 차별점 |
|--------|----------|-------------------|
| 진학사 학생부 AI | 데이터 기반 점수화 | 3영역×10역량×42루브릭 구조화 분석 + 인라인 하이라이트 |
| 바이브온 | 합격 확률 예측 | 컨설턴트 워크플로우 통합 (진단→전략→면접→리포트) |
| 세특PRO | 교사용 세특 작성 | 학생 분석 + 전략 수립 (생성이 아닌 분석) |

**고유 강점**: 6개 전문 에이전트가 상호 연동되는 **통합 컨설팅 파이프라인** — 단일 기능 도구가 아닌 컨설팅 프로세스 전체를 AI가 지원.

---

## 11. 위험 관리

| 위험 | 확률 | 영향 | 대응 |
|------|------|------|------|
| AI SDK 마이그레이션 중 기존 기능 깨짐 | 중 | 높음 | 점진 마이그레이션 (파일 단위) + 143개 테스트로 회귀 검증 |
| 오케스트레이터 오분류 | 중 | 중 | fallback 규칙 (키워드 기반) + 사용자 명시적 에이전트 선택 옵션 |
| Vercel 60초 타임아웃 (복합 질문) | 중 | 중 | 에이전트 병렬 실행 + 부분 결과 스트리밍 |
| pgvector 성능 (7,836+ 벡터) | 낮음 | 낮음 | HNSW 인덱스 기본값으로 10K~50K 충분 |
| 임베딩 모델 deprecated | 낮음 | 중 | MRL 지원으로 차원 변경 없이 모델 교체 가능 |

---

## 12. 의존관계 그래프

```
[에이전트 트랙]

Phase A (AI SDK 마이그레이션) ✅ 2026-03-20
    ↓
Phase B (오케스트레이터 + Agent 1·2·4 래핑) ✅ 2026-03-20
    │
    ├── Phase C (pgvector + CMS RAG) ✅ 2026-03-20
    │
    ├── Phase D (Agent 3: 입시 배치) ✅ 2026-03-20
    │
    └── Phase E (Agent 5·6: 면접·리포트 확장) ✅ 2026-03-20

[현재 상태]

Phase A: ✅ 완료
Phase B: ✅ 완료 — 13도구 오케스트레이터 + API + Chat UI + 사이드패널 + 독립페이지
Phase C: ✅ 완료 — pgvector 마이그레이션 + 임베딩 서비스 + 벡터 검색 + 배치 스크립트
Phase D: ✅ 완료 — 6도구 (배치분석, 필터, 6장 배분, What-If) + closure 캐시
Phase E: ✅ 완료 — 6도구 (면접질문, 답변평가, 준비현황, 리포트생성, 목록조회, 학생프로필)
Phase E-3: ✅ 완료 — 리포트 PDF/Word 내보내기 (jspdf+html2canvas+docx)

[CMS AI 트랙]

CMS C2.5:  ✅ 완료 — Imagen 3 AI 이미지 생성 + 에디터 DropdownMenu 통합
CMS C3:    ✅ 완료 — AI 가이드 생성 (키워드/클론) + AI 리뷰 + /admin/guides/generate 위자드
CMS C3.1:  ✅ 완료 — PDF/URL 추출 소스 + Agent generateGuide 도구 (26도구)
CMS C4:    ✅ 완료 — 가이드 버전 관리 (version/is_latest/original_guide_id)
```
