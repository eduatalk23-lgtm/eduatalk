# TimeLevelUp 시스템 연계성 아키텍처

> 작성일: 2026-01-20
> 상태: 최신

## 1. 시스템 개요도

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TimeLevelUp AI 학습 플랜 시스템                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │   콜드스타트     │     │   AI 플랜 생성   │     │  플래너/플랜관리  │           │
│  │   시스템        │────▶│   파이프라인     │────▶│    시스템        │           │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘           │
│         │                       │                       │                       │
│         │                       │                       │                       │
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

---

## 2. 콜드스타트 시스템

### 2.1 목적
신규 사용자(학습 이력 없음)에게 교과/과목/난이도 기반으로 콘텐츠를 즉시 추천

### 2.2 디렉토리 구조
```
lib/domains/plan/llm/actions/coldStart/
├── pipeline.ts           # 메인 파이프라인 오케스트레이션
├── types.ts              # 모든 Task의 입/출력 타입
├── validateInput.ts      # Task 1: 입력값 검증
├── buildQuery.ts         # Task 2: 검색 쿼리 생성
├── executeSearch.ts      # Task 3: Gemini API 웹 검색
├── parseResults.ts       # Task 4: AI 응답 파싱
├── rankResults.ts        # Task 5: 결과 정렬/필터링
├── persistence/          # DB 저장 모듈
│   ├── saveRecommendations.ts
│   ├── mappers.ts
│   └── duplicateCheck.ts
└── batch/                # 배치 처리 모듈
    ├── runner.ts
    ├── targets.ts
    └── streaming.ts
```

### 2.3 파이프라인 흐름
```
입력 (교과/과목/난이도/콘텐츠타입)
         ↓
[Task 1] validateColdStartInput()
         ↓
[Task 2] buildSearchQuery()
         ↓
[Task 3] executeWebSearch() ──Rate Limit──▶ DB Fallback
         ↓
[Task 4] parseSearchResults()
         ↓
[Task 5] rankAndFilterResults()
         ↓
[Task 6] saveRecommendationsToMasterContent() (선택)
         ↓
출력: RecommendationItem[]
```

### 2.4 핵심 특징
| 특징 | 설명 |
|------|------|
| **모듈화** | 5개 Task 독립 테스트 가능 |
| **복원력** | Rate limit 시 DB fallback |
| **캐싱** | 웹 검색 결과 DB 저장/재활용 |
| **배치 처리** | GitHub Actions 자동 실행 (매일 새벽 3시) |

### 2.5 외부 연동
- **Gemini API**: Grounding 활성화 웹 검색
- **Supabase**: master_books, master_lectures 저장
- **webSearchContentService**: 캐시 조회/무효화

---

## 3. AI 플랜 생성 파이프라인

### 3.1 세 가지 파이프라인

| 파이프라인 | 파일 | 용도 |
|-----------|------|------|
| **배치 모드** | batchAIPlanGeneration.ts | 다중 학생 일괄 생성 |
| **하이브리드 완전** | generateHybridPlanComplete.ts | AI 전략 + 코드 스케줄러 |
| **Framework 생성** | generateHybridPlan.ts | AI 전략만 생성 |

### 3.2 배치 모드 흐름
```
[권한 확인] → [테넌트] → [3명씩 배치]
                           ↓
               학생별 처리:
               ├─ 데이터 로드
               ├─ ensurePlannerForStudent() ← 플래너 자동 생성
               ├─ LLM 호출 (fast 모델)
               ├─ contentId별 분할 ← 핵심 개선
               └─ 각 콘텐츠마다 Plan Group 생성
                  (is_single_content: true)
```

### 3.3 하이브리드 완전 모드 흐름
```
[Plan Group 검증] ← planner_id, is_single_content 확인
        ↓
[Phase 0] 가상 콘텐츠 영구 저장 (선택)
        ↓
[Phase 1] generateAIFrameworkAction()
        ↓
[Phase 2] Framework → SchedulerOptions 변환
        ↓
[Phase 3] generatePlansWithServices() ← 기존 스케줄러
```

### 3.4 Framework 생성 모드
```
[입력 검증] → [LLM 호출] → [파싱] → [변환] → [출력]
                                    ↓
                           AIFramework +
                           SchedulerOptions
                           (스케줄러 호출자 책임)
```

### 3.5 비교표

