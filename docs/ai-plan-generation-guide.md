# AI 플랜 생성 기능 가이드

> 작성일: 2026-01-17
> 위치: `lib/domains/plan/llm/`

## 개요

AI를 활용하여 학생 맞춤형 학습 플랜을 자동 생성하는 기능입니다. 학생 정보, 성적, 콘텐츠, 시간 설정을 기반으로 최적화된 학습 계획을 생성합니다.

## 파일 구조

### Server Actions

| 파일 | 설명 |
|------|------|
| `actions/generatePlan.ts` | 메인 AI 플랜 생성 |
| `actions/streamPlan.ts` | 스트리밍 플랜 생성 |
| `actions/generateHybridPlanComplete.ts` | 하이브리드 플랜 (AI + 스케줄러) |
| `actions/regeneratePartial.ts` | 부분 재생성 (날짜/과목/콘텐츠) |
| `actions/recommendContent.ts` | 콘텐츠 추천 |
| `actions/enhancedRecommendContent.ts` | 향상된 콘텐츠 추천 |
| `actions/coldStart/` | 콜드 스타트 추천 파이프라인 (웹 검색 기반) |

### 공통 로더 (신규)

> ✅ **리팩토링 완료** (2026-01-18)

| 파일 | 설명 |
|------|------|
| `loaders/types.ts` | SupabaseClient 타입 정의 |
| `loaders/studentLoader.ts` | loadStudentProfile, loadScoreInfo |
| `loaders/patternLoader.ts` | loadLearningPattern |
| `loaders/contentLoader.ts` | loadOwnedContents, loadCandidateContents |
| `loaders/index.ts` | Barrel export |

기존 `recommendContent.ts`와 `enhancedRecommendContent.ts`에 중복되어 있던 5개 로더 함수를 공통 모듈로 추출하여 약 210줄 감소 및 중복 제거.

### Provider

| 파일 | 설명 |
|------|------|
| `providers/base.ts` | Provider 기본 인터페이스 |
| `providers/anthropic.ts` | Claude (기본 Provider) |
| `providers/gemini.ts` | Google Gemini (웹 검색 지원) |
| `providers/openai.ts` | OpenAI |
| `providers/config.ts` | Provider 설정 및 비용 정보 |

### 프롬프트

| 파일 | 설명 |
|------|------|
| `prompts/planGeneration.ts` | 플랜 생성 시스템/사용자 프롬프트 |
| `prompts/partialRegeneration.ts` | 부분 재생성 프롬프트 |
| `prompts/contentRecommendation.ts` | 콘텐츠 추천 프롬프트 |
| `prompts/frameworkGeneration.ts` | AI Framework 생성 프롬프트 |

### Transformer

| 파일 | 설명 |
|------|------|
| `transformers/requestBuilder.ts` | DB 데이터 → LLM 요청 변환 |
| `transformers/responseParser.ts` | LLM 응답 → DB 저장 형식 변환 |

### 서비스

| 파일 | 설명 |
|------|------|
| `services/aiUsageLogger.ts` | AI 사용량 로깅 |
| `services/providerSelectionService.ts` | Provider 선택 |
| `services/llmCacheService.ts` | LLM 캐시 |
| `services/tokenOptimizationService.ts` | 토큰 최적화 |
| `services/webSearchContentService.ts` | 웹 검색 콘텐츠 저장/조회 (다중 필터 지원) |

### 컴포넌트

| 파일 | 설명 |
|------|------|
| `app/(student)/plan/new-group/_components/_features/ai-mode/AIPlanGeneratorPanel.tsx` | AI 플랜 생성 UI |
| `app/(admin)/admin/students/_components/BatchAIPlanModalContent.tsx` | 배치 생성 모달 |

## 플로우

```
┌─────────────────────────────────────────────────┐
│        사용자 요청 (콘텐츠, 시간, 설정)           │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   1. generatePlanWithAI (Server Action)         │
│   - 인증 확인 (학생/관리자)                      │
│   - 대상 학생 ID 결정                            │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   2. 데이터 로드 (병렬)                          │
│   - 학생 정보 (학년, 목표대학, 목표학과)          │
│   - 성적 정보 (과목별 점수, 백분위)              │
│   - 콘텐츠 정보 (책/강의 목록)                   │
│   - 시간 슬롯, 학원 일정                         │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   3. LLM 요청 빌드 (buildLLMRequest)            │
│   - 학생 프로필 구성                             │
│   - 취약 과목 식별                               │
│   - 시간 슬롯 매핑                               │
│   - 제외 날짜/요일 통합                          │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   4. LLM 호출 (createMessage)                   │
│   - Provider 선택 (Anthropic/Gemini/OpenAI)     │
│   - 모델 티어 결정 (fast/standard/advanced)     │
│   - 시스템 프롬프트 + 사용자 프롬프트 전송       │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   5. 응답 파싱 (parseLLMResponse)               │
│   - JSON 추출                                    │
│   - contentId 유효성 검증                        │
│   - 품질 메트릭 검증                             │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   6. 플랜 저장 (savePlans)                      │
│   - student_plans 테이블에 저장                  │
│   - ai_generated: true 플래그                    │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│   7. 사용량 로깅 (logAIUsageAsync)              │
│   - 토큰 사용량 및 비용 기록                     │
└─────────────────────────────────────────────────┘
```

