# LLM 기반 콘텐츠 추천 및 플랜 생성 시스템

> 작성일: 2026-01-18
> 위치: `lib/domains/plan/llm/`

## 📋 목차
1. [시스템 개요](#1-시스템-개요)
2. [핵심 컴포넌트](#2-핵심-컴포넌트)
3. [데이터 흐름](#3-데이터-흐름)
4. [주요 플로우 상세](#4-주요-플로우-상세)
5. [서비스 레이어](#5-서비스-레이어)
6. [지원 데이터 타입](#6-지원-데이터-타입)
7. [메트릭스 및 모니터링](#7-메트릭스-및-모니터링)

---

## 1. 시스템 개요

### 아키텍처 다이어그램
```
┌──────────────────────────────────────────────────────────────────┐
│                      UI/Admin 요청                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        [플랜 생성]    [콘텐츠 추천]    [콜드 스타트]
        generatePlan   recommend        runColdStart
        WithAI()       ContentWithAI()  Pipeline()
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
           Loaders                    Pipeline Stages
        (데이터 로딩)                  (5단계 처리)
                │                           │
                └─────────────┬─────────────┘
                              ▼
                         [LLM API]
                    Claude / Gemini / OpenAI
                              │
                              ▼
                       Services Layer
                    (캐시, 분석, 매칭)
                              │
                              ▼
                         Database
                    (플랜, 콘텐츠 저장)
```

### 디렉토리 구조
```
lib/domains/plan/llm/
├── actions/           # 서버 액션 (진입점)
│   ├── coldStart/     # 콜드 스타트 파이프라인
│   │   ├── stages/    # 5단계 처리
│   │   └── persistence/ # DB 저장
│   ├── generatePlan.ts
│   ├── streamPlan.ts
│   ├── recommendContent.ts
│   ├── enhancedRecommendContent.ts
│   └── ...
├── loaders/           # 데이터 로딩
├── services/          # 비즈니스 로직
├── providers/         # LLM 프로바이더
├── prompts/           # 프롬프트 템플릿
├── metrics/           # 메트릭스 시스템
└── transformers/      # 응답 변환
```

---

## 2. 핵심 컴포넌트

### 2.1 액션 (Actions)

| 액션 | 파일 | 용도 | 진입점 |
|------|------|------|--------|
| `generatePlanWithAI()` | `generatePlan.ts` | AI 플랜 생성 | Admin 플랜 위저드 |
| `streamPlanGeneration()` | `streamPlan.ts` | 실시간 스트리밍 플랜 생성 | UI 실시간 미리보기 |
| `recommendContentWithAI()` | `recommendContent.ts` | AI 콘텐츠 추천 | 콘텐츠 선택 |
| `enhancedRecommendContentWithAI()` | `enhancedRecommendContent.ts` | 고급 추천 (Phase 6) | 고급 추천 |
| `unifiedContentRecommendation()` | `unifiedContentRecommendation.ts` | 통합 추천 전략 선택 | 스마트 폴백 |
| `runColdStartPipeline()` | `coldStart/pipeline.ts` | 콜드 스타트 추천 | 신규 학생 |
| `regeneratePartialPlan()` | `regeneratePartial.ts` | 부분 재생성 | 플랜 수정 |
| `analyzePlanEfficiency()` | `optimizePlan.ts` | 플랜 분석 및 최적화 | 분석 리포트 |
| `generateHybridPlanCompleteAction()` | `generateHybridPlanComplete.ts` | 하이브리드 플랜 생성 | 고급 플랜 |

### 2.2 로더 (Loaders)

| 로더 | 파일 | 역할 |
|------|------|------|
| `loadStudentProfile()` | `studentLoader.ts` | 학생 기본 정보 (이름, 학년, 목표) |
| `loadScoreInfo()` | `studentLoader.ts` | 성적 및 과목별 리스크 분석 |
| `loadLearningPattern()` | `patternLoader.ts` | 학습 패턴 (선호 시간, 완료율) |
| `loadOwnedContents()` | `contentLoader.ts` | 보유 콘텐츠 (교재, 강의) |
| `loadCandidateContents()` | `contentLoader.ts` | 추천 후보 콘텐츠 |
| `loadLearningVelocity()` | (enhanced) | 학습 속도 (페이지/강의 per day) |
| `loadExams()` | (enhanced) | 예정 시험 정보 |
| `loadCompletionHistory()` | (enhanced) | 완료 이력 |

---

## 3. 데이터 흐름

### 3.1 전략 선택 로직 (Unified)

```
unifiedContentRecommendation()
           │
           ▼
    ┌──────────────┐
    │ 캐시 확인     │
    └──────┬───────┘
           │ hit
           ├────────────────────────► 캐시된 결과 반환
           │ miss
           ▼
    ┌──────────────┐
    │ 학생 데이터?  │
    └──────┬───────┘
           │
     ┌─────┴─────┐
     │ 있음      │ 없음
     ▼           ▼
recommendContent  runColdStart
WithAI()         Pipeline()
     │               │
     └───────┬───────┘
             ▼
        결과 반환 + 메트릭스 로깅
```

### 3.2 추천 전략

| 전략 | 조건 | 사용 서비스 |
|------|------|-------------|
| `cache` | 캐시 히트 | LLMCacheService |
| `recommend` | 학생 데이터 있음 | Claude API + Loaders |
| `coldStart` | 학생 데이터 없음 | Tavily 웹 검색 |
| `fallback` | 추천 실패 시 | coldStart로 대체 |

---

## 4. 주요 플로우 상세

### 4.1 콘텐츠 추천 플로우

```
recommendContentWithAI()
       │
       ├── 1. 캐시 확인 (1일 TTL)
       │       └── hit → 즉시 반환
       │
       ├── 2. 병렬 데이터 로딩
       │       ├── loadStudentProfile()
       │       ├── loadScoreInfo()
       │       ├── loadLearningPattern()
       │       ├── loadOwnedContents()
       │       └── loadCandidateContents()
       │
       ├── 3. 보유 콘텐츠 필터링
       │
       ├── 4. 프롬프트 구성
       │       └── buildContentRecommendationPrompt()
       │
       ├── 5. LLM API 호출
       │       └── Claude + Gemini Grounding (선택적)
       │
       ├── 6. 응답 파싱 및 검증
       │       └── contentId 유효성 확인
       │
       ├── 7. 캐시 저장
       │
       └── 8. 결과 반환 + 메트릭스 로깅
```

**핵심 파일**: `lib/domains/plan/llm/actions/recommendContent.ts`

### 4.2 콜드 스타트 파이프라인

```
runColdStartPipeline()
       │
       ├── STAGE 1: validateColdStartInput()
       │       └── subjectCategory, subject, difficulty 검증
       │
       ├── STAGE 2: buildSearchQuery()
       │       └── "고등학교 수학 미적분 개념 교재 추천 목차"
       │
       ├── STAGE 3: executeWebSearch()
       │       └── Tavily API → Raw HTML/Text
       │
       ├── STAGE 4: parseSearchResults()
       │       └── 제목, 저자, 챕터 구조 추출
       │
       ├── STAGE 5: rankAndFilterResults()
       │       └── 매칭 점수 계산, 상위 N개 선택
       │
       └── [선택] STAGE 6: saveRecommendationsToMasterContent()
               ├── 중복 체크
               └── master_books/master_lectures에 저장
```

**핵심 파일**: `lib/domains/plan/llm/actions/coldStart/pipeline.ts`

### 4.3 플랜 생성 플로우

```
generatePlanWithAI()
       │
       ├── 1. 인증 및 권한 확인
       │
       ├── 2. 병렬 데이터 로딩
       │       ├── loadStudentData()
       │       ├── loadContentData()
       │       └── getAcademySchedules()
       │
       ├── 3. LLM 요청 구성
       │       └── buildUserPrompt()
       │
       ├── 4. LLM API 호출
       │       └── createMessage() → Claude/Gemini
       │
       ├── 5. 응답 파싱
       │       └── parseLLMResponse() → JSON
       │
       ├── 6. 콘텐츠 ID 검증
       │       └── toDBPlanDataList()
       │
       ├── 7. DB 저장
       │       ├── plan_groups 생성
       │       └── student_plan 레코드 삽입
       │
       └── 8. 캐시 무효화 및 메트릭스 로깅
```

**핵심 파일**: `lib/domains/plan/llm/actions/generatePlan.ts`

### 4.4 스트리밍 플랜 생성

```
streamPlanGeneration() [AsyncGenerator]
       │
       ├── yield { type: "start", progress: 0 }
       │
       ├── 데이터 로딩
       │       └── yield { type: "progress", progress: 10 }
       │
       ├── 프롬프트 구성
       │       └── yield { type: "progress", progress: 20 }
       │
       ├── LLM 스트리밍 호출
       │       └── yield { type: "progress", progress: 30-80 }
       │
       ├── 응답 파싱
       │       └── yield { type: "parsing" }
       │
       └── 완료
               └── yield { type: "complete", response, cost }
```

**핵심 파일**: `lib/domains/plan/llm/actions/streamPlan.ts`

---

## 5. 서비스 레이어

### 5.1 비용 최적화 (Phase 2)

| 서비스 | 파일 | 역할 |
|--------|------|------|
| `LLMCacheService` | `llmCacheService.ts` | 다중 레벨 캐싱 (TTL 설정 가능) |
| `ProviderSelectionService` | `providerSelectionService.ts` | 요청 복잡도 분석 → 최적 프로바이더 선택 |
| `TokenOptimizationService` | `tokenOptimizationService.ts` | 토큰 사용량 최적화 (스마트 요약) |

### 5.2 콘텐츠 분석 (Phase 3)

| 서비스 | 파일 | 역할 |
|--------|------|------|
| `ContentDifficultyService` | `contentDifficultyService.ts` | 콘텐츠 난이도 분석 (easy/medium/hard) |
| `PrerequisiteService` | `prerequisiteService.ts` | 선수 학습 맵핑, 최적 순서 제안 |
| `PersonalizedMatchingService` | `personalizedMatchingService.ts` | 학생-콘텐츠 매칭 점수 계산 |

### 5.3 웹 통합

| 서비스 | 파일 | 역할 |
|--------|------|------|
| `WebSearchContentService` | `webSearchContentService.ts` | Gemini Grounding 결과 → DB 저장 |
| `ContentStructureUtils` | `contentStructureUtils.ts` | 챕터/에피소드 구조 추출 |
| `AIUsageLogger` | `aiUsageLogger.ts` | AI API 사용량 로깅 |

---

## 6. 지원 데이터 타입

### 6.1 과목 카테고리 (6개)

| 카테고리 | 영문 |
|----------|------|
| 국어 | korean |
| 수학 | math |
| 영어 | english |
| 한국사 | korean_history |
| 사회 | social |
| 과학 | science |

### 6.2 난이도 (3단계)

| 레벨 | 한글 | 설명 |
|------|------|------|
| concept | 개념 | 기초 개념 학습 |
| basic | 기본 | 표준 문제 풀이 |
| advanced | 심화 | 고난이도 심화 |

### 6.3 콘텐츠 타입

| 타입 | 설명 | DB 테이블 |
|------|------|-----------|
| `book` | 교재/문제집 | `master_books`, `student_contents` |
| `lecture` | 온라인 강의 | `master_lectures`, `student_contents` |

---

## 7. 메트릭스 및 모니터링

### 7.1 메트릭스 시스템 구조

```
lib/domains/plan/llm/metrics/
├── types.ts       # 타입 정의
├── logger.ts      # 로깅 함수
├── store.ts       # 메모리 저장소
├── aggregator.ts  # 집계 함수
└── index.ts       # 공개 API
```

### 7.2 수집 항목

```typescript
interface LLMMetricsData {
  source: MetricsSource;           // 액션 출처
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    estimatedUSD: number;
    modelTier: string;
    provider?: string;
  };
  recommendation: {
    count: number;
    strategy: "recommend" | "coldStart" | "cache" | "fallback";
    usedFallback: boolean;
  };
  webSearch?: {
    enabled: boolean;
    queriesCount: number;
    resultsCount: number;
  };
  timing: {
    durationMs: number;
    timestamp: string;
  };
  error?: {
    message: string;
    code?: string;
    stage?: string;
  };
}
```

### 7.3 MetricsSource 타입

```typescript
type MetricsSource =
  // 콘텐츠 추천
  | "recommendContent"
  | "unifiedContentRecommendation"
  | "coldStartPipeline"
  | "enhancedRecommendContent"
  // 플랜 생성
  | "generatePlan"
  | "streamPlan"
  | "generateHybridPlan"
  | "generateHybridPlanComplete"
  | "regeneratePartial"
  | "optimizePlan"
  | "searchContent";
```

### 7.4 사용 예시

```typescript
import { MetricsBuilder, logRecommendationError } from "../metrics";

// 성공 시
const metricsBuilder = MetricsBuilder.create("generatePlan")
  .setRequestParams({ contentType: "book", maxRecommendations: 5 })
  .setContext({ studentId, tenantId })
  .setTokenUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 })
  .setCost({ estimatedUSD: 0.05, modelTier: "standard" })
  .setRecommendation({ count: 10, strategy: "recommend", usedFallback: false })
  .log();

// 에러 시
logRecommendationError("generatePlan", error, {
  strategy: "recommend",
  stage: "llm_call",
});
```

---

## 8. 핵심 기능 요약

| 기능 | 설명 | 관련 파일 |
|------|------|-----------|
| **통합 추천 전략** | 캐시 → 추천 → 콜드스타트 자동 폴백 | `unifiedContentRecommendation.ts` |
| **비용 최적화** | 복잡도 기반 프로바이더 선택, 토큰 최적화 | `services/providerSelectionService.ts` |
| **개인화 매칭** | 난이도, 과목 적합성, 학습 속도 종합 점수 | `services/personalizedMatchingService.ts` |
| **웹 검색 통합** | Gemini Grounding, Tavily 검색 | `services/webSearchContentService.ts` |
| **자동 DB 저장** | 검색 결과 → master_books/lectures 자동 등록 | `coldStart/persistence/` |
| **실시간 메트릭스** | 토큰, 비용, 전략, 에러 추적 | `metrics/` |
| **스트리밍 생성** | SSE 기반 실시간 플랜 생성 | `streamPlan.ts` |
| **부분 재생성** | 특정 날짜/과목/콘텐츠만 재생성 | `regeneratePartial.ts` |

---

## 9. 관련 문서

- [AI 콘텐츠 추천 분석](./ai-content-recommendation-analysis.md)
- [AI 플랜 생성 가이드](./ai-plan-generation-guide.md)
- [Cold Start DB 저장 구현](./2026-01-18-cold-start-db-persistence-implementation.md)
- [LLM 추천 시스템 아키텍처](./llm-recommendation-system-architecture.md)

---

## 10. 가상 시나리오 테스트 결과

### 10.1 테스트 환경

```
Framework: Vitest v4.0.15
Mode: Mock 데이터 사용 (API 호출 없음)
테스트 날짜: 2026-01-18
```

### 10.2 시나리오 1: 콜드 스타트 - 수학 미적분 개념서 추천

**입력:**
```typescript
{
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book"
}
```

**검색 쿼리 생성:**
```
"고등학교 수학 미적분 개념 교재 추천 목차"
```

**Mock 결과:**
```json
{
  "success": true,
  "recommendations": [
    {
      "rank": 1,
      "title": "미적분 개념서 - 기본서",
      "author": "홍길동",
      "publisher": "교육출판사",
      "contentType": "book",
      "totalRange": 320,
      "chapters": [
        { "title": "1장. 기초 개념", "startRange": 1, "endRange": 60 },
        { "title": "2장. 핵심 이론", "startRange": 61, "endRange": 150 },
        { "title": "3장. 응용 문제", "startRange": 151, "endRange": 250 },
        { "title": "4장. 실전 연습", "startRange": 251, "endRange": 320 }
      ],
      "matchScore": 85,
      "reason": "기초부터 심화까지 체계적으로 학습할 수 있는 교재"
    },
    {
      "rank": 2,
      "title": "미적분 개념서 - 완성",
      "author": "김영희",
      "publisher": "학습미디어",
      "contentType": "lecture",
      "totalRange": 45,
      "chapters": [
        { "title": "개념 정리", "startRange": 1, "endRange": 15 },
        { "title": "유형별 풀이", "startRange": 16, "endRange": 30 },
        { "title": "실전 모의고사", "startRange": 31, "endRange": 45 }
      ],
      "matchScore": 78,
      "reason": "단기간에 핵심을 정리할 수 있는 인강"
    }
  ],
  "stats": {
    "searchQuery": "고등학교 수학 미적분 개념 교재 추천 목차",
    "totalFound": 2,
    "filtered": 2,
    "durationMs": 2
  }
}
```

**메트릭스 로그:**
```json
{
  "type": "llm_metrics",
  "source": "coldStartPipeline",
  "durationMs": 2,
  "recommendation": {
    "count": 2,
    "strategy": "coldStart",
    "usedFallback": false
  },
  "requestParams": {
    "subjectCategory": "수학",
    "subject": "미적분",
    "contentType": "book"
  },
  "webSearch": {
    "enabled": false,
    "queriesCount": 1,
    "resultsCount": 2
  }
}
```

### 10.3 시나리오 2: 통합 추천 - 캐시 우선 전략

**입력:**
```typescript
{
  tenantId: "tenant-123",
  userId: "user-123",
  subjectCategory: "수학",
  contentType: "all",
  maxRecommendations: 5,
  useCache: true
}
```

**전략 선택 흐름:**
```
1. 캐시 확인 → 5개 결과 발견
2. 캐시 히트 → 즉시 반환
3. 콜드 스타트 스킵
```

**결과:**
```json
{
  "success": true,
  "recommendations": [...5개 캐시된 결과...],
  "stats": {
    "strategy": "cache",
    "cacheHit": true,
    "fromCache": 5,
    "fromColdStart": 0
  }
}
```

**메트릭스 로그:**
```json
{
  "type": "llm_metrics",
  "source": "unifiedContentRecommendation",
  "durationMs": 0,
  "recommendation": {
    "count": 5,
    "strategy": "cache",
    "usedFallback": false
  },
  "tenantId": "tenant-123",
  "cache": { "hit": true }
}
```

### 10.4 시나리오 3: 입력 검증 실패

**입력:**
```typescript
{
  subjectCategory: "존재하지않는교과"
}
```

**결과:**
```json
{
  "success": false,
  "error": "지원하지 않는 교과입니다: 존재하지않는교과. 지원 교과: 국어, 수학, 영어, 한국사, 사회, 과학",
  "failedAt": "validation"
}
```

**메트릭스 로그:**
```json
{
  "type": "llm_metrics",
  "source": "coldStartPipeline",
  "durationMs": 0,
  "recommendation": {
    "count": 0,
    "strategy": "coldStart",
    "usedFallback": false
  },
  "error": {
    "occurred": true,
    "type": "UnknownError",
    "message": "지원하지 않는 교과입니다: 존재하지않는교과...",
    "stage": "validation"
  }
}
```

### 10.5 시나리오 4: 콜드 스타트 → DB 저장

**입력:**
```typescript
{
  subjectCategory: "영어",
  difficulty: "기본",
  contentType: "lecture"
}
// + 옵션: { saveToDb: true, tenantId: "tenant-123" }
```

**파이프라인 실행:**
```
Stage 1: validateColdStartInput() → ✅ 통과
Stage 2: buildSearchQuery() → "고등학교 영어 기본 인강 추천 목차"
Stage 3: executeWebSearch() → Mock 결과 반환
Stage 4: parseSearchResults() → 2개 항목 파싱
Stage 5: rankAndFilterResults() → 점수순 정렬
Stage 6: saveRecommendationsToMasterContent() → DB 저장
```

**DB 저장 결과:**
```json
{
  "savedItems": [
    {
      "id": "generated-uuid-1",
      "title": "영어 기본 인강 - 기본서",
      "contentType": "lecture",
      "isNew": true
    }
  ],
  "duplicates": [
    {
      "title": "영어 기본 인강 - 완성",
      "existingId": "existing-uuid-2"
    }
  ],
  "errors": []
}
```

### 10.6 테스트 요약

| 테스트 파일 | 테스트 수 | 통과 | 실패 | 건너뜀 |
|-------------|----------|------|------|--------|
| `pipeline.test.ts` | 20 | 20 | 0 | 0 |
| `validateInput.test.ts` | 15 | 15 | 0 | 0 |
| `buildQuery.test.ts` | 12 | 12 | 0 | 0 |
| `rankResults.test.ts` | 19 | 19 | 0 | 0 |
| `parseResults.test.ts` | 14 | 14 | 0 | 0 |
| `unifiedContentRecommendation.integration.test.ts` | 15 | 14 | 0 | 1 |
| `persistence/mappers.test.ts` | 23 | 23 | 0 | 0 |
| `persistence/duplicateCheck.test.ts` | 8 | 8 | 0 | 0 |
| `persistence/saveRecommendations.test.ts` | 13 | 13 | 0 | 0 |
| `integration.test.ts` | 5 | 5 | 0 | 0 |
| **합계** | **144** | **143** | **0** | **1** |

### 10.7 실제 API 테스트 결과

> **테스트 일시**: 2026-01-18 15:34 (KST)
> **API**: Google Gemini with Grounding (웹 검색)

#### 시나리오 1: 수학 미적분 개념서 추천

**입력:**
```typescript
{
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book"
}
```

**실제 결과:**
```
✅ 성공!
   검색 쿼리: 고등학교 수학 미적분 개념 교재 추천 목차
   발견: 3개 → 필터 후: 3개
   소요 시간: 16,294ms

📖 추천 목록:
   1. 개념원리 고등 미적분 (2026년용)
      타입: book, 총 범위: 368페이지
      점수: 100, 챕터: 3개

   2. 기본 수학의 정석 미적분 (2024년용)
      타입: book, 총 범위: 520페이지
      점수: 100, 챕터: 3개

   3. MAPL 마플 시너지 미적분 (2026년용)
      타입: book, 총 범위: 470페이지
      점수: 100, 챕터: 3개
```

**메트릭스:**
```json
{
  "source": "coldStartPipeline",
  "durationMs": 16294,
  "recommendation": { "count": 3, "strategy": "coldStart" },
  "webSearch": { "enabled": true, "queriesCount": 1, "resultsCount": 3 }
}
```

#### 시나리오 2: 영어 기본 인강 추천

**입력:**
```typescript
{
  subjectCategory: "영어",
  difficulty: "기본",
  contentType: "lecture"
}
```

**실제 결과:**
```
✅ 성공!
   검색 쿼리: 고등학교 영어 기본 인강 추천 강의 목록
   발견: 3개 → 필터 후: 3개
   소요 시간: 26,095ms

🎬 추천 목록:
   1. 믿어봐! 문장 읽는 법을 알려줄게 (문장편)
      강의 수: 20강, 점수: 85

   2. 정승익의 수능 잡는 대박노트 (수능개념)
      강의 수: 30강, 점수: 85

   3. Rose Lee의 Grammar Holic (영문법 특강)
      강의 수: 30강, 점수: 85
```

**메트릭스:**
```json
{
  "source": "coldStartPipeline",
  "durationMs": 26095,
  "recommendation": { "count": 3, "strategy": "coldStart" },
  "webSearch": { "enabled": true, "queriesCount": 1, "resultsCount": 3 }
}
```

#### 테스트 스크립트

실제 API 테스트를 직접 실행하려면:

```bash
# 콜드 스타트만 테스트
npx tsx scripts/test-cold-start-api.ts

# 전체 플로우 테스트 (콜드스타트 → DB 확인 → 플랜 스케줄링)
npx tsx scripts/test-full-plan-flow.ts
```

### 10.8 전체 플로우 테스트 (콜드스타트 → 플랜 스케줄링)

> **테스트 일시**: 2026-01-18 15:39 (KST)

#### 전체 플로우 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    전체 플랜 생성 플로우                          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│ Step 1: 콜드 스타트 추천                                        │
│   Input: { subjectCategory: "수학", subject: "미적분" }         │
│   Output: 3개 콘텐츠 추천                                       │
│     - 개념원리 고등 미적분 (480페이지)                           │
│     - 기본 수학의 정석 미적분 (292페이지)                        │
│     - ONE SHOT 개념원리 (62강)                                  │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│ Step 2: DB 저장 (선택적)                                        │
│   - master_books 또는 master_lectures에 저장                    │
│   - 중복 체크 후 신규 항목만 저장                                │
│   - 저장된 콘텐츠 ID 반환                                        │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│ Step 3: 학생 콘텐츠 연결                                        │
│   - master_books → student_contents 복사                        │
│   - 학생별 콘텐츠 관리                                          │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│ Step 4: 플랜 스케줄링                                           │
│   generatePlanWithAI({                                          │
│     contentIds: ["uuid-1", "uuid-2", "uuid-3"],                 │
│     startDate: "2026-01-18",                                    │
│     endDate: "2026-02-17",                                      │
│     dailyStudyMinutes: 180,                                     │
│     planningMode: "schedule"                                    │
│   })                                                            │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│ Step 5: 플랜 저장                                               │
│   - plan_groups 생성                                            │
│   - student_plan 레코드 삽입 (일별 학습 플랜)                    │
└─────────────────────────────────────────────────────────────────┘
```

#### 실제 테스트 결과

```
✅ Step 1: 콜드 스타트 추천 - 3개 콘텐츠 (21초)
   - 개념원리 고등 미적분 (2026년 고3용): 480페이지
   - 기본 수학의 정석 미적분 (2026년용): 292페이지
   - [미적분] ONE SHOT 개념원리: 62강

✅ Step 2: DB 확인
   - 기존 수학 교재 3개 발견
   - 신규 저장 가능

⏸️ Step 3-5: 학생 데이터 필요
   - 플랜 스케줄링은 학생 정보가 필요
   - UI에서 진행 필요
```

#### 플랜 스케줄링 API 호출 예시

```typescript
import { generatePlanWithAI } from "@/lib/domains/plan/llm/actions/generatePlan";

// 저장된 콘텐츠 ID로 플랜 생성
const result = await generatePlanWithAI({
  contentIds: [
    "8ca1d150-cd6c-4234-bc5d-5b7e4f1a6beb",
    "57d82f6b-c9e9-4fbb-b92d-7e198fcf92b9",
  ],
  startDate: "2026-01-18",
  endDate: "2026-02-17",
  dailyStudyMinutes: 180,
  excludeDays: [0], // 일요일 제외
  planningMode: "schedule",
});

if (result.success) {
  console.log("플랜 생성 완료!", result.planGroupId);
  // 생성된 플랜: 30일 × 180분 = 90시간 학습 계획
}
```

---

> **Note**: 이 문서는 `lib/domains/plan/llm/` 디렉토리의 현재 구현을 기반으로 작성되었습니다.