| 항목 | 배치 모드 | 하이브리드 완전 | Framework 생성 |
|------|---------|--------------|--------------|
| **입력 대상** | 다중 학생 | 단일 학생 | 단일 학생 |
| **Plan Group** | 내부 생성 | 사전 생성 필수 | 생성 없음 |
| **스케줄러** | LLM 기반 | 코드 기반 | 없음 |
| **콘텐츠 분할** | ✅ 자동 | ❌ | - |
| **플래너 연계** | ✅ 필수 | ⚠️ 검증만 | ❌ |
| **기본 모델** | fast | standard | standard |

---

## 4. 플래너/플랜관리 시스템

### 4.1 핵심 개념

```
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너) - "허브" 역할                                   │
│ - scheduler_options (스케줄러 조율)                              │
│ - 여러 Plan Group 관리                                          │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N (planner_id)
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Plan Group A    │  │ Plan Group B    │  │ Plan Group C    │
│ is_single_      │  │ is_single_      │  │ is_single_      │
│ content: true   │  │ content: true   │  │ content: true   │
│ content_type    │  │ content_type    │  │ content_type    │
│ content_id      │  │ content_id      │  │ content_id      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    student_plan        student_plan        student_plan
```

### 4.2 핵심 변경사항 (Phase 3 완료)

| 변경 전 | 변경 후 |
|--------|--------|
| Plan Group에 여러 콘텐츠 | Plan Group에 단일 콘텐츠 |
| planner_id 선택적 | planner_id 필수 지향 |
| 스케줄러 조율 Plan Group | 스케줄러 조율 Planner |

### 4.3 주요 필드

**plan_groups 테이블 확장:**
```sql
-- 플래너 연계
planner_id UUID REFERENCES planners(id)
creation_mode VARCHAR  -- 'manual', 'ai_batch', 'ai_hybrid'

-- 단일 콘텐츠 모드
is_single_content BOOLEAN DEFAULT true
content_type VARCHAR     -- 'book', 'lecture'
content_id UUID
master_content_id UUID
start_range INTEGER
end_range INTEGER
```

---

## 5. 시스템 간 연계

### 5.1 콜드스타트 → AI 플랜 생성

```
[콜드스타트]
runColdStartPipeline()
        ↓
RecommendationItem[]
        ↓
[통합 추천 API]
/api/plan/content-recommendation
        ↓
┌────────┴────────┐
│                 │
↓                 ↓
[빠른 플랜 생성]  [하이브리드]
quickCreate.ts    generateHybridPlanComplete.ts
                  (virtualContents로 전달)
```

### 5.2 AI 플랜 생성 → 플래너 시스템

**배치 모드:**
```typescript
// 1. 플래너 확보
const { plannerId } = await ensurePlannerForStudent(...);

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
// 검증만 수행
if (!planGroup.planner_id) {
  logActionWarn("플래너 미연결 Plan Group");
}
if (!planGroup.is_single_content) {
  logActionWarn("다중 콘텐츠 모드 - 레거시");
}
```

### 5.3 전체 데이터 흐름

```
┌──────────────────────────────────────────────────────────────────────┐
│                         사용자 요청                                   │
│                              ↓                                        │
│                    ┌─────────┴─────────┐                             │
│                    │                   │                              │
│                    ↓                   ↓                              │
│              신규 사용자          기존 사용자                          │
│                    │                   │                              │
│                    ▼                   ▼                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                  │
│  │    콜드스타트        │    │    AI 추천          │                  │
│  │  runColdStartPipeline│    │ recommendContent    │                  │
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
│  │  │  Planner (플래너)                                    │   │    │
│  │  │  - scheduler_options                                 │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │                         │ 1:N                               │    │
│  │           ┌─────────────┼─────────────┐                    │    │
│  │           ↓             ↓             ↓                    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │    │
│  │  │ Plan Group  │ │ Plan Group  │ │ Plan Group  │          │    │
│  │  │ (콘텐츠 A)  │ │ (콘텐츠 B)  │ │ (콘텐츠 C)  │          │    │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │    │
│  │         │               │               │                  │    │
│  │         ↓               ↓               ↓                  │    │
│  │      student_plan   student_plan   student_plan           │    │
│  │      (일자별 플랜)  (일자별 플랜)  (일자별 플랜)           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. 핵심 함수 연계

### 6.1 플래너 확보
```typescript
// lib/domains/admin-plan/actions/batchAIPlanGeneration.ts
async function ensurePlannerForStudent(
  supabase, tenantId, studentId, periodStart, periodEnd
): Promise<{ plannerId: string | null }>