## AI 모델

### Provider 설정

| Provider | Fast | Standard | Advanced | 특징 |
|----------|------|----------|----------|------|
| **Anthropic** (기본) | claude-3-5-haiku | claude-sonnet-4 | claude-sonnet-4 | 안정적, 높은 품질 |
| **Gemini** | gemini-flash | gemini-flash | gemini-pro | 웹 검색(Grounding) 지원 |
| **OpenAI** | - | - | - | 구현됨 |

### 모델 티어

- **fast**: 빠른 미리보기, 비용 효율적 (4,096 토큰)
- **standard**: 일반 생성, 균형 (8,192 토큰)
- **advanced**: 복잡한 플랜, 높은 품질 (16,384 토큰)

### Provider 선택

```typescript
// 환경 변수로 제어
process.env.LLM_PROVIDER = "anthropic" // 기본값

// Provider Factory를 통해 선택
import { getProvider } from '@/lib/domains/plan/llm/providers';
const provider = getProvider("anthropic"); // 또는 "gemini", "openai"
```

## 주요 기능

### 1. 플랜 생성 모드

| 모드 | 설명 |
|------|------|
| **strategy** (기본) | 유연한 시간 배치, 최적화된 전략 |
| **schedule** | 정확한 시간 슬롯 할당, 엄격한 제약 |

### 2. 웹 검색 (Gemini Grounding)

```typescript
interface WebSearchConfig {
  mode: "dynamic" | "always";  // 필요시 vs 항상
  dynamicThreshold?: number;   // 0.3 (기본)
  saveResults?: boolean;       // DB 저장 여부
}
```

### 3. 부분 재생성

```typescript
type RegenerateScope =
  | { type: "date"; dates: string[] }           // 특정 날짜
  | { type: "dateRange"; start: string; end: string }  // 날짜 범위
  | { type: "subject"; subjects: string[] }     // 특정 과목
  | { type: "content"; contentIds: string[] };  // 특정 콘텐츠
```

### 4. 배치 생성

여러 학생의 플랜을 동시에 생성합니다. (최대 3명 병렬 처리)

```typescript
// API 엔드포인트
POST /api/admin/batch-plan/stream        // 배치 생성 (SSE)
POST /api/admin/batch-plan/preview/stream // 배치 미리보기 (SSE)
```

## 사용법

### 기본 사용

```typescript
import { generatePlanWithAI } from '@/lib/domains/plan/llm/actions/generatePlan';

const result = await generatePlanWithAI({
  contentIds: ['content-1', 'content-2'],
  startDate: '2026-01-20',
  endDate: '2026-02-20',
  dailyStudyMinutes: 180,
  modelTier: 'standard',
  planningMode: 'strategy',
});

if (result.success) {
  console.log('플랜 생성 완료:', result.data);
}
```

### 미리보기

```typescript
const preview = await generatePlanWithAI({
  // ... 옵션
  dryRun: true,  // 저장하지 않고 미리보기만
});
```

### 스트리밍 생성

```typescript
import { streamPlanGeneration } from '@/lib/domains/plan/llm/actions/streamPlan';

const stream = await streamPlanGeneration({
  // ... 옵션
});

// 이벤트 타입: start, progress, text, parsing, complete, error
```

### 관리자 대리 생성

```typescript
const result = await generatePlanWithAI({
  studentId: 'target-student-id',  // 대상 학생 지정
  // ... 옵션
});
```

## 타입 정의

### 입력 (LLM 요청)

```typescript
interface LLMPlanGenerationRequest {
  student: {
    id: string;
    name: string;
    grade: number;
    school_name?: string;
    target_university?: string;
    target_major?: string;
  };
  scores: Array<{
    subject: string;
    subjectCategory?: string;
    score?: number;
    percentile?: number;
    isWeak?: boolean;
  }>;
  contents: Array<{
    id: string;
    title: string;
    subject: string;
    contentType: "book" | "lecture";
    totalPages?: number;
    totalLectures?: number;
    difficulty?: "easy" | "medium" | "hard";
  }>;
  settings: {
    startDate: string;
    endDate: string;
    dailyStudyMinutes: number;
    excludeDays?: number[];      // 0=일, 6=토
    excludeDates?: string[];
    prioritizeWeakSubjects?: boolean;
    includeReview?: boolean;
    reviewRatio?: number;        // 0-1
  };
}
```

