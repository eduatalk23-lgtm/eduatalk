# AI 플랜 생성 파이프라인 분석 보고서

## 1. 분석 대상 파일 개요

### 1.1 세 가지 핵심 파이프라인

| 파일 | 용도 | 출력 | 특징 |
|------|------|------|------|
| **batchAIPlanGeneration.ts** | 배치 AI 플랜 생성 | 여러 학생용 Plan Group & Plans | 다중 학생 처리, 동시성 제어(3명), 콘텐츠별 분할 |
| **generateHybridPlanComplete.ts** | 하이브리드 플랜 완전 생성 | 단일 Plan Group & Plans | AI Framework + 코드 스케줄러 결합 |
| **generateHybridPlan.ts** | AI 프레임워크 생성 | AIFramework 객체 | SchedulerOptions 변환 담당 |

---

## 2. 각 파이프라인의 상세 흐름

### 2.1 batchAIPlanGeneration.ts (배치 모드)

```
입력: BatchPlanGenerationInput
  └─ students: { studentId, contentIds }[]
  └─ settings: BatchPlanSettings
  └─ planGroupNameTemplate?: string

처리 흐름:
  1. [권한 확인] getCurrentUser() → admin/consultant 필수
  2. [테넌트 확인] requireTenantContext()
  3. [동시성 제어] CONCURRENCY_LIMIT = 3 (배치 처리)
  
  각 학생별 (generatePlanForStudent):
    │
    ├─ [학생 데이터 로드]
    │  └─ loadStudentData(studentId, tenantId)
    │
    ├─ [콘텐츠 검증]
    │  └─ contentIds 존재 여부 확인
    │
    ├─ [플래너 확보] ★ Phase 3 연계
    │  └─ ensurePlannerForStudent()
    │     └─ 기본 플래너 조회 또는 신규 생성
    │     └─ period_start, period_end 설정
    │
    ├─ [데이터 로드] (병렬)
    │  ├─ loadScores()
    │  ├─ loadContents(contentIds)
    │  ├─ loadTimeSlots()
    │  └─ loadLearningStats()
    │
    ├─ [LLM 요청 빌드]
    │  └─ buildLLMRequest({
    │     student, scores, contents, timeSlots,
    │     learningStats, settings
    │  })
    │
    ├─ [요청 검증]
    │  └─ validateRequest()
    │
    ├─ [LLM 호출] (fast 모델)
    │  └─ createMessage({
    │     system: SYSTEM_PROMPT,
    │     modelTier: "fast",
    │     grounding: webSearchConfig  ← Gemini 그라운딩
    │  })
    │
    ├─ [웹 검색 결과 처리] (선택)
    │  └─ getWebSearchContentService()
    │     └─ saveToDatabase()  ← 웹 검색 콘텐츠 영구 저장
    │
    ├─ [응답 파싱]
    │  └─ parseLLMResponse() → GeneratedPlanItem[]
    │
    ├─ [플랜 수집 및 분할] ★ 핵심
    │  └─ allPlans → contentId별로 Map 생성
    │     └─ plansByContent: Map<contentId, GeneratedPlanItem[]>
    │
    ├─ [콘텐츠별 Plan Group 생성] (반복)
    │  └─ createPlanGroupAtomic({
    │     name: "{content.title} ({startDate} ~ {endDate})",
    │     scheduler_type: "ai_batch",
    │     planner_id: plannerId,           ← Phase 3 플래너 연계
    │     creation_mode: "ai_batch",
    │     is_single_content: true,         ← 콘텐츠 단일 모드
    │     content_type, content_id,
    │     start_range, end_range
    │  })
    │
    ├─ [플랜 저장]
    │  └─ generatePlansAtomic({
    │     groupId,
    │     atomicPlans: batchPlanItemsToAtomicPayloads(),
    │     status: "active"
    │  })
    │
    └─ [비용 계산]
       └─ estimateCost(inputTokens, outputTokens, "fast")

출력: StudentPlanResult
  ├─ status: "success" | "error" | "skipped"
  ├─ planGroupIds: string[]  ← 콘텐츠별 그룹 ID
  ├─ totalPlans: number
  ├─ cost: { inputTokens, outputTokens, estimatedUSD }
  └─ webSearchResults?: { searchQueries, resultsCount, savedCount }
```

