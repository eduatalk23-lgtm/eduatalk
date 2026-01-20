# TimeLevelUp 시스템 연계성 아키텍처

> 작성일: 2026-01-20
> 버전: 1.0
> 상태: 현재 구현 완료

## 목차

1. [개요](#1-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [콜드스타트 시스템](#3-콜드스타트-시스템)
4. [AI 플랜 생성 파이프라인](#4-ai-플랜-생성-파이프라인)
5. [플래너/플랜관리 시스템](#5-플래너플랜관리-시스템)
6. [시스템 간 연계](#6-시스템-간-연계)
7. [현재 상태 및 한계](#7-현재-상태-및-한계)
8. [향후 개선 로드맵](#8-향후-개선-로드맵)
9. [참조](#9-참조)

---

## 1. 개요

### 1.1 문서 목적

이 문서는 TimeLevelUp의 핵심 시스템들(콜드스타트, AI 플랜 생성, 플래너/플랜관리)의 작동 원리와 상호 연계성을 설명합니다. 개발자가 시스템을 이해하고 향후 개선 작업을 계획하는 데 참고 자료로 활용됩니다.

### 1.2 시스템 구성 요소

| 시스템 | 역할 | 핵심 파일 |
|--------|------|----------|
| **콜드스타트** | 신규 사용자 콘텐츠 추천 | `lib/domains/plan/llm/actions/coldStart/` |
| **AI 플랜 생성** | LLM 기반 학습 플랜 생성 | `lib/domains/admin-plan/actions/`, `lib/domains/plan/llm/actions/` |
| **플래너/플랜관리** | 플랜 그룹화 및 스케줄러 조율 | `lib/domains/plan/`, `lib/plan/` |

### 1.3 용어 정의

| 용어 | 설명 |
|------|------|
| **Planner** | 여러 Plan Group을 관리하는 "허브". 스케줄러 조율 담당 |
| **Plan Group** | 단일 콘텐츠의 학습 계획 단위 (is_single_content: true) |
| **student_plan** | 일자별 실제 학습 플랜 레코드 |
| **콜드스타트** | 학습 이력 없는 신규 사용자를 위한 콘텐츠 추천 |
| **AI Framework** | LLM이 생성한 전략적 학습 프레임워크 |
| **SchedulerOptions** | 코드 기반 스케줄러에 전달되는 옵션 |

---

## 2. 시스템 아키텍처

### 2.1 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TimeLevelUp AI 학습 플랜 시스템                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │   콜드스타트     │────▶│   AI 플랜 생성   │────▶│  플래너/플랜관리  │           │
│  │   시스템        │     │   파이프라인     │     │    시스템        │           │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘           │
│         │                       │                       │                       │
│         │  Gemini API           │  LLM 호출             │  DB 저장              │
│         │  웹 검색              │  Framework 생성       │  스케줄러 연동         │
│         ▼                       ▼                       ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        공통 인프라 레이어                                 │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │   │
│  │  │ Gemini AI │  │ Supabase  │  │ Scheduler │  │  Metrics  │            │   │
│  │  │   API     │  │    DB     │  │  Engine   │  │  Logger   │            │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 모델 관계

```
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너)                                                │
│ - id, tenant_id, student_id                                     │
│ - scheduler_options (스케줄러 조율 정보)                         │
│ - is_default, status                                            │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N (planner_id)
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Plan Group A    │  │ Plan Group B    │  │ Plan Group C    │
│                 │  │                 │  │                 │
│ is_single_      │  │ is_single_      │  │ is_single_      │
│ content: true   │  │ content: true   │  │ content: true   │
│                 │  │                 │  │                 │
│ content_type    │  │ content_type    │  │ content_type    │
│ content_id      │  │ content_id      │  │ content_id      │
│ start_range     │  │ start_range     │  │ start_range     │
│ end_range       │  │ end_range       │  │ end_range       │
│                 │  │                 │  │                 │
│ creation_mode:  │  │ creation_mode:  │  │ creation_mode:  │
│ "ai_batch"      │  │ "ai_hybrid"     │  │ "manual"        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    student_plan        student_plan        student_plan
    (일자별 플랜)       (일자별 플랜)       (일자별 플랜)
```

---

## 3. 콜드스타트 시스템

### 3.1 목적

학습 이력이 없는 **신규 사용자**에게 교과/과목/난이도 기반으로 콘텐츠를 **즉시 추천**합니다.

### 3.2 디렉토리 구조

```
lib/domains/plan/llm/actions/coldStart/
├── pipeline.ts           # 메인 파이프라인 오케스트레이션
├── types.ts              # 모든 Task의 입/출력 타입
├── index.ts              # 공개 API
│
├── 파이프라인 5단계
│   ├── validateInput.ts      # Task 1: 입력값 검증
│   ├── buildQuery.ts         # Task 2: 검색 쿼리 생성
│   ├── executeSearch.ts      # Task 3: Gemini API 웹 검색
│   ├── parseResults.ts       # Task 4: AI 응답 파싱
│   └── rankResults.ts        # Task 5: 결과 정렬/필터링
│
├── persistence/          # DB 저장 모듈
│   ├── saveRecommendations.ts
│   ├── mappers.ts
│   └── duplicateCheck.ts
│
└── batch/                # 배치 처리 모듈
    ├── runner.ts
    ├── targets.ts        # 크롤링 대상 정의
    └── streaming.ts
```

### 3.3 파이프라인 흐름

```
입력 (교과/과목/난이도/콘텐츠타입)
         ↓
[Task 1] validateColdStartInput()
         │
         ├─ 실패 → { success: false, failedAt: "validation" }
         │
         ↓ 성공
[Task 2] buildSearchQuery()
         │
         ↓ (항상 성공)
[Task 3] executeWebSearch()
         │
         ├─ Rate Limit 감지 → enableFallback?
         │                     ├─ YES → DB 캐시 조회
         │                     │        ├─ 성공 → usedFallback: true
         │                     │        └─ 실패 → 에러
         │                     └─ NO → 에러
         │
         ↓ 성공
[Task 4] parseSearchResults()
         │
         ├─ 실패 → { success: false, failedAt: "parse" }
         │
         ↓ 성공
[Task 5] rankAndFilterResults()
         │
         ↓ (항상 성공)
[Task 6] saveRecommendationsToMasterContent() (선택)
         │
         ├─ saveToDb=true일 때만 실행
         ├─ 중복 검사 수행
         └─ DB 저장 후 캐시 무효화
         ↓
출력: ColdStartPipelineResult
```

### 3.4 점수 계산 기준 (100점 만점)

| 기준 | 점수 |
|------|------|
| 콘텐츠 타입 일치 | +30점 |
| 목차 완성도 (2개 이상) | +25점 |
| totalRange 유효 | +20점 |
| 제목 키워드 매칭 | +15점 |
| 메타 정보 (저자/출판사) | +10점 |

### 3.5 Rate Limit 보호

```
Gemini Free Tier 제한:
├─ 일일: 20회
└─ 분당: 15회

보호 전략:
1. executeWebSearch() 에러 감지 → 429/quota/rate limit 분류
2. enableFallback=true 시:
   ├─ DB에서 유사 조건의 기존 콘텐츠 조회
   └─ 캐시된 콘텐츠 반환 (matchScore 자동 조정)
3. 배치 처리: delayBetweenRequests로 요청 간격 조절
```

### 3.6 배치 처리

```typescript
// 실행 예시
await runColdStartBatch("core", {
  tenantId: null,              // 공유 카탈로그
  saveToDb: true,
  delayBetweenRequests: 5000,  // 5초 간격
  limit: 5
});

// 대상 프리셋
CORE_TARGETS[]     // 핵심 교과 (23개)
MATH_TARGETS[]     // 수학 전체 (36개)
ALL_TARGETS[]      // 모든 조합
```

**자동 실행**: GitHub Actions (`.github/workflows/cold-start-batch.yml`)
- 스케줄: 매일 새벽 3시 (KST)
- 프리셋: "core"

### 3.7 사용 예시

```typescript
// 기본 사용
const result = await runColdStartPipeline({
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book"
});

// DB 저장 + Rate Limit Fallback
const result = await runColdStartPipeline(
  { subjectCategory: "영어" },
  { saveToDb: true, enableFallback: true }
);
```

---

## 4. AI 플랜 생성 파이프라인

### 4.1 세 가지 파이프라인 비교

| 항목 | 배치 모드 | 하이브리드 완전 | Framework 생성 |
|------|---------|--------------|--------------|
| **파일** | batchAIPlanGeneration.ts | generateHybridPlanComplete.ts | generateHybridPlan.ts |
| **용도** | 다중 학생 일괄 생성 | AI 전략 + 코드 스케줄러 | AI 전략만 생성 |
| **입력 대상** | 학생 ID 배열 | Plan Group ID | 학생 정보 |
| **Plan Group** | 내부 생성 (콘텐츠별) | 사전 생성 필수 | 생성 없음 |
| **스케줄러** | LLM 직접 생성 | 코드 기반 | 없음 (호출자 책임) |
| **플래너 연계** | ✅ 필수 생성 | ⚠️ 검증만 | ❌ 불필요 |
| **기본 모델** | fast | standard | standard |
| **동시 처리** | 3명씩 | 1명 | - |

### 4.2 배치 모드 상세

#### 흐름
```
[권한 확인] → [테넌트] → [3명씩 배치 처리]
                           ↓
                    학생별 처리:
                    ├─ loadStudentData()
                    ├─ ensurePlannerForStudent() ← 플래너 자동 생성
                    ├─ loadContents(), loadScores()
                    ├─ LLM 호출 (fast 모델)
                    ├─ 응답 파싱 + contentId별 분할 ← 핵심
                    └─ 각 콘텐츠마다 Plan Group 생성
```

#### 콘텐츠별 분할 로직
```typescript
// 플랜을 contentId별로 그룹화
const plansByContent = new Map<string, GeneratedPlanItem[]>();
for (const plan of allPlans) {
  const existing = plansByContent.get(plan.contentId) || [];
  existing.push(plan);
  plansByContent.set(plan.contentId, existing);
}

// 각 콘텐츠별 Plan Group 생성
for (const [contentId, contentPlans] of plansByContent) {
  const groupInput: AtomicPlanGroupInput = {
    planner_id: plannerId,
    creation_mode: "ai_batch",
    is_single_content: true,
    content_type: content.content_type,
    content_id: content.id,
    start_range: calculatedStartRange,
    end_range: calculatedEndRange,
    // ...
  };
  await createPlanGroupAtomic(groupInput, ...);
}
```

#### 결과 구조
```typescript
interface StudentPlanResult {
  studentId: string;
  studentName: string;
  status: "success" | "error" | "skipped";
  planGroupId?: string;      // 첫 번째 그룹 (하위 호환성)
  planGroupIds?: string[];   // 콘텐츠별 그룹 목록
  totalPlans?: number;
  cost?: { inputTokens, outputTokens, estimatedUSD };
}
```

### 4.3 하이브리드 완전 모드 상세

#### 흐름
```
[Plan Group 검증] ← planner_id, is_single_content 확인
        ↓
[Phase 0] 가상 콘텐츠 영구 저장 (선택)
        │
        ├─ virtualContents 있으면:
        │   ├─ createBook() / createLecture()
        │   ├─ student_book_details / student_lecture_episodes 생성
        │   └─ idMap: virtualId → realId
        ↓
[Phase 1] generateAIFrameworkAction()
        │
        ├─ LLM 호출 → AIFramework 생성
        └─ convertFrameworkToSchedulerOptions()
        ↓
[Phase 2] Framework → SchedulerOptions 변환 (자동)
        │
        └─ aiSchedulerOptionsOverride 생성
        ↓
[Phase 3] generatePlansWithServices()
        │
        ├─ 기존 코드 스케줄러 호출
        ├─ aiSchedulerOptionsOverride 주입
        └─ 플랜 저장
        ↓
출력: GenerateHybridPlanCompleteResult
```

#### Plan Group 검증 (Phase 0.5)
```typescript
// planner_id 미연결 경고
if (!planGroup.planner_id) {
  logActionWarn(
    { domain: "plan", action: "generateHybridPlanComplete" },
    "플래너 미연결 Plan Group에서 AI 플랜 생성",
    { planGroupId, studentId }
  );
}

// 다중 콘텐츠 모드 경고
if (!planGroup.is_single_content) {
  logActionWarn(
    { domain: "plan", action: "generateHybridPlanComplete" },
    "다중 콘텐츠 Plan Group - 레거시 모드",
    { planGroupId }
  );
}
```

### 4.4 Framework 생성 모드 상세

#### AI Framework 구조
```typescript
interface AIFramework {
  version: string;
  strategySummary: string;

  // 과목별 분류
  subjectClassifications: Array<{
    subjectCategory: string;
    classification: "weakness" | "strategy" | "neutral";
    confidence: number;          // 0-1
    priorityRank: number;
    recommendedWeeklyDays: number;
  }>;

  // 주별/일별 전략
  weeklyStrategies: Array<{
    dailyStrategies: Array<{
      focusType: "intensive" | "balanced" | "light" | "review";
    }>;
  }>;

  // 콘텐츠 우선순위
  contentPriority: Array<{
    contentId: string;
    priorityRank: number;
    urgency: "critical" | "high" | "medium" | "low";
  }>;

  // AI 추천사항
  recommendations: {
    studyTips: string[];
    warnings: string[];
    focusAreas: string[];
  };
}
```

#### SchedulerOptions 변환 규칙
```
Framework                    →  SchedulerOptions
─────────────────────────────────────────────────
subjectClassifications      →  subject_allocations
  - classification          →    subject_type
  - recommendedWeeklyDays   →    weekly_days

weeklyStrategies[0]         →  study_days, review_days
  - non-review 일 수        →    study_days
  - review 일 수            →    review_days

weakness 비율 + 우선순위    →  weak_subject_focus
                               ("low" | "medium" | "high")

contentPriority             →  content_allocations
  - urgency별 조정          →    weekly_days ±1~2
```

---

## 5. 플래너/플랜관리 시스템

### 5.1 핵심 개념 변경 (Phase 3 완료)

| 변경 전 | 변경 후 |
|--------|--------|
| Plan Group에 여러 콘텐츠 (1:N) | Plan Group에 단일 콘텐츠 (1:1) |
| planner_id 선택적 | planner_id 필수 지향 |
| 스케줄러 조율: Plan Group | 스케줄러 조율: Planner |
| plan_contents 테이블 사용 | Plan Group 컬럼으로 이동 |

### 5.2 plan_groups 테이블 확장

```sql
-- 플래너 연계
planner_id UUID REFERENCES planners(id)
creation_mode VARCHAR  -- 'manual', 'ai_batch', 'ai_hybrid', 'quick'

-- 단일 콘텐츠 모드
is_single_content BOOLEAN DEFAULT true
content_type VARCHAR     -- 'book', 'lecture'
content_id UUID
master_content_id UUID
start_range INTEGER
end_range INTEGER
start_detail_id UUID
end_detail_id UUID

-- 기타
plan_mode VARCHAR        -- 'daily', 'weekly', etc.
study_type VARCHAR
strategy_days_per_week INTEGER
```

### 5.3 AtomicPlanGroupInput 타입

```typescript
export type AtomicPlanGroupInput = {
  // 기존 필드
  tenant_id: string;
  student_id: string;
  name: string | null;
  period_start: string;
  period_end: string;
  status: string;
  plan_type: string | null;
  // ...

  // Phase 3 플래너 연계 필드
  planner_id?: string | null;
  creation_mode?: string | null;
  plan_mode?: string | null;
  is_single_day?: boolean;
  study_type?: string | null;
  strategy_days_per_week?: number | null;

  // 단일 콘텐츠 모드 필드
  content_type?: string | null;
  content_id?: string | null;
  master_content_id?: string | null;
  start_range?: number | null;
  end_range?: number | null;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  is_single_content?: boolean;
};
```

### 5.4 플래너 자동 생성

```typescript
// lib/domains/plan/actions/planners/autoCreate.ts
export async function getOrCreateDefaultPlannerAction(
  options: CreateDefaultPlannerOptions
): Promise<GetOrCreateDefaultPlannerResult>

interface CreateDefaultPlannerOptions {
  studentId?: string;
  periodStart?: string;
  periodEnd?: string;
  name?: string;
}

interface GetOrCreateDefaultPlannerResult {
  plannerId: string;
  isNew: boolean;
  plannerName: string;
}
```

### 5.5 통합 콘텐츠 접근

```typescript
// lib/data/planGroups/unifiedContent.ts

// 단일/다중 콘텐츠 통합 조회
export async function getUnifiedContents(
  planGroupId: string
): Promise<UnifiedContent[]>

// 단일 콘텐츠 동기 추출
export function getSingleContentFromGroup(
  planGroup: PlanGroupWithContent
): SingleContentInfo | null

// 헬퍼 함수
export function hasContent(planGroup): boolean
export function getContentMode(planGroup): "single" | "multiple" | "none"
```

---

## 6. 시스템 간 연계

### 6.1 전체 데이터 흐름

```
┌──────────────────────────────────────────────────────────────────────┐
│                         사용자 요청                                   │
│                              ↓                                        │
│                    ┌─────────┴─────────┐                             │
│                    │                   │                              │
│                    ↓                   ↓                              │
│              신규 사용자          기존 사용자                          │
│                    │                   │                              │
│                    ↓                   ↓                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                  │
│  │    콜드스타트        │    │    AI 추천          │                  │
│  │  runColdStartPipeline│    │ recommendContentWithAI│               │
│  └─────────┬───────────┘    └─────────┬───────────┘                  │
│            │                          │                               │
│            └──────────┬───────────────┘                               │
│                       ↓                                               │
│            RecommendationItem[]                                       │
│                       ↓                                               │
│  ┌────────────────────┴────────────────────┐                         │
│  │          플랜 생성 방식 선택             │                         │
│  │  ┌────────┬────────────┬────────────┐  │                         │
│  │  │ 배치   │ 하이브리드  │ 빠른생성   │  │                         │
│  │  │ 모드   │   완전     │            │  │                         │
│  │  └───┬────┴─────┬──────┴─────┬──────┘  │                         │
│  └──────┼──────────┼────────────┼─────────┘                         │
│         ↓          ↓            ↓                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    플래너 시스템                              │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  Planner                                            │   │    │
│  │  │  - scheduler_options (스케줄러 조율)                 │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │                         │ 1:N                               │    │
│  │           ┌─────────────┼─────────────┐                    │    │
│  │           ↓             ↓             ↓                    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │    │
│  │  │ Plan Group  │ │ Plan Group  │ │ Plan Group  │          │    │
│  │  │ (콘텐츠 A)  │ │ (콘텐츠 B)  │ │ (콘텐츠 C)  │          │    │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │    │
│  │         ↓               ↓               ↓                  │    │
│  │    student_plan    student_plan    student_plan           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 콜드스타트 → AI 플랜 생성

```
[콜드스타트]
runColdStartPipeline()
        ↓
RecommendationItem[]
        ↓
[통합 추천 API]
/api/plan/content-recommendation
        ↓
┌────────────────┴────────────────┐
│                                 │
↓                                 ↓
[빠른 플랜 생성]          [하이브리드 완전]
quickCreate.ts            generateHybridPlanComplete.ts
                          (virtualContents로 전달)
```

### 6.3 AI 플랜 생성 → 플래너 시스템

**배치 모드:**
```typescript
// 1. 플래너 확보
const { plannerId } = await ensurePlannerForStudent(
  supabase, tenantId, studentId, periodStart, periodEnd
);

// 2. Plan Group 생성 (콘텐츠별)
const groupInput: AtomicPlanGroupInput = {
  planner_id: plannerId,
  creation_mode: "ai_batch",
  is_single_content: true,
  content_type: content.content_type,
  content_id: content.id,
  // ...
};
```

**하이브리드 완전:**
```typescript
// Plan Group 사전 생성 필수
// 검증만 수행 (진행 방해 없음)
if (!planGroup.planner_id) {
  logActionWarn("플래너 미연결 Plan Group");
}
```

### 6.4 스케줄러 연동

```typescript
// 하이브리드 완전 모드에서의 스케줄러 호출
const planResult = await generatePlansWithServices({
  groupId: input.planGroupId,
  context: { studentId, tenantId, userId, role },

  // AI Framework에서 생성된 옵션 주입
  aiSchedulerOptionsOverride: {
    weak_subject_focus: "high",
    study_days: 6,
    review_days: 1,
    subject_allocations: [...],
    content_allocations: [...]
  }
});

// 스케줄러 내부에서 옵션 병합
// 우선순위: aiSchedulerOptionsOverride > Plan Group scheduler_options
```

---

## 7. 현재 상태 및 한계

### 7.1 현재 구현 상태

| 시스템 | 상태 | 비고 |
|--------|------|------|
| 콜드스타트 파이프라인 | ✅ 완료 | 5단계 Task 구현 |
| Rate Limit 보호 | ✅ 완료 | DB Fallback |
| 배치 처리 | ✅ 완료 | GitHub Actions |
| 배치 AI 플랜 생성 | ✅ 완료 | 콘텐츠별 분할 |
| 하이브리드 완전 | ✅ 완료 | 플래너 검증 추가 |
| 플래너 자동 생성 | ✅ 완료 | ensurePlannerForStudent |
| 단일 콘텐츠 모드 | ✅ 완료 | is_single_content: true |

### 7.2 현재 한계점

#### 콜드스타트
| 한계 | 설명 | 영향 |
|------|------|------|
| API Rate Limit | Gemini Free Tier 20회/일 | 대량 요청 시 DB fallback 의존 |
| 웹 검색 품질 | Grounding 결과 불안정 | 파싱 실패 가능 |
| 언어 제한 | 한국어 교육 콘텐츠만 | 영어 콘텐츠 미지원 |

#### AI 플랜 생성
| 한계 | 설명 | 영향 |
|------|------|------|
| 배치 동시성 | 3명으로 제한 | 100명 처리 시 ~5분 소요 |
| LLM 비용 | 대량 처리 시 비용 증가 | 예산 관리 필요 |
| 스케줄러 의존 | 하이브리드 모드는 기존 스케줄러 한계 상속 | 복잡한 조율 제한 |

#### 플래너 시스템
| 한계 | 설명 | 영향 |
|------|------|------|
| 레거시 데이터 | is_single_content: false 그룹 존재 | 통합 조회 복잡성 |
| 캠프 슬롯 모드 | 다중 콘텐츠 유지 필요 | plan_contents 완전 제거 불가 |
| UI 미반영 | 플래너 선택 UI 미구현 | 사용자 경험 제한 |

### 7.3 성능 특성

| 파이프라인 | 처리 시간 | 토큰/학생 | 예상 비용 |
|-----------|---------|---------|---------|
| 콜드스타트 | ~5초 | ~3,000 | ~$0.003 |
| 배치 모드 | ~9초/학생 | ~5,000 | ~$0.005 |
| 하이브리드 완전 | ~12초 | ~3,500 | ~$0.003 |
| Framework 생성 | ~8.5초 | ~3,500 | ~$0.003 |

---

## 8. 향후 개선 로드맵

### 8.1 단기 개선 (1-2주)

#### P1: UI 개선
| 작업 | 파일 | 설명 |
|------|------|------|
| 플래너 선택 UI | AdminAIPlanModal.tsx | 플래너 드롭다운 추가 |
| 배치 결과 UI | BatchAIPlanModalContent.tsx | planGroupIds 표시 |
| 콘텐츠별 결과 | 결과 모달 | 각 콘텐츠별 생성 상태 표시 |

#### P2: 테스트 보강
```
[ ] batchAIPlanGeneration 콘텐츠별 분할 테스트
[ ] ensurePlannerForStudent 플래너 생성 테스트
[ ] generateHybridPlanComplete Plan Group 검증 테스트
[ ] 콜드스타트 Rate Limit fallback 테스트
```

### 8.2 중기 개선 (1-2개월)

#### 콜드스타트 개선
| 작업 | 목표 | 기대효과 |
|------|------|---------|
| Gemini Pro 전환 | Rate Limit 완화 | 500회/일 이상 |
| 캐시 전략 강화 | Redis 캐싱 | 응답 속도 50% 개선 |
| 다중 언어 지원 | 영어 콘텐츠 | 글로벌 확장 |

#### AI 플랜 생성 개선
| 작업 | 목표 | 기대효과 |
|------|------|---------|
| 배치 동시성 증가 | 5-10명 동시 | 처리 시간 40% 단축 |
| 모델 최적화 | 프롬프트 튜닝 | 토큰 20% 절감 |
| 스트리밍 응답 | SSE 실시간 진행 | UX 개선 |

#### 플래너 시스템 개선
| 작업 | 목표 | 기대효과 |
|------|------|---------|
| plan_contents 제거 | 레거시 테이블 정리 | 코드 단순화 |
| 스케줄러 조율 통합 | Planner 레벨 조율 | 복잡한 플랜 지원 |
| 플래너 템플릿 | 재사용 가능한 설정 | 사용자 편의성 |

### 8.3 장기 개선 (3-6개월)

#### 아키텍처 개선
```
1. 마이크로서비스 분리
   ├─ 콜드스타트 서비스
   ├─ AI 플랜 생성 서비스
   └─ 플래너 관리 서비스

2. 이벤트 기반 아키텍처
   ├─ 플랜 생성 이벤트 → 알림 서비스
   ├─ 콘텐츠 추천 이벤트 → 분석 서비스
   └─ 플래너 변경 이벤트 → 동기화 서비스

3. AI 모델 고도화
   ├─ Fine-tuned 모델 (교육 특화)
   ├─ RAG 기반 콘텐츠 추천
   └─ 학습 패턴 예측 모델
```

#### 새로운 기능
| 기능 | 설명 | 우선순위 |
|------|------|---------|
| 적응형 플랜 조정 | 학습 진행에 따른 자동 조정 | 높음 |
| 협업 플랜 | 그룹 학습 플랜 생성 | 중간 |
| 플랜 공유 | 성공한 플랜 템플릿 공유 | 낮음 |

### 8.4 개선 우선순위 매트릭스

```
                    영향도 높음
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │  [Quick Wins]     │  [Major Projects] │
    │  - UI 개선        │  - 스케줄러 통합   │
    │  - 테스트 보강    │  - 마이크로서비스  │
    │                   │  - AI 모델 고도화  │
노력 ───────────────────┼───────────────────── 노력
적음                    │                   많음
    │                   │                   │
    │  [Fill-Ins]       │  [Thankless Tasks]│
    │  - 문서 정리      │  - plan_contents  │
    │  - 로깅 개선      │    완전 제거      │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    영향도 낮음
```

---

## 9. 참조

### 9.1 핵심 파일 목록

#### 콜드스타트
```
lib/domains/plan/llm/actions/coldStart/
├── pipeline.ts
├── types.ts
├── validateInput.ts
├── buildQuery.ts
├── executeSearch.ts
├── parseResults.ts
├── rankResults.ts
├── persistence/
└── batch/
```

#### AI 플랜 생성
```
lib/domains/admin-plan/actions/batchAIPlanGeneration.ts
lib/domains/plan/llm/actions/generateHybridPlanComplete.ts
lib/domains/plan/llm/actions/generateHybridPlan.ts
lib/domains/plan/llm/transformers/frameworkToSchedulerOptions.ts
```

#### 플래너/플랜관리
```
lib/domains/plan/transactions.ts
lib/domains/plan/actions/planners/autoCreate.ts
lib/data/planGroups/unifiedContent.ts
lib/plan/schedulerPlanner.ts
lib/plan/services/index.ts
```

### 9.2 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 콜드스타트 가이드 | docs/cold-start-system-guide.md | 사용법 상세 |
| Auth Strategy 패턴 | docs/auth-strategy-pattern.md | 인증 패턴 |

### 9.3 관련 메모리

| 메모리 | 설명 |
|--------|------|
| plan-system-unification-architecture | 플래너 시스템 Phase 1-5 구현 기록 |
| ai-plan-planner-integration-analysis | AI 플랜 ↔ 플래너 통합 분석 |
| codebase-architecture-analysis-2025-12 | 전체 코드베이스 아키텍처 |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-20 | 1.0 | 초안 작성 - 시스템 연계성 분석 및 개선 로드맵 |