### 출력 (LLM 응답)

```typescript
interface LLMPlanGenerationResponse {
  success: boolean;
  meta: {
    modelId: string;
    confidence: number;
    tokensUsed: { input: number; output: number };
  };
  weeklyMatrices: Array<{
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    days: Array<{
      date: string;
      plans: Array<{
        date: string;
        startTime: string;
        endTime: string;
        contentId: string;
        contentTitle: string;
        subject: string;
        rangeStart?: number;
        rangeEnd?: number;
        rangeDisplay?: string;
        estimatedMinutes: number;
        isReview?: boolean;
        priority?: "high" | "medium" | "low";
      }>;
    }>;
  }>;
  recommendations: {
    studyTips: string[];
    warnings: string[];
    focusAreas?: string[];
  };
}
```

### DB 저장 (student_plans)

```typescript
interface StudentPlan {
  id: string;
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  plan_date: string;
  start_time: string;
  end_time: string;
  content_id: string;
  title: string;
  subject: string;
  range_start?: number;
  range_end?: number;
  range_display?: string;
  estimated_minutes: number;
  is_review: boolean;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  ai_generated: boolean;          // AI 생성 여부
}
```

## Rate Limit 처리

### Gemini Rate Limit

```typescript
// Free Tier: 15 RPM (4초 간격)
// Pay-as-you-go: 1000 RPM (60ms 간격)

// 자동 재시도 로직
- 429 에러 감지
- 지수 백오프 + 지터 (1~60초)
- 최대 3회 재시도
```

### 에러 감지 키워드

```typescript
const rateLimitIndicators = [
  "429", "quota", "rate limit", "resource_exhausted"
];
```

## 비용 정보

### Anthropic

| 모델 | Input (1M 토큰) | Output (1M 토큰) |
|------|-----------------|------------------|
| Haiku | $0.25 | $1.25 |
| Sonnet | $3.00 | $15.00 |

### Gemini

| 모델 | Input (1M 토큰) | Output (1M 토큰) |
|------|-----------------|------------------|
| Flash | $0.10 | $0.40 |
| Pro | $1.25 | $5.00 |

## 콜드 스타트 추천 시스템

> 위치: `lib/domains/plan/llm/actions/coldStart/`
> ✅ **구현 완료** (2026-01-18) - 105개 테스트 통과

학생 데이터가 없는 상태에서 교과/과목/난이도를 선택하면 웹 검색을 통해 적절한 학습 콘텐츠를 추천하는 시스템입니다.

### 파이프라인 구조

```
Task 1: validateColdStartInput (입력 검증)
    ↓
Task 2: buildSearchQuery (검색 쿼리 생성)
    ↓
Task 3: executeWebSearch (Gemini Grounding 웹 검색)
    ↓
Task 4: parseSearchResults (JSON 파싱 + 잘린 응답 복구)
    ↓
Task 5: rankAndFilterResults (점수화/정렬/필터링)
    ↓
최종: runColdStartPipeline (전체 통합)
```

### 파일 구조

| 파일 | 설명 |
|------|------|
| `types.ts` | 타입 정의 (입력/출력/중간 단계) |
| `validateInput.ts` | Task 1: 교과/과목/난이도 검증 |
| `buildQuery.ts` | Task 2: 검색 쿼리 문자열 생성 |
| `executeSearch.ts` | Task 3: Gemini API 호출 (Grounding) |
| `parseResults.ts` | Task 4: JSON 파싱 + 잘린 응답 복구 |
| `rankResults.ts` | Task 5: 점수 계산 및 정렬 |
| `pipeline.ts` | 전체 파이프라인 통합 |
| `index.ts` | 모듈 export |
| `persistence/` | DB 저장 모듈 (2026-01-18 추가) |

### Persistence 모듈 (DB 저장)

> 위치: `lib/domains/plan/llm/actions/coldStart/persistence/`
> ✅ **구현 완료** (2026-01-18)

추천 결과를 `master_books`/`master_lectures` 테이블에 저장하여 데이터를 축적합니다.

| 파일 | 설명 |
|------|------|
| `types.ts` | 저장 옵션/결과 타입 |
| `mappers.ts` | RecommendationItem → DB Insert 변환 |
| `duplicateCheck.ts` | 제목+교과 기반 중복 검사 |
| `saveRecommendations.ts` | 메인 저장 함수 |
| `index.ts` | 모듈 export |