**특징:**
- 다중 학생 동시 처리 (최대 3명/배치)
- 콘텐츠별로 **분리된 Plan Group 생성**
- 각 콘텐츠마다 독립적인 스케줄링
- 스트리밍 지원 버전: `generateBatchPlansWithStreaming()`

---

### 2.2 generateHybridPlanComplete.ts (완전 생성 모드)

```
입력: GenerateHybridPlanCompleteInput
  └─ planGroupId: string  ★ 사전 생성 필수
  └─ student, scores, contents, period, ...
  └─ virtualContents?: VirtualContentInput[]  ← AI 검색 결과
  └─ enableWebSearch?: boolean
  └─ webSearchConfig?: { mode, dynamicThreshold, saveResults }

처리 흐름:

  Phase 0.5: [Plan Group 검증]
    └─ select("planner_id", "is_single_content", "content_type", "content_id")
       └─ 플래너 연계 확인 (경고만, 레거시 호환)

  Phase 0: [가상 콘텐츠 영구 저장]
    └─ virtualContents ≠ ∅ 인 경우
       │
       ├─ contentType === "book"
       │  ├─ createBook({ title, subject, total_pages })
       │  └─ student_book_details 생성 (목차)
       │
       ├─ contentType === "lecture"
       │  ├─ createLecture({ title, subject, duration, total_episodes })
       │  └─ student_lecture_episodes 생성 (에피소드)
       │
       └─ idMap: Map<virtualId, realId> 생성
          └─ contents, contentMappings 업데이트

  Phase 1: [AI Framework 생성]
    └─ generateAIFrameworkAction({
         student, scores, contents,  ← virtualId → realId 매핑됨
         learningHistory, period,
         additionalInstructions,
         modelTier: "standard",
         contentMappings,
         enableWebSearch
       })
       └─ AIFramework 반환
       └─ conversionResult: { schedulerOptions, aiRecommendations }

  Phase 2: [Framework → SchedulerOptions 변환]
    └─ schedulerOptions: {
         weak_subject_focus: "low" | "medium" | "high",
         study_days: number,
         review_days: number,
         subject_allocations: [...],
         content_allocations?: [...]
       }

  Phase 3: [코드 기반 스케줄러로 플랜 생성]
    └─ generatePlansWithServices({
         groupId: input.planGroupId,
         context: { studentId, tenantId, userId, role },
         aiSchedulerOptionsOverride: aiSchedulerOptions  ← AI 전략 적용
       })
       └─ 기존 스케줄러 실행, AI 옵션으로 오버라이드

  Phase 4: [메트릭스 로깅]
    └─ MetricsBuilder
       └─ 토큰 사용량, 비용, 웹 검색 통계

출력: GenerateHybridPlanCompleteResult
  ├─ success: boolean
  ├─ planCount?: number
  ├─ aiRecommendations?: AIRecommendations
  ├─ tokensUsed?: { input, output }
  ├─ aiProcessingTimeMs?: number
  ├─ totalProcessingTimeMs?: number
  ├─ lowConfidenceWarning?: boolean
  └─ error?, errorPhase?
```

**특징:**
- 사전에 Plan Group을 만들어야 함 (외부 호출자 책임)
- 가상 콘텐츠(AI 검색 결과) 영구 저장 지원
- AI Framework와 코드 스케줄러의 **순차 실행**
- 미리보기 버전: `previewHybridPlanAction()` (저장 없음)

---

### 2.3 generateHybridPlan.ts (Framework 생성만)