// lib/domains/plan/actions/planners/autoCreate.ts
export async function getOrCreateDefaultPlannerAction(
  options: CreateDefaultPlannerOptions
): Promise<GetOrCreateDefaultPlannerResult>
```

### 6.2 Plan Group 생성
```typescript
// lib/domains/plan/transactions.ts
export async function createPlanGroupAtomic(
  groupData: AtomicPlanGroupInput,  // Phase 3 필드 포함
  contents: AtomicPlanContentInput[],
  exclusions: AtomicExclusionInput[],
  academySchedules: AtomicAcademyScheduleInput[],
  useAdmin?: boolean
): Promise<AtomicPlanGroupResult>
```

### 6.3 AI Framework 변환
```typescript
// lib/domains/plan/llm/transformers/frameworkToSchedulerOptions.ts
export function convertFrameworkToSchedulerOptions(
  framework: AIFramework,
  options: { contentMappings: ContentMapping[] }
): FrameworkConversionResult
```

### 6.4 스케줄러 연동
```typescript
// lib/plan/services/index.ts
export async function generatePlansWithServices(
  input: {
    groupId: string;
    context: PlanContext;
    aiSchedulerOptionsOverride?: AISchedulerOptionsOverride;
  }
): Promise<GeneratePlansResult>
```

---

## 7. Rate Limit 보호 전략

### 7.1 Gemini API 제한
- 일일: 20회
- 분당: 15회

### 7.2 보호 메커니즘

```
요청 → Gemini API
        ↓
   에러 발생?
     ├─ NO → 정상 응답
     └─ YES → 429/quota/rate limit?
              ├─ YES → DB Fallback 시도
              │         ├─ 성공 → 캐시 콘텐츠 반환
              │         └─ 실패 → 에러 반환
              └─ NO → 에러 반환

배치 처리:
- delayBetweenRequests: 5초 간격
- maxRetries: 1회 재시도
```

---

## 8. 성능 특성

### 8.1 처리 시간
| 파이프라인 | 학생당 시간 |
|-----------|-----------|
| 콜드스타트 | ~5초 |
| 배치 모드 | ~9초 |
| 하이브리드 완전 | ~12초 |
| Framework 생성 | ~8.5초 |

### 8.2 토큰 비용
| 파이프라인 | 토큰/학생 | 예상 비용 |
|-----------|---------|---------|
| 콜드스타트 | ~3000 | ~$0.003 |
| 배치 모드 | ~5000 | ~$0.005 |
| 하이브리드 완전 | ~3500 | ~$0.003 |

---

## 9. 사용 시나리오

### 9.1 신규 학생 온보딩
```
신규 학생 가입
      ↓
콜드스타트 → 즉시 콘텐츠 추천
      ↓
빠른 플랜 생성 또는 위자드
      ↓
플래너 + Plan Group 생성
      ↓
학습 시작
```

### 9.2 학원 관리자 배치 생성
```
관리자: 100명 학생 선택
      ↓
배치 모드 → 3명씩 동시 처리
      ↓
각 학생별 플래너 자동 생성
      ↓
콘텐츠별 Plan Group 분할 생성
      ↓
완료 (총 ~5분)
```

### 9.3 학생 개인 맞춤 계획
```
학생: 콘텐츠 선택 + Plan Group 생성
      ↓
하이브리드 완전 모드
      ↓
AI Framework + 기존 스케줄러
      ↓
AI 추천사항 표시
```

---

## 10. 주요 파일 참조

### 콜드스타트
- `lib/domains/plan/llm/actions/coldStart/pipeline.ts`
- `lib/domains/plan/llm/services/webSearchContentService.ts`

### AI 플랜 생성
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`
- `lib/domains/plan/llm/actions/generateHybridPlanComplete.ts`
- `lib/domains/plan/llm/actions/generateHybridPlan.ts`

### 플래너/플랜관리
- `lib/domains/plan/transactions.ts`
- `lib/domains/plan/actions/planners/autoCreate.ts`
- `lib/data/planGroups/unifiedContent.ts`

### 스케줄러
- `lib/plan/schedulerPlanner.ts`
- `lib/plan/adapters/legacyAdapter.ts`
- `lib/plan/services/index.ts`

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-20 | 초안 작성 - 4개 시스템 연계 분석 문서화 |