```typescript
import {
  runColdStartPipeline,
  saveRecommendationsToMasterContent
} from "@/lib/domains/plan/llm/actions/coldStart";

// 1. 파이프라인 실행
const result = await runColdStartPipeline({
  subjectCategory: "수학",
  subject: "미적분",
  contentType: "book",
});

// 2. 결과 저장
if (result.success) {
  const saveResult = await saveRecommendationsToMasterContent(
    result.recommendations,
    {
      tenantId: null,  // 공유 카탈로그
      subjectCategory: "수학",
      subject: "미적분",
      difficultyLevel: "개념",
    }
  );
  console.log(`새로 저장: ${saveResult.savedItems.filter(i => i.isNew).length}개`);
  console.log(`중복 스킵: ${saveResult.skippedDuplicates}개`);
}
```

### 기존 콘텐츠 조회 (findExistingWebContent)

> ✅ **다중 필터 지원** (2026-01-18 개선)

저장된 콜드 스타트/웹 검색 결과를 다양한 조건으로 조회합니다.

```typescript
import { getWebSearchContentService } from "@/lib/domains/plan/llm/services";

const service = getWebSearchContentService();

// 수학 교과의 구조 정보 있는 교재만 조회
const books = await service.findExistingWebContent(tenantId, {
  subjectCategory: "수학",
  contentType: "book",
  hasStructure: true,       // total_pages NOT NULL
  source: "cold_start",     // cold_start 출처만
  limit: 20,
});

// 공유 카탈로그 + 테넌트 통합 조회
const all = await service.findExistingWebContent(tenantId, {
  includeSharedCatalog: true,
  contentType: "all",
});
```

**지원 필터:**

| 옵션 | 설명 |
|------|------|
| `subjectCategory` | 교과 필터 (수학, 영어 등) |
| `subject` | 과목 필터 (미적분 등) |
| `difficulty` | 난이도 필터 (개념, 기본, 심화) |
| `contentType` | `book`, `lecture`, `all` |
| `hasStructure` | 구조 정보(total_pages/episodes) 있는 것만 |
| `source` | `cold_start`, `web_search`, `all` |
| `includeSharedCatalog` | 공유 카탈로그(tenant_id=null) 포함 |
| `limit` | 최대 조회 개수 (기본: 20) |

### 사용법

```typescript
import { runColdStartPipeline } from "@/lib/domains/plan/llm/actions/coldStart";

const result = await runColdStartPipeline(
  {
    subjectCategory: "수학",
    subject: "미적분",
    difficulty: "개념",
    contentType: "book",
  },
  {
    useMock: false,  // 실제 API 호출
    preferences: { maxResults: 5 },
  }
);

if (result.success) {
  result.recommendations.forEach((rec) => {
    console.log(`${rec.rank}. ${rec.title} (점수: ${rec.matchScore})`);
    console.log(`   총 범위: ${rec.totalRange}, 챕터: ${rec.chapters.length}개`);
  });
}
```

### 점수 계산 (100점 만점)

| 기준 | 점수 | 조건 |
|------|------|------|
| 콘텐츠 타입 일치 | +30 | `preferences.contentType === item.contentType` |
| 목차 완성도 | +25 | `item.chapters.length >= 2` |
| totalRange 유효 | +20 | `item.totalRange > 0` |
| 제목 키워드 | +15 | 제목에 과목명/교과명 포함 |
| 메타 정보 | +10 | 저자 또는 출판사 존재 |

### 잘린 JSON 복구

AI 응답이 토큰 한도로 중간에 끊긴 경우 자동 복구:
- 누락된 닫는 괄호 (`]`, `}`) 추가
- 불완전한 마지막 객체 제거
- 완전한 항목만 유지

### 지원 교과/과목

```typescript
const SUPPORTED_SUBJECT_CATEGORIES = [
  "국어", "수학", "영어", "한국사", "사회", "과학"
];

const SUBJECTS_BY_CATEGORY = {
  수학: ["수학", "수학I", "수학II", "미적분", "확률과 통계", "기하"],
  과학: ["통합과학", "물리학I", "화학I", "생명과학I", "지구과학I", ...],
  // ...
};
```

### 테스트

```bash
# 전체 테스트 (105개)
pnpm test lib/domains/plan/llm/actions/coldStart/

# API 통합 테스트 (GOOGLE_API_KEY 필요)
pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/integration.test.ts
```

| 테스트 파일 | 테스트 수 |
|------------|----------|
| validateInput.test.ts | 17 |
| buildQuery.test.ts | 13 |
| executeSearch.test.ts | 6 |
| parseResults.test.ts | 25 |
| rankResults.test.ts | 19 |
| pipeline.test.ts | 20 |
| integration.test.ts | 5 |
| **합계** | **105** |

## 관련 문서

- `docs/auth-strategy-pattern.md` - 인증 패턴
- `docs/플랜-그룹-위저드-구현-가이드.md` - 플랜 그룹 위저드
- `docs/2026-01-06-gemini-rate-limit-error-detection-implementation.md` - Gemini Rate Limit 처리