```
입력: GenerateFrameworkInput
  └─ student, scores, contents
  └─ learningHistory?: AIFrameworkLearningHistory
  └─ period: { startDate, endDate, totalDays, studyDays }
  └─ modelTier?: "standard" | "fast" | ...
  └─ contentMappings?: ContentMapping[]
  └─ enableWebSearch?: boolean
  └─ webSearchConfig?: { mode, dynamicThreshold }

처리 흐름:

  1. [권한 검증]
     └─ getCurrentUser() → 로그인 필수

  2. [테넌트 검증]
     └─ requireTenantContext()

  3. [입력 검증]
     └─ student ≠ ∅, period ≠ ∅, contents.length ≥ 1

  4. [모델 설정]
     └─ modelTier = "standard" (기본값)
     └─ modelConfig = getModelConfig(modelTier)

  5. [Framework 입력 구성]
     └─ AIFrameworkInput 생성

  6. [프롬프트 생성]
     └─ buildFrameworkUserPrompt(frameworkInput)
        └─ 학생 정보, 성적, 콘텐츠 정보 포함

  7. [Grounding 설정]
     └─ enableWebSearch === true인 경우:
        └─ grounding: {
             enabled: true,
             mode: "dynamic" | "always",
             dynamicThreshold?: number
           }

  8. [LLM 호출]
     └─ createMessage({
          system: FRAMEWORK_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          maxTokens: 4000,
          grounding: groundingConfig
        })

  9. [응답 파싱]
     └─ parseFrameworkResponse(responseText)
        └─ AIFramework JSON 추출

  10. [메타데이터 업데이트]
      └─ updateFrameworkMeta({
           modelId,
           tokensUsed: { input, output },
           processingTimeMs
         })

  11. [SchedulerOptions 변환] ★ 핵심
      └─ convertFrameworkToSchedulerOptions(framework, {
           contentMappings
         })
         └─ FrameworkConversionResult:
            ├─ schedulerOptions: {
            │  weak_subject_focus,
            │  study_days,
            │  review_days,
            │  subject_allocations,
            │  content_allocations
            │}
            └─ contentOrdering: Map<contentId, priority>
            └─ aiRecommendations

  12. [신뢰도 확인]
      └─ isHighConfidenceFramework(framework, 0.7)
         └─ lowConfidenceWarning 설정

  13. [웹 검색 결과 처리]
      └─ response.groundingMetadata.webResults

  14. [메트릭스 로깅]
      └─ MetricsBuilder
         └─ 토큰, 비용, 추천사항 통계

출력: GenerateFrameworkResult
  ├─ success: boolean
  ├─ framework?: AIFramework
  ├─ conversionResult?: FrameworkConversionResult  ← 스케줄러 옵션 포함
  ├─ tokensUsed?: { input, output }
  ├─ processingTimeMs?: number
  ├─ lowConfidenceWarning?: boolean
  ├─ webSearchResults?: { searchQueries, resultsCount, results }
  └─ error?
```

**특징:**
- **가장 가벼운 AI 호출** (입력 ~2000 토큰, 출력 ~1500)
- 프레임워크 생성만 담당
- 자동으로 SchedulerOptions로 변환
- 스케줄러 호출은 별도로 수행

---

## 3. AI Framework와 SchedulerOptions 매핑 (핵심)

### 3.1 AIFramework 구조

```typescript
interface AIFramework {
  version: "1.0";
  generatedAt: string;
  strategySummary: string;
  
  // 과목 분류 (AI 분석)
  subjectClassifications: SubjectClassification[];
  // ├─ subjectCategory: "수학", "영어", ...
  // ├─ classification: "strategy" | "weakness" | "neutral"
  // ├─ confidence: 0-1
  // ├─ priorityRank: 1, 2, 3, ...
  // └─ recommendedWeeklyDays: 2-7
  
  // 주별 전략
  weeklyStrategies: WeeklyStrategy[];
  // └─ dailyStrategies[].focusType: "intensive" | "balanced" | "light" | "review"
  
  // 과목별 시간대 권장
  timeHints: TimeHint[];
  // └─ { subjectCategory, preferredTimeSlot, optimalDurationMinutes, ... }
  
  // 콘텐츠 우선순위
  contentPriority: ContentPriority[];
  // └─ { contentId, priorityRank, urgency: "critical" | "high" | "medium" | "low", ... }
  
  // 사용자 조언
  recommendations: AIRecommendations;
  
  meta: AIFrameworkMeta;
}
```

### 3.2 변환 규칙 (frameworkToSchedulerOptions.ts)

```
AIFramework → SchedulerOptions 변환

1️⃣ weak_subject_focus 계산
   └─ weakness 과목 비율 + 우선순위 → "low" | "medium" | "high"

2️⃣ subject_allocations 변환
   └─ SubjectClassification[] → SubjectAllocation[]
   ├─ filter: classification !== "neutral"
   ├─ map: {
   │  subject_id,
   │  subject_name,
   │  subject_type: classification,
   │  weekly_days: recommendedWeeklyDays
   │}
   └─ sort: weakness 먼저, 주간 일수 내림차순

3️⃣ content_allocations 변환
   └─ ContentPriority[] → ContentAllocation[]
   ├─ 필요: contentMappings (contentId → 과목 매핑)
   ├─ map: {
   │  content_id,
   │  content_type: "book" | "lecture" | "custom",
   │  subject_type,
   │  weekly_days: calculateContentWeeklyDays()
   │}
   └─ 계산: 기본값 + urgency 조정
      ├─ critical: +2일 (최대 7일)
      ├─ high: +1일
      ├─ low: -1일 (최소 1일)

4️⃣ study_days 계산
   └─ 첫 번째 주의 dailyStrategies에서
      └─ focusType !== "review"인 날의 수

5️⃣ review_days 계산
   └─ 첫 번째 주의 dailyStrategies에서
      └─ focusType === "review"인 날의 수

6️⃣ contentOrdering: Map<contentId, priority>
   └─ priorityRank로 정렬
```

