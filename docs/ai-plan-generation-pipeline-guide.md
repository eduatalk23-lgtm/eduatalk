# AI 플랜 생성 파이프라인 상세 가이드

> 작성일: 2026-01-20
> 버전: 1.0
> 대상: 개발자, 시스템 관리자

## 목차

1. [개요](#1-개요)
2. [세 가지 파이프라인 한눈에 보기](#2-세-가지-파이프라인-한눈에-보기)
3. [배치 모드 (Batch Mode)](#3-배치-모드-batch-mode)
4. [하이브리드 완전 모드 (Hybrid Complete Mode)](#4-하이브리드-완전-모드-hybrid-complete-mode)
5. [Framework 생성 모드](#5-framework-생성-모드)
6. [AI Framework 구조 상세](#6-ai-framework-구조-상세)
7. [Framework → SchedulerOptions 변환](#7-framework--scheduleroptions-변환)
8. [플래너(Planner) 연계](#8-플래너planner-연계)
9. [실제 사용 예시](#9-실제-사용-예시)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 개요

### 1.1 AI 플랜 생성이란?

AI 플랜 생성은 **LLM(Large Language Model)**을 활용하여 학생 맞춤형 학습 계획을 자동으로 생성하는 시스템입니다.

```
학생 정보 + 성적 + 콘텐츠
        ↓
   [AI 분석 엔진]
        ↓
맞춤형 학습 플랜 (일정, 분량, 전략)
```

### 1.2 왜 세 가지 파이프라인이 필요한가?

| 상황 | 적합한 파이프라인 |
|------|------------------|
| "관리자가 여러 학생의 플랜을 한 번에 생성" | **배치 모드** |
| "단일 학생의 Plan Group에서 AI 전략 + 스케줄러 결합" | **하이브리드 완전 모드** |
| "AI 전략만 미리보기 (플랜 저장 없이)" | **Framework 생성 모드** |

### 1.3 핵심 파일 위치

```
lib/domains/admin-plan/actions/
└── batchAIPlanGeneration.ts     # 배치 모드

lib/domains/plan/llm/actions/
├── generateHybridPlanComplete.ts # 하이브리드 완전 모드
└── generateHybridPlan.ts         # Framework 생성 모드

lib/domains/plan/llm/converters/
└── frameworkToSchedulerOptions.ts # Framework → 스케줄러 옵션 변환

lib/domains/plan/llm/types/
└── aiFramework.ts                 # AI Framework 타입 정의
```

---

## 2. 세 가지 파이프라인 한눈에 보기

### 2.1 비교표

| 항목 | 배치 모드 | 하이브리드 완전 | Framework 생성 |
|------|-----------|----------------|----------------|
| **주요 함수** | `generateBatchPlansWithAI` | `generateHybridPlanCompleteAction` | `generateAIFrameworkAction` |
| **입력** | 학생 ID 배열 | Plan Group ID | 학생/성적/콘텐츠 |
| **출력** | 다중 Plan Group + Plans | 단일 Plan Group의 Plans | AIFramework 객체 |
| **Plan Group** | 내부에서 자동 생성 | 사전 생성 필수 | 생성 안 함 |
| **스케줄러** | LLM이 직접 생성 | 코드 기반 스케줄러 사용 | 호출자 책임 |
| **동시 처리** | 최대 3명/배치 | 순차 처리 | - |
| **LLM 모델** | fast (기본) | standard | standard |

### 2.2 시각적 비교

```
┌─────────────────────────────────────────────────────────────────────┐
│                    배치 모드 (Batch Mode)                            │
│   ┌─────┐    ┌─────┐    ┌─────┐                                    │
│   │학생A│    │학생B│    │학생C│  ← 여러 학생 입력                   │
│   └──┬──┘    └──┬──┘    └──┬──┘                                    │
│      │          │          │                                        │
│      └──────────┼──────────┘                                        │
│                 ↓                                                    │
│          [LLM 호출 (fast)]                                          │
│                 ↓                                                    │
│    ┌────────────┴────────────┐                                     │
│    ↓            ↓            ↓                                      │
│ PlanGroup   PlanGroup   PlanGroup  ← 콘텐츠별 Plan Group 생성       │
│    │            │            │                                      │
│    ↓            ↓            ↓                                      │
│  Plans        Plans        Plans   ← 일별 플랜 저장                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              하이브리드 완전 모드 (Hybrid Complete)                  │
│                                                                     │
│   ┌──────────────┐                                                  │
│   │ Plan Group   │  ← 사전 생성 필수!                               │
│   │ (planner 연결)│                                                 │
│   └──────┬───────┘                                                  │
│          ↓                                                          │
│   [Phase 1: AI Framework 생성]                                      │
│          ↓                                                          │
│   [Phase 2: Framework → SchedulerOptions]                           │
│          ↓                                                          │
│   [Phase 3: 코드 스케줄러 실행]                                      │
│          ↓                                                          │
│   Plans 저장                                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                Framework 생성 모드 (Framework Only)                  │
│                                                                     │
│   학생/성적/콘텐츠 입력                                              │
│          ↓                                                          │
│   [LLM 호출 (standard)]                                             │
│          ↓                                                          │
│   AIFramework 객체 반환                                              │
│   (저장 없음, 호출자가 후속 처리)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 배치 모드 (Batch Mode)

### 3.1 언제 사용하나요?

- ✅ 관리자가 **여러 학생**의 플랜을 한 번에 생성할 때
- ✅ 신규 등록 학생들에게 **초기 플랜**을 일괄 배포할 때
- ✅ 학기 시작 전 **대량 플랜 생성**이 필요할 때

### 3.2 입력 데이터

```typescript
interface BatchPlanGenerationInput {
  students: {
    studentId: string;
    contentIds: string[];  // 학습할 콘텐츠 ID 목록
  }[];
  settings: BatchPlanSettings;
  planGroupNameTemplate?: string;  // 예: "{student.name}의 {content.title} 플랜"
}

interface BatchPlanSettings {
  startDate: string;           // 시작일 (YYYY-MM-DD)
  endDate: string;             // 종료일
  dailyStudyMinutes: number;   // 일일 학습 시간
  excludeDays: number[];       // 제외할 요일 (0=일, 6=토)
  includeReview: boolean;      // 복습 포함 여부
  reviewRatio: number;         // 복습 비율 (0.1 = 10%)
  prioritizeWeakSubjects: boolean;
  balanceSubjects: boolean;
  modelTier?: "fast" | "standard";  // 기본값: fast
  enableWebSearch?: boolean;
}
```

### 3.3 처리 흐름 (단계별)

```
Step 1: 권한 확인
│   └─ admin 또는 consultant만 가능
│
Step 2: 테넌트 확인
│   └─ requireTenantContext()
│
Step 3: 동시성 제어
│   └─ 최대 3명씩 배치 처리 (CONCURRENCY_LIMIT = 3)
│
Step 4: 학생별 처리 (generatePlanForStudent)
│   │
│   ├─ 4.1 학생 데이터 로드
│   │       └─ loadStudentData(studentId, tenantId)
│   │
│   ├─ 4.2 플래너 확보 ★
│   │       └─ ensurePlannerForStudent()
│   │           └─ 기존 플래너 조회 → 없으면 신규 생성
│   │
│   ├─ 4.3 병렬 데이터 로드
│   │       ├─ loadScores()        → 성적 정보
│   │       ├─ loadContents()      → 콘텐츠 정보
│   │       ├─ loadTimeSlots()     → 시간표
│   │       └─ loadLearningStats() → 학습 통계
│   │
│   ├─ 4.4 LLM 요청
│   │       ├─ buildLLMRequest()
│   │       └─ createMessage() with modelTier="fast"
│   │
│   ├─ 4.5 응답 파싱
│   │       └─ parseLLMResponse() → GeneratedPlanItem[]
│   │
│   ├─ 4.6 콘텐츠별 분할 ★★ (핵심)
│   │       └─ plansByContent: Map<contentId, Plans[]>
│   │           └─ 각 콘텐츠마다 별도 Plan Group 생성
│   │
│   └─ 4.7 저장
│           ├─ createPlanGroupAtomic() (콘텐츠별)
│           └─ generatePlansAtomic()
│
Step 5: 결과 집계
        └─ StudentPlanResult[] 반환
```

### 3.4 콘텐츠별 분할 (핵심 로직)

배치 모드의 가장 중요한 특징은 **하나의 LLM 응답을 콘텐츠별로 분할**하여 각각의 Plan Group을 만든다는 것입니다.

```typescript
// LLM이 생성한 전체 플랜
const allPlans: GeneratedPlanItem[] = [
  { date: "2026-01-21", contentId: "book-1", ... },
  { date: "2026-01-21", contentId: "lecture-1", ... },
  { date: "2026-01-22", contentId: "book-1", ... },
  // ...
];

// contentId별로 그룹화
const plansByContent = new Map<string, GeneratedPlanItem[]>();

// 결과:
// - "book-1"     → [플랜1, 플랜3, ...]
// - "lecture-1"  → [플랜2, ...]

// 각 콘텐츠별로 별도 Plan Group 생성
for (const [contentId, plans] of plansByContent) {
  await createPlanGroupAtomic({
    planner_id: plannerId,
    creation_mode: "ai_batch",
    is_single_content: true,      // ★ 단일 콘텐츠 모드
    content_type: content.type,
    content_id: contentId,
    start_range: plans[0].startPage,
    end_range: plans[plans.length - 1].endPage,
  });
}
```

### 3.5 출력 결과

```typescript
interface StudentPlanResult {
  studentId: string;
  studentName: string;
  status: "success" | "error" | "skipped";

  // 생성된 Plan Group들
  planGroupId?: string;      // 첫 번째 그룹 (하위 호환성)
  planGroupIds?: string[];   // 콘텐츠별 모든 그룹

  totalPlans?: number;       // 생성된 플랜 수

  // 비용 정보
  cost?: {
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
  };

  // 웹 검색 결과 (선택)
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
  };

  error?: string;
  failedStep?: string;
}
```

---

## 4. 하이브리드 완전 모드 (Hybrid Complete Mode)

### 4.1 언제 사용하나요?

- ✅ **이미 Plan Group이 있는** 상태에서 AI 플랜을 생성할 때
- ✅ **AI 전략**과 **코드 스케줄러**의 장점을 결합하고 싶을 때
- ✅ **가상 콘텐츠**(AI 검색 결과)를 영구 저장하면서 플랜을 생성할 때

### 4.2 "하이브리드"의 의미

```
기존 방식 (배치 모드):
  LLM이 전략 + 세부 일정 모두 생성 (정확도 낮음)

하이브리드 방식:
  AI: 전략적 결정 (어떤 과목에 집중?, 우선순위?)
    +
  코드 스케줄러: 정확한 시간/날짜 배치 (알고리즘 기반)
    =
  더 정확하고 일관된 플랜
```

### 4.3 입력 데이터

```typescript
interface GenerateHybridPlanCompleteInput {
  planGroupId: string;          // ★ 사전 생성 필수!

  // 학생 정보
  student: {
    id: string;
    name: string;
    grade: string;
  };

  // 성적 정보
  scores: {
    subject: string;
    subjectCategory: string;
    score?: number;
    percentile?: number;
  }[];

  // 콘텐츠 정보
  contents: {
    id: string;
    title: string;
    subject: string;
    contentType: "book" | "lecture";
    estimatedHours: number;
  }[];

  // 기간
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
    studyDays: number;
  };

  // 가상 콘텐츠 (AI 검색 결과)
  virtualContents?: VirtualContentInput[];

  // 옵션
  enableWebSearch?: boolean;
  modelTier?: "standard" | "fast";
}
```

### 4.4 처리 흐름 (Phase별)

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 0.5: Plan Group 검증                                   │
│   └─ planner_id 연결 여부 확인                               │
│   └─ is_single_content 모드 확인                             │
│   └─ 미연결 시 경고 로그 (진행은 계속)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 0: 가상 콘텐츠 영구 저장 (선택)                         │
│   └─ virtualContents가 있으면:                               │
│       ├─ book → createBook() + student_book_details         │
│       └─ lecture → createLecture() + student_lecture_...    │
│   └─ idMap 생성: virtualId → realId                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: AI Framework 생성                                   │
│   └─ generateAIFrameworkAction() 호출                        │
│   └─ LLM이 전략적 프레임워크 생성                             │
│   └─ 과목 분류, 우선순위, 시간 힌트 등 포함                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Framework → SchedulerOptions 변환                   │
│   └─ convertFrameworkToSchedulerOptions()                    │
│   └─ AI의 전략을 코드가 이해할 수 있는 옵션으로 변환          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 코드 스케줄러로 플랜 생성                            │
│   └─ generatePlansWithServices() 호출                        │
│   └─ aiSchedulerOptionsOverride 주입                         │
│   └─ 정확한 시간/날짜 계산 및 플랜 저장                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 메트릭스 로깅                                        │
│   └─ 토큰 사용량, 비용, 처리 시간 기록                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 출력 결과

```typescript
interface GenerateHybridPlanCompleteResult {
  success: boolean;

  // 생성 결과
  planCount?: number;

  // AI 추천사항 (플랜에 첨부)
  aiRecommendations?: {
    studyTips: string[];
    warnings: string[];
    focusAreas: string[];
  };

  // 성능 정보
  tokensUsed?: { input: number; output: number };
  aiProcessingTimeMs?: number;
  totalProcessingTimeMs?: number;

  // 신뢰도 경고
  lowConfidenceWarning?: boolean;

  // 에러 정보
  error?: string;
  errorPhase?: "validation" | "framework" | "scheduler";
}
```

---

## 5. Framework 생성 모드

### 5.1 언제 사용하나요?

- ✅ AI 전략을 **미리보기**하고 싶을 때 (저장 없이)
- ✅ **사용자에게 확인**받은 후 플랜을 생성하고 싶을 때
- ✅ **SchedulerOptions만** 필요한 상황

### 5.2 입력 데이터

```typescript
interface GenerateFrameworkInput {
  student: AIFrameworkStudentInfo;
  scores: AIFrameworkScoreInfo[];
  contents: AIFrameworkContentInfo[];
  period: AIFrameworkPeriod;

  // 옵션
  learningHistory?: AIFrameworkLearningHistory;
  modelTier?: "standard" | "fast";
  enableWebSearch?: boolean;
  additionalInstructions?: string;
  contentMappings?: ContentMapping[];
}
```

### 5.3 처리 흐름

```
Step 1: 권한/테넌트 검증
        ↓
Step 2: 입력 검증
│       └─ student, period, contents 필수
        ↓
Step 3: 프롬프트 생성
│       └─ buildFrameworkUserPrompt()
│       └─ 학생 정보, 성적, 콘텐츠를 자연어로 변환
        ↓
Step 4: LLM 호출
│       └─ createMessage({ modelTier: "standard" })
│       └─ Grounding 옵션 적용 (선택)
        ↓
Step 5: 응답 파싱
│       └─ parseFrameworkResponse()
│       └─ JSON 추출 → AIFramework 객체
        ↓
Step 6: SchedulerOptions 변환
│       └─ convertFrameworkToSchedulerOptions()
        ↓
Step 7: 결과 반환 (저장 없음)
```

### 5.4 출력 결과

```typescript
interface GenerateFrameworkResult {
  success: boolean;

  // AI Framework (핵심)
  framework?: AIFramework;

  // 변환된 스케줄러 옵션
  conversionResult?: FrameworkConversionResult;

  // 성능 정보
  tokensUsed?: { input: number; output: number };
  processingTimeMs?: number;

  // 웹 검색 결과
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    results: any[];
  };

  lowConfidenceWarning?: boolean;
  error?: string;
}
```

---

## 6. AI Framework 구조 상세

### 6.1 전체 구조

AI Framework는 LLM이 생성하는 **전략적 학습 가이드라인**입니다.

```typescript
interface AIFramework {
  version: "1.0";
  generatedAt: string;
  strategySummary: string;        // 전략 요약

  subjectClassifications: [];     // 과목별 분류
  weeklyStrategies: [];           // 주별 전략
  timeHints: [];                  // 시간 힌트
  contentPriority: [];            // 콘텐츠 우선순위
  recommendations: {};            // AI 추천사항

  meta: AIFrameworkMeta;          // 메타데이터
}
```

### 6.2 과목 분류 (Subject Classification)

AI가 학생의 성적을 분석하여 각 과목을 분류합니다.

```typescript
interface SubjectClassification {
  subjectCategory: string;    // "수학", "영어", ...
  classification: "strategy" | "weakness" | "neutral";
  confidence: number;         // 0-1 (확신도)
  reasoning: string;          // "성적 상위 10%로 전략 과목 분류"
  recommendedWeeklyDays: number;  // 2-7일
  priorityRank: number;       // 1이 가장 높음
}
```

**분류 기준:**
| 분류 | 의미 | 학습 전략 |
|------|------|----------|
| **strategy** | 전략 과목 | 상위권 진입 가능, 집중 투자 |
| **weakness** | 취약 과목 | 보강 필요, 우선 배치 |
| **neutral** | 중립 | 현상 유지, 균형 학습 |

### 6.3 주별/일별 전략

```typescript
interface WeeklyStrategy {
  weekNumber: number;
  theme: string;              // "기초 다지기 주간"
  goals: string[];            // ["미적분 개념 완료", ...]
  dailyStrategies: DailyStrategy[];
}

interface DailyStrategy {
  dayOfWeek: number;          // 0=일요일, 6=토요일
  focusType: "intensive" | "balanced" | "light" | "review";
  primarySubjects: string[];  // ["수학", "물리"]
  secondarySubjects: string[];
  recommendedMinutes: number; // 120
  strategyDescription: string;
}
```

**집중도 유형:**
| 유형 | 설명 | 권장 시간 |
|------|------|----------|
| intensive | 고강도 집중 | 3시간+ |
| balanced | 균형 학습 | 2-3시간 |
| light | 가벼운 학습 | 1-2시간 |
| review | 복습 중심 | 1시간 |

### 6.4 시간 힌트

과목별 최적 학습 시간대를 제안합니다.

```typescript
interface TimeHint {
  subjectCategory: string;
  preferredTimeSlot: "morning" | "afternoon" | "evening";
  optimalDurationMinutes: number;  // 50분
  minDurationMinutes: number;      // 30분
  maxDurationMinutes: number;      // 90분
  reasoning: string;
}
```

### 6.5 콘텐츠 우선순위

```typescript
interface ContentPriority {
  contentId: string;
  priorityRank: number;       // 1이 가장 높음
  subjectType: "strategy" | "weakness" | "neutral";
  orderInSubject: number;     // 같은 과목 내 순서
  urgency: "critical" | "high" | "medium" | "low";
  reasoning: string;
}
```

**긴급도 영향:**
| 긴급도 | 주간 학습일 조정 |
|--------|-----------------|
| critical | +2일 (최대 7일) |
| high | +1일 |
| medium | 변화 없음 |
| low | -1일 (최소 1일) |

### 6.6 AI 추천사항

```typescript
interface AIRecommendations {
  studyTips: string[];           // ["수학은 오전에 집중력이 높을 때", ...]
  warnings: string[];            // ["물리 진도가 빠름, 복습 필수"]
  suggestedAdjustments: string[];
  focusAreas: string[];          // ["미적분 기초", "영어 독해"]
  motivationalNotes?: string[];
}
```

---

## 7. Framework → SchedulerOptions 변환

### 7.1 변환 함수

```typescript
import { convertFrameworkToSchedulerOptions } from
  "@/lib/domains/plan/llm/converters/frameworkToSchedulerOptions";

const result = convertFrameworkToSchedulerOptions(framework, {
  contentMappings: [...],  // contentId → 과목 매핑
  defaultStudyDays: 6,
  defaultReviewDays: 1,
});
```

### 7.2 변환 규칙 상세

```
AIFramework                      →  SchedulerOptions
════════════════════════════════════════════════════════════════

1️⃣ weak_subject_focus 계산
   └─ weakness 과목 비율 + 평균 우선순위로 결정

   조건:
   - 비율 ≥ 50% 또는 평균 우선순위 ≤ 2 → "high"
   - 비율 ≥ 25% 또는 평균 우선순위 ≤ 4 → "medium"
   - 그 외 → "low"

2️⃣ subject_allocations 변환
   └─ SubjectClassification[] → SubjectAllocation[]

   변환 규칙:
   - neutral 제외
   - classification → subject_type
   - recommendedWeeklyDays → weekly_days
   - weakness 먼저 정렬

3️⃣ content_allocations 변환
   └─ ContentPriority[] → ContentAllocation[]

   주간 학습일 계산:
   - 기본값: 과목의 recommendedWeeklyDays (또는 3일)
   - critical: +2일 (최대 7일)
   - high: +1일
   - low: -1일 (최소 1일)

4️⃣ study_days 계산
   └─ 첫 번째 주 전략에서
   └─ focusType !== "review"인 날의 수

5️⃣ review_days 계산
   └─ 첫 번째 주 전략에서
   └─ focusType === "review"인 날의 수

6️⃣ contentOrdering 맵 생성
   └─ priorityRank로 정렬된 순서
```

### 7.3 변환 결과 구조

```typescript
interface FrameworkConversionResult {
  schedulerOptions: {
    weak_subject_focus: "low" | "medium" | "high";
    study_days: number;
    review_days: number;

    subject_allocations: Array<{
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days: number;
    }>;

    content_allocations?: Array<{
      content_id: string;
      content_type: "book" | "lecture" | "custom";
      subject_type: "strategy" | "weakness";
      weekly_days: number;
    }>;
  };

  contentOrdering: Map<string, number>;  // 콘텐츠 정렬 순서
  aiRecommendations: AIRecommendations;  // AI 추천사항
}
```

---

## 8. 플래너(Planner) 연계

### 8.1 플래너란?

**Planner**는 여러 Plan Group을 관리하는 "허브" 역할을 합니다.

```
┌─────────────────────────────────────────┐
│ Planner (플래너)                         │
│ - scheduler_options (스케줄러 조율)      │
│ - is_default, status                    │
└─────────────────────────────────────────┘
                    │ 1:N
         ┌──────────┼──────────┐
         ↓          ↓          ↓
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │PlanGroup │ │PlanGroup │ │PlanGroup │
   │(수학책)  │ │(영어강의)│ │(물리책)  │
   └──────────┘ └──────────┘ └──────────┘
```

### 8.2 파이프라인별 플래너 연계

| 파이프라인 | 플래너 필요 | 연계 방식 |
|-----------|-----------|----------|
| **배치 모드** | ✅ 필수 | `ensurePlannerForStudent()`로 자동 생성/조회 |
| **하이브리드 완전** | ⚠️ 검증만 | Plan Group이 이미 planner_id를 가짐 |
| **Framework 생성** | ❌ 불필요 | 플래너 없이 Framework만 생성 |


### 8.3 플래너 자동 생성 (배치 모드)

```typescript
// lib/domains/admin-plan/actions/batchAIPlanGeneration.ts

async function ensurePlannerForStudent(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ plannerId: string }> {

  // 1. 기존 기본 플래너 조회
  const { data: existing } = await supabase
    .from("planners")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("is_default", true)
    .single();

  if (existing) {
    return { plannerId: existing.id };
  }

  // 2. 신규 플래너 생성
  const { data: newPlanner } = await supabase
    .from("planners")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      name: "AI 생성 플래너",
      period_start: periodStart,
      period_end: periodEnd,
      is_default: true,
      status: "active",
    })
    .select("id")
    .single();

  return { plannerId: newPlanner.id };
}
```

### 8.4 Plan Group에 저장되는 플래너 정보

```typescript
const groupInput: AtomicPlanGroupInput = {
  // 기본 정보
  tenant_id: tenantId,
  student_id: studentId,
  name: "미적분 마스터하기",

  // ★ 플래너 연계 필드
  planner_id: plannerId,
  creation_mode: "ai_batch",  // 생성 모드 표시

  // ★ 단일 콘텐츠 모드
  is_single_content: true,
  content_type: "book",
  content_id: bookId,
  start_range: 1,
  end_range: 100,

  // 기타
  period_start: "2026-01-21",
  period_end: "2026-02-28",
  status: "active",
};
```

---

## 9. 실제 사용 예시

### 9.1 배치 모드 사용

```typescript
// 관리자 대시보드에서 호출
import { generateBatchPlansWithAI } from
  "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

const result = await generateBatchPlansWithAI({
  students: [
    { studentId: "student-1", contentIds: ["book-math", "lecture-english"] },
    { studentId: "student-2", contentIds: ["book-physics"] },
  ],
  settings: {
    startDate: "2026-01-21",
    endDate: "2026-02-28",
    dailyStudyMinutes: 120,
    excludeDays: [0, 6],  // 주말 제외
    includeReview: true,
    reviewRatio: 0.15,
    prioritizeWeakSubjects: true,
    balanceSubjects: true,
    modelTier: "fast",
  },
});

// 결과 처리
result.results.forEach((student) => {
  if (student.status === "success") {
    console.log(`${student.studentName}: ${student.totalPlans}개 플랜 생성`);
    console.log(`Plan Groups: ${student.planGroupIds?.join(", ")}`);
  }
});
```

### 9.2 하이브리드 완전 모드 사용

```typescript
// Plan Group 상세 페이지에서 호출
import { generateHybridPlanCompleteAction } from
  "@/lib/domains/plan/llm/actions/generateHybridPlanComplete";

const result = await generateHybridPlanCompleteAction({
  planGroupId: "existing-plan-group-id",  // 사전 생성 필수!

  student: {
    id: "student-1",
    name: "홍길동",
    grade: "고2",
  },

  scores: [
    { subject: "미적분", subjectCategory: "수학", score: 85, percentile: 90 },
    { subject: "영어독해", subjectCategory: "영어", score: 72, percentile: 75 },
  ],

  contents: [
    {
      id: "book-1",
      title: "미적분 완성",
      subject: "미적분",
      contentType: "book",
      estimatedHours: 40,
    },
  ],

  period: {
    startDate: "2026-01-21",
    endDate: "2026-02-28",
    totalDays: 39,
    studyDays: 28,
  },

  modelTier: "standard",
});

if (result.success) {
  console.log(`${result.planCount}개 플랜 생성 완료`);
  console.log("AI 팁:", result.aiRecommendations?.studyTips);
}
```

### 9.3 Framework 생성 모드 사용 (미리보기)

```typescript
// 플랜 생성 전 미리보기
import { generateAIFrameworkAction } from
  "@/lib/domains/plan/llm/actions/generateHybridPlan";

const frameworkResult = await generateAIFrameworkAction({
  student: { id: "student-1", name: "홍길동", grade: "고2" },
  scores: [...],
  contents: [...],
  period: { startDate: "2026-01-21", endDate: "2026-02-28", totalDays: 39, studyDays: 28 },
});

if (frameworkResult.success) {
  // 사용자에게 전략 미리보기 표시
  console.log("전략 요약:", frameworkResult.framework?.strategySummary);

  // 과목 분류 표시
  frameworkResult.framework?.subjectClassifications.forEach((sc) => {
    console.log(`${sc.subjectCategory}: ${sc.classification} (확신도: ${sc.confidence})`);
  });

  // 스케줄러 옵션 확인
  console.log("스케줄러 옵션:", frameworkResult.conversionResult?.schedulerOptions);

  // 사용자 확인 후 실제 플랜 생성...
}
```

---

## 10. 트러블슈팅

### 10.1 일반적인 오류

| 오류 | 원인 | 해결책 |
|------|------|--------|
| "권한 없음" | admin/consultant 아님 | 사용자 역할 확인 |
| "Plan Group 없음" | 하이브리드 모드에서 사전 생성 누락 | Plan Group 먼저 생성 |
| "플래너 미연결 경고" | Plan Group에 planner_id 없음 | 레거시 데이터, 진행에는 영향 없음 |
| "LLM 응답 파싱 실패" | AI 응답 형식 이상 | 재시도 또는 modelTier 변경 |

### 10.2 성능 최적화

```
문제: 배치 처리가 너무 느림
해결:
  1. modelTier를 "fast"로 설정
  2. 학생 수가 많으면 청크 분할
  3. enableWebSearch는 필요한 경우만 활성화

문제: 토큰 비용이 너무 높음
해결:
  1. Framework 생성 모드로 미리보기 후 확정
  2. 불필요한 콘텐츠 제외
  3. additionalInstructions 최소화
```

### 10.3 디버깅

```typescript
// 메트릭스 로그 확인
// 콘솔에서 "[AI Plan]" 프리픽스로 검색

// 토큰 사용량 확인
console.log("토큰:", result.tokensUsed);

// 처리 시간 확인
console.log("AI 처리:", result.aiProcessingTimeMs, "ms");
console.log("전체:", result.totalProcessingTimeMs, "ms");

// 신뢰도 경고 확인
if (result.lowConfidenceWarning) {
  console.warn("AI 신뢰도가 낮습니다. 결과를 검토하세요.");
}
```

---

## 참조

### 관련 문서

- [시스템 연계성 아키텍처](./system-integration-architecture.md)
- [콜드스타트 시스템 가이드](./cold-start-system-guide.md)
- [Auth Strategy 패턴](./auth-strategy-pattern.md)

### 관련 메모리

- `ai-plan-generation-pipeline-analysis` - 파이프라인 상세 분석
- `ai-plan-planner-integration-analysis` - 플래너 통합 분석
- `plan-system-unification-architecture` - Phase 1-5 구현 기록

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-20 | 1.0 | 초안 작성 - AI 플랜 생성 파이프라인 상세 가이드 |