### 3.3 SchedulerOptions 구조

```typescript
interface AISchedulerOptionsOverride {
  weak_subject_focus: "low" | "medium" | "high";
  study_days: number;           // 주당 학습일
  review_days: number;          // 주당 복습일
  subject_allocations: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days: number;        // 이 과목에 할당할 일수
  }>;
  content_allocations?: Array<{
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    subject_type: "strategy" | "weakness";
    weekly_days: number;
  }>;
}
```

---

## 4. 플래너(Planner) 연계 (Phase 3)

### 4.1 플래너 역할

| 파이프라인 | 플래너 사용 | 연계 방식 |
|-----------|-----------|---------|
| **배치 모드** | ✅ 필수 | `ensurePlannerForStudent()` → Plan Group에 저장 |
| **하이브리드 완전** | ⚠️ 검증만 | Plan Group 사전 생성 시 이미 연결됨 |
| **Framework 생성** | ❌ 불필요 | 스케줄러 옵션만 생성 |

### 4.2 Plan Group에 플래너 정보 저장

```typescript
// 배치 모드
groupInput: AtomicPlanGroupInput = {
  // ...
  planner_id: plannerId,           // ← 플래너 ID
  creation_mode: "ai_batch",       // ← 생성 모드 표식
  is_single_content: true,         // ← 단일 콘텐츠 모드 활성
  content_type: "book" | "lecture",
  content_id: contentId,
  start_range, end_range,
  // ...
}

// 하이브리드 완전 (사전 생성)
// Plan Group이 이미 planner_id를 가진 상태
// validatePlanGroup() → 경고만 발생 (레거시 호환)
```

---

## 5. 스케줄러(Scheduler) 연동점

### 5.1 스케줄러 호출 시점

| 파이프라인 | 스케줄러 호출 | 타이밍 |
|-----------|------------|--------|
| **배치 모드** | ❌ 없음 | LLM에서 직접 플랜 생성 |
| **하이브리드 완전** | ✅ `generatePlansWithServices()` | Phase 3 (AI Framework 이후) |
| **Framework 생성** | ⚠️ 외부 책임 | 호출자가 필요하면 별도 호출 |

### 5.2 스케줄러 옵션 주입

```typescript
// generatePlansWithServices 호출 (하이브리드 완전 모드에서)
const planResult = await generatePlansWithServices({
  groupId: input.planGroupId,
  context: { studentId, tenantId, userId, role },
  accessInfo: { userId, role },
  
  // ★ AI Framework에서 생성된 옵션
  aiSchedulerOptionsOverride: {
    weak_subject_focus: "high",
    study_days: 6,
    review_days: 1,
    subject_allocations: [...],
    content_allocations: [...]
  }
});

// 내부 처리 (preparePlanGenerationData)
// 1. Plan Group 조회
// 2. scheduler_options 읽기
// 3. aiSchedulerOptionsOverride 병합 (우선순위: AI > Plan Group)
// 4. 스케줄러에 전달
```

---

## 6. 공통점과 차이점

### 6.1 공통점

✅ **모두 LLM 기반**
- Gemini API 호출 (createMessage)
- 토큰 사용량 추적
- 웹 검색(Grounding) 지원

✅ **모두 원자적 트랜잭션**
- createPlanGroupAtomic()
- generatePlansAtomic()
- 부분 실패 시 롤백

✅ **모두 메트릭스 로깅**
- MetricsBuilder 사용
- 토큰, 비용, 추천사항 기록

### 6.2 차이점

| 항목 | 배치 모드 | 하이브리드 완전 | Framework 생성 |
|------|---------|--------------|--------------|
| **입력** | 다중 학생 | 단일 학생 | 단일 학생 |
| **Plan Group** | 함수 내 생성 | 사전 생성 필수 | 생성 없음 |
| **LLM 출력** | 완전 플랜 | - | Framework 만 |
| **스케줄러** | LLM 기반 | 코드 기반 | 생성 없음 |
| **동시 처리** | 최대 3명 | 순차 (Phase 1→3) | - |
| **콘텐츠별 분할** | ✅ 자동 | ❌ 단일 그룹 | - |
| **모델 기본값** | "fast" | "standard" | "standard" |

---

## 7. 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    배치 모드 (batchAIPlanGeneration)              │
├─────────────────────────────────────────────────────────────────┤
│ Input: students[], settings                                       │
│   │                                                               │
│   ├─→ [권한] [테넌트] [동시성 제어: 3명/배치]                     │
│   │                                                               │
│   ├─→ generatePlanForStudent (반복)                               │
│   │   ├─ 학생 데이터 로드                                         │
│   │   ├─ 플래너 확보 ─────────────────────┐                      │
│   │   ├─ 콘텐츠, 성적, 시간표, 학습 통계  │                      │
│   │   ├─ LLM: 전체 플랜 생성 (fast)       │                      │
│   │   ├─ 응답 파싱 → GeneratedPlanItem[]  │                      │
│   │   ├─ contentId별 분할                │                      │
│   │   │   │                               │                      │
│   │   │   ├─→ createPlanGroupAtomic    ←──┴─ planner_id 저장     │
│   │   │   │   ├─ Plan Group 생성           │                      │
│   │   │   │   │  (is_single_content=true)  │                      │
│   │   │   │   ├─ content_type, content_id │                      │
│   │   │   │   └─ start_range, end_range   │                      │
│   │   │   │                                │                      │
│   │   │   └─→ generatePlansAtomic          │                      │
│   │   │       └─ 플랜 저장                 │                      │
│   │   │                                     │                      │
│   │   └─ Cost 계산                         │                      │
│   │                                         │                      │
│   └─→ Output: StudentPlanResult[]          │                      │
│       ├─ planGroupIds (다중)               │                      │
│       ├─ totalPlans                        │                      │
│       └─ cost                              │                      │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              하이브리드 완전 (generateHybridPlanComplete)         │
├─────────────────────────────────────────────────────────────────┤
│ Input: planGroupId, student, scores, contents, virtualContents  │
│   │                                                               │
│   ├─→ Phase 0.5: Plan Group 검증                                │
│   │                                                               │
│   ├─→ Phase 0: 가상 콘텐츠 영구 저장                             │
│   │   ├─ createBook() ──────────┐                               │
│   │   ├─ createLecture() ───────┤                               │
│   │   └─ idMap: virtualId→realId│                               │
│   │                              │                               │
│   ├─→ Phase 1: generateAIFrameworkAction()                      │
│   │   ├─ Framework 생성          │                               │
│   │   ├─ convertFrameworkToSchedulerOptions() ←──┐               │
│   │   └─ webSearchResults        │              │               │
│   │                              │              │               │
│   ├─→ Phase 2: Framework→SchedulerOptions 변환  │               │
│   │                              ↓              │               │
│   ├─→ Phase 3: generatePlansWithServices() ←────┘               │
│   │   ├─ preparePlanGenerationData()                            │
│   │   │  └─ aiSchedulerOptionsOverride 병합                     │
│   │   ├─ 스케줄러 실행 (코드 기반)                              │
│   │   └─ 플랜 저장                                               │
│   │                                                               │
│   └─→ Output: GenerateHybridPlanCompleteResult                  │
│       ├─ planCount                                               │
│       ├─ aiRecommendations                                       │
│       └─ tokensUsed                                              │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Framework 생성 (generateHybridPlan)                 │
├─────────────────────────────────────────────────────────────────┤
│ Input: student, scores, contents, period                         │
│   │                                                               │
│   ├─→ [권한] [테넌트]                                            │
│   ├─→ LLM: Framework 생성 (standard)                             │
│   │   └─ buildFrameworkUserPrompt()                              │
│   │                                                               │
│   ├─→ parseFrameworkResponse()                                   │
│   │   └─ AIFramework JSON 추출                                   │
│   │                                                               │
│   ├─→ convertFrameworkToSchedulerOptions() ★                     │
│   │   └─ FrameworkConversionResult                               │
│   │       ├─ weak_subject_focus                                  │
│   │       ├─ study_days, review_days                             │
│   │       ├─ subject_allocations                                 │
│   │       ├─ content_allocations                                 │
│   │       └─ aiRecommendations                                   │
│   │                                                               │
│   └─→ Output: GenerateFrameworkResult                            │
│       ├─ framework                                               │
│       ├─ conversionResult                                        │
│       └─ tokensUsed                                              │
│                                                                   │
│       (호출자가 필요시 generatePlansWithServices() 호출)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 핵심 설계 패턴

### 8.1 "콘텐츠별 분할" 패턴 (배치 모드)

```
LLM이 여러 콘텐츠를 섞어서 플랜 생성
  ↓
contentId별로 분류 (plansByContent Map)
  ↓
각 콘텐츠마다 별도 Plan Group 생성
  ↓
각 Group은 is_single_content=true로 표시
  ↓
나중에 UI에서 콘텐츠별로 관리 가능
```

### 8.2 "하이브리드" 패턴 (완전 생성 모드)

```
AI가 전략적 프레임워크만 제공
  ↓
Framework → SchedulerOptions로 변환
  ↓
기존 코드 기반 스케줄러가 정확한 시간 배치
  ↓
AI의 장점(전략) + 코드의 장점(정확성) 결합
```

### 8.3 "가상 콘텐츠 영구화" 패턴

```
AI가 웹 검색으로 찾은 콘텐츠
  ↓
임시 ID (virtual content)로 Framework에 포함
  ↓
하이브리드 완전 모드에서 DB에 저장
  ↓
virtualId → realId 매핑
  ↓
이후 Plan Group에 저장
```

---

## 9. 토큰 사용량 및 성능 특성

| 파이프라인 | LLM 호출 | 입력 토큰 | 출력 토큰 | 모델 | 처리 시간 |
|-----------|---------|---------|---------|------|---------|
| 배치 모드 | 학생당 1회 | ~2000 | ~3000 | fast | ~5-10초 |
| 하이브리드 완전 | Phase 1만 | ~2000 | ~1500 | standard | ~8-12초 |
| Framework 생성 | 1회 | ~2000 | ~1500 | standard | ~6-10초 |

**웹 검색 오버헤드:**
- Gemini Grounding 활성화 시: +2-3초
- 웹 콘텐츠 DB 저장: +1-2초

---

## 10. 에러 처리 및 폴백

### 10.1 주요 실패 포인트

| 포인트 | 배치 | 하이브리드 완전 | Framework |
|-------|------|-----------|-----------|
| 학생 데이터 로드 | 해당 학생 skip | - | - |
| 플래너 확보 | 경고만, 계속 진행 | 경고만 | - |
| LLM 호출 | 해당 학생 실패 | 전체 실패 | 전체 실패 |
| 응답 파싱 | 해당 학생 실패 | 전체 실패 | 전체 실패 |
| Plan Group 생성 | 해당 콘텐츠 skip | 전체 실패 | - |
| 플랜 저장 | 해당 콘텐츠 skip | 전체 실패 | - |

### 10.2 Fallback 전략

- **배치 모드:** 동시성 제한(3명)으로 rate limit 피함
- **웹 검색:** 실패해도 LLM 응답 사용 (Grounding은 optional)
- **가상 콘텐츠:** 저장 실패 → 해당 콘텐츠 제외 후 계속

---

## 11. Phase 3 플래너 연계 확인 항목

✅ **배치 모드:**
- Plan Group에 `planner_id` 저장 (ensurePlannerForStudent)
- `creation_mode = "ai_batch"` 표시
- `is_single_content = true` (콘텐츠별 분할)

⚠️ **하이브리드 완전:**
- Plan Group 사전 생성 시 이미 `planner_id` 연결
- 검증만 수행 (경고만, 진행 방해 없음)

❌ **Framework 생성:**
- 플래너 연계 불필요 (Framework만 생성)

---

## 12. 스케줄러 연동 확인 항목

✅ **배치 모드:**
- 스케줄러 호출 없음 (LLM 직접)
- `scheduler_type = "ai_batch"` (나중에 분석용)

✅ **하이브리드 완전:**
- `generatePlansWithServices()` 호출
- `aiSchedulerOptionsOverride` 주입
- 기존 스케줄러 코드 활용 (점진적 마이그레이션)

⚠️ **Framework 생성:**
- 스케줄러 호출 없음
- `conversionResult.schedulerOptions` 반환
- 호출자가 필요시 `generatePlansWithServices()` 호출
