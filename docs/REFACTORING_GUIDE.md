# Metrics & Goals 모듈 리팩토링 가이드

**작성일**: 2025-02-05  
**버전**: 1.0

---

## 📋 개요

이 문서는 `lib/metrics/`와 `lib/goals/` 모듈의 리팩토링 과정에서 도입된 핵심 기술과 패턴을 정리한 가이드입니다.

---

## 🚀 성능 최적화 패턴

### Batch Query + In-Memory Mapping

N+1 쿼리 문제를 해결하기 위해 도입한 패턴입니다.

#### 문제 상황

리팩토링 전에는 다음과 같은 N+1 쿼리 문제가 있었습니다:

```typescript
// ❌ 나쁜 예: N+1 쿼리
for (const session of sessions) {
  const plan = await supabase
    .from("student_plan")
    .select("*")
    .eq("id", session.plan_id)
    .single();

  const content = await supabase
    .from("books")
    .select("*")
    .eq("id", plan.content_id)
    .single();
}
```

#### 해결 방법

**1단계: ID 수집**

```typescript
// 모든 필요한 ID를 먼저 수집
const planIds = new Set<string>();
const contentKeys = new Map<
  string,
  { contentType: string; contentId: string }
>();

sessions.forEach((session) => {
  if (session.plan_id) {
    planIds.add(session.plan_id);
  }
});
```

**2단계: 배치 조회**

```typescript
// 모든 플랜을 한 번에 조회
const plans = await safeQueryArray<PlanRow>(
  () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .eq("student_id", studentId)
      .in("id", Array.from(planIds)),
  undefined,
  { context: "[metrics/getWeakSubjects] 플랜 조회" }
);
```

**3단계: In-Memory Mapping**

```typescript
// 메모리에서 Map으로 변환하여 빠른 조회
const planMap = new Map<string, { contentType: string; contentId: string }>();
plans.forEach((plan) => {
  if (plan.content_type && plan.content_id) {
    planMap.set(plan.id, {
      contentType: plan.content_type,
      contentId: plan.content_id,
    });
  }
});

// 이후 O(1) 조회
const planContent = planMap.get(session.plan_id);
```

**4단계: 병렬 조회 (Promise.all)**

```typescript
// 콘텐츠 타입별로 분류
const bookIds: string[] = [];
const lectureIds: string[] = [];
const customIds: string[] = [];

// 타입별로 분류 후 병렬 조회
const [booksResult, lecturesResult, customResult] = await Promise.all([
  bookIds.length > 0
    ? safeQueryArray<ContentRow>(...)
    : Promise.resolve([]),
  lectureIds.length > 0
    ? safeQueryArray<ContentRow>(...)
    : Promise.resolve([]),
  customIds.length > 0
    ? safeQueryArray<ContentRow>(...)
    : Promise.resolve([]),
]);
```

#### 적용 예시

**`lib/metrics/getWeakSubjects.ts`**:

```typescript
// 1. plan_id와 content_type/content_id 수집
const planIds = new Set<string>();
const directContentKeys = new Set<string>();

sessions.forEach((session) => {
  if (session.plan_id) {
    planIds.add(session.plan_id);
  } else if (session.content_type && session.content_id) {
    directContentKeys.add(`${session.content_type}:${session.content_id}`);
  }
});

// 2. 플랜 정보 배치 조회
const planMap = new Map<string, { contentType: string; contentId: string }>();
if (planIds.size > 0) {
  const plans = await safeQueryArray<PlanRow>(...);
  plans.forEach((plan) => {
    planMap.set(plan.id, { contentType: plan.content_type, contentId: plan.content_id });
  });
}

// 3. 콘텐츠 정보 병렬 조회
const [booksResult, lecturesResult, customResult] = await Promise.all([...]);

// 4. In-Memory Mapping
const contentSubjectMap = new Map<string, string | null>();
booksResult.forEach((book) => {
  contentSubjectMap.set(`book:${book.id}`, book.subject);
});
```

**`lib/metrics/getGoalStatus.ts`**:

```typescript
// 모든 목표 ID 수집
const goalIds = activeGoals.map((goal) => goal.id);

// 모든 목표의 진행률 데이터를 한 번에 조회
const allProgressRows = await safeQueryArray<GoalProgress>(...);

// 목표별로 진행률 데이터 그룹화
const progressByGoalId = new Map<string, GoalProgress[]>();
allProgressRows.forEach((progress) => {
  const existing = progressByGoalId.get(progress.goal_id) || [];
  existing.push(progress);
  progressByGoalId.set(progress.goal_id, existing);
});
```

#### 성능 개선 효과

- **쿼리 횟수**: O(N) → O(1) 또는 O(콘텐츠 타입 수)
- **응답 시간**: 수백 ms → 수십 ms
- **데이터베이스 부하**: 대폭 감소

---

## 🛡 안정성 패턴

### safeQuery 유틸리티

Supabase 쿼리의 안정성을 보장하기 위한 래퍼 유틸리티입니다.

#### 목적

1. **42703 에러 자동 처리**: 컬럼이 존재하지 않을 때 발생하는 에러를 자동으로 재시도
2. **일관된 에러 처리**: 모든 쿼리에서 동일한 에러 처리 로직 적용
3. **컨텍스트 기반 로깅**: 에러 발생 시 어디서 발생했는지 추적 가능

#### 사용법

**`safeQueryArray`** (배열 반환):

```typescript
import { safeQueryArray } from "@/lib/supabase/safeQuery";

const plans = await safeQueryArray<PlanRow>(
  // 메인 쿼리 함수 (student_id 필터 포함)
  () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .eq("student_id", studentId)
      .in("id", Array.from(planIds)),
  // 42703 에러 발생 시 실행할 대체 쿼리 함수 (student_id 필터 제거)
  () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .in("id", Array.from(planIds)),
  // 옵션
  { context: "[metrics/getWeakSubjects] 플랜 조회" }
);
```

**`safeQuerySingle`** (단일 항목 반환):

```typescript
const plan = await safeQuerySingle<PlanRow>(
  () => supabase.from("student_plan").select("*").eq("id", planId).single(),
  undefined,
  { context: "[metrics/getPlan] 플랜 조회" }
);
```

#### Context 옵션의 역할

`context` 옵션은 에러 로깅 시 어디서 발생했는지 추적하기 위해 사용됩니다:

```typescript
{
  context: "[metrics/getWeakSubjects] 플랜 조회";
}
```

에러 발생 시 다음과 같이 로깅됩니다:

```
[metrics/getWeakSubjects] 플랜 조회 쿼리 실패 {
  code: '42703',
  message: 'column "student_id" does not exist',
  ...
}
```

#### 에러 처리 흐름

1. **메인 쿼리 실행**: `queryFn()` 실행
2. **42703 에러 감지**: 컬럼이 존재하지 않을 때 발생
3. **대체 쿼리 실행**: `fallbackQueryFn()` 실행 (제공된 경우)
4. **에러 로깅**: `context`를 포함한 상세 에러 로그
5. **기본값 반환**: 에러 발생 시 `defaultValue` 반환

#### 적용 예시

**`lib/metrics/getWeakSubjects.ts`**:

```typescript
const plans = await safeQueryArray<PlanRow>(
  () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .eq("student_id", studentId)
      .in("id", Array.from(planIds)),
  () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .in("id", Array.from(planIds)),
  { context: "[metrics/getWeakSubjects] 플랜 조회" }
);
```

**`lib/metrics/getGoalStatus.ts`**:

```typescript
const allProgressRows = await safeQueryArray<GoalProgress>(
  () =>
    supabase
      .from("student_goal_progress")
      .select("*")
      .eq("student_id", studentId)
      .in("goal_id", goalIds)
      .order("recorded_at", { ascending: false }),
  () =>
    supabase
      .from("student_goal_progress")
      .select("*")
      .in("goal_id", goalIds)
      .order("recorded_at", { ascending: false }),
  { context: "[metrics/getGoalStatus] 진행률 조회" }
);
```

---

## 🧪 테스트 전략

### 1. `__mocks__` 디렉토리를 활용한 의존성 격리

의존성 모듈을 격리하여 테스트의 독립성을 보장합니다.

#### 구조

```
__mocks__/
├── lib/
│   ├── data/
│   │   ├── studentPlans.ts
│   │   ├── studentSessions.ts
│   │   └── planGroups.ts
│   ├── metrics/
│   │   └── studyTime.ts
│   └── utils/
│       ├── planUtils.ts
│       └── dateUtils.ts
```

#### 사용법

**1단계: Mock 파일 생성**

```typescript
// __mocks__/lib/data/studentPlans.ts
import { vi } from "vitest";

export const getPlansForStudent = vi.fn();
export const getPlanById = vi.fn();
export const createPlan = vi.fn();
```

**2단계: 테스트 파일에서 Mock 선언**

```typescript
// __tests__/lib/metrics/todayProgress.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies - import 전에 선언
vi.mock("@/lib/data/studentPlans");
vi.mock("@/lib/data/studentSessions");
vi.mock("@/lib/utils/planUtils");

// 이제 import 가능
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import { filterLearningPlans } from "@/lib/utils/planUtils";

// Mock 함수 참조
const mockGetPlansForStudent = vi.mocked(getPlansForStudent);
const mockFilterLearningPlans = vi.mocked(filterLearningPlans);
```

**3단계: beforeEach에서 초기화**

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  // 기본 Mock Return Value 설정
  mockGetPlansForStudent.mockResolvedValue([]);
  mockFilterLearningPlans.mockImplementation((plans: any[]) => {
    if (!Array.isArray(plans)) return [];
    return plans.filter((plan) => {
      if (!plan) return false;
      const contentId = plan.content_id;
      if (!contentId) return true;
      return !contentId.startsWith("dummy");
    });
  });
});
```

#### 장점

- **의존성 격리**: 실제 모듈을 로드하지 않아 테스트 속도 향상
- **에러 방지**: esbuild 파싱 오류 방지
- **독립성**: 각 테스트가 독립적으로 실행 가능

#### 적용 예시

**`__mocks__/lib/utils/planUtils.ts`**:

```typescript
import { vi } from "vitest";

export const isCompletedPlan = vi.fn((plan: any) => {
  return !!plan?.actual_end_time;
});

export const filterLearningPlans = vi
  .fn()
  .mockImplementation((plans: any[]) => {
    if (!Array.isArray(plans)) return [];
    return plans.filter((plan) => {
      if (!plan) return false;
      const contentId = plan.content_id;
      if (!contentId) return true;
      return !contentId.startsWith("dummy");
    });
  });
```

---

### 2. Context 기반 모킹 (Context-based Mocking)

`Promise.all`의 병렬 실행과 조건부 쿼리 실행으로 인한 모킹 순서 불일치 문제를 해결하기 위한 전략입니다.

#### 문제 상황

**순서 의존적 모킹** (`mockResolvedValueOnce`):

```typescript
// ❌ 나쁜 예: 순서에 의존
vi.mocked(safeQueryArray)
  .mockResolvedValueOnce(mockPlans) // 1번째 호출
  .mockResolvedValueOnce(mockBooks) // 2번째 호출
  .mockResolvedValueOnce(mockLectures) // 3번째 호출
  .mockResolvedValueOnce([]) // 4번째 호출
  .mockResolvedValueOnce([]); // 5번째 호출
```

**문제점**:

- `Promise.all`의 병렬 실행 시 순서가 보장되지 않음
- 조건부 쿼리 실행 시 호출 순서가 달라짐
- 테스트 유지보수가 어려움

#### 해결 방법

**Context 기반 모킹** (`mockImplementation`):

```typescript
// ✅ 좋은 예: Context 기반
let mockPlansData: any[] = [];
let mockBooksData: any[] = [];
let mockLecturesData: any[] = [];
let mockCustomData: any[] = [];
let mockAnalysisData: any[] = [];

beforeEach(() => {
  // Context 기반 모킹 구현
  (safeQueryArray as Mock).mockImplementation(
    async (queryFn: any, fallbackFn: any, options?: { context?: string }) => {
      const context = options?.context || "";

      if (context.includes("플랜 조회")) return mockPlansData;
      if (context.includes("책 조회")) return mockBooksData;
      if (context.includes("강의 조회")) return mockLecturesData;
      if (context.includes("커스텀 콘텐츠 조회")) return mockCustomData;
      if (context.includes("분석 조회")) return mockAnalysisData;

      return []; // 기본값
    }
  );
});

// 각 테스트에서 데이터 설정
it("플랜 ID를 통해 콘텐츠 정보를 올바르게 매핑해야 함", async () => {
  // Context 기반 모킹: 각 데이터를 변수에 할당
  mockPlansData = mockPlans;
  mockBooksData = mockBooks;
  mockLecturesData = mockLectures;
  mockCustomData = [];
  mockAnalysisData = [];

  // 테스트 실행...
});
```

#### 장점

- **순서 독립성**: 호출 순서와 무관하게 동작
- **조건부 쿼리 지원**: `planIds.size === 0`일 때도 올바르게 동작
- **가독성 향상**: 각 테스트에서 필요한 데이터를 명확하게 설정
- **유지보수성**: Context 문자열만 확인하면 모킹 로직 이해 가능

#### 적용 예시

**`__tests__/lib/metrics/getWeakSubjects.test.ts`**:

```typescript
describe("getWeakSubjects", () => {
  // Context 기반 모킹을 위한 데이터 저장소
  let mockPlansData: any[] = [];
  let mockBooksData: any[] = [];
  let mockLecturesData: any[] = [];
  let mockCustomData: any[] = [];
  let mockAnalysisData: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    // 기본값 초기화
    mockPlansData = [];
    mockBooksData = [];
    mockLecturesData = [];
    mockCustomData = [];
    mockAnalysisData = [];

    // Context 기반 모킹 구현
    (safeQueryArray as Mock).mockImplementation(
      async (queryFn: any, fallbackFn: any, options?: { context?: string }) => {
        const context = options?.context || "";

        if (context.includes("플랜 조회")) return mockPlansData;
        if (context.includes("책 조회")) return mockBooksData;
        if (context.includes("강의 조회")) return mockLecturesData;
        if (context.includes("커스텀 콘텐츠 조회")) return mockCustomData;
        if (context.includes("분석 조회")) return mockAnalysisData;

        return []; // 기본값
      }
    );
  });

  it("플랜 ID를 통해 콘텐츠 정보를 올바르게 매핑해야 함", async () => {
    const mockPlans = [
      { id: "plan-1", content_type: "book", content_id: "book-1" },
      { id: "plan-2", content_type: "lecture", content_id: "lecture-1" },
    ];
    const mockBooks = [{ id: "book-1", subject: "수학" }];
    const mockLectures = [{ id: "lecture-1", subject: "영어" }];

    // Context 기반 모킹: 각 데이터를 변수에 할당
    mockPlansData = mockPlans;
    mockBooksData = mockBooks;
    mockLecturesData = mockLectures;
    mockCustomData = [];
    mockAnalysisData = [];

    const result = await getWeakSubjects(...);
    // 검증...
  });
});
```

---

## 📝 모범 사례

### 1. 날짜 계산 일관성

모든 날짜 비교에서 `setHours(0, 0, 0, 0)`를 적용하여 일관성을 보장합니다:

```typescript
// ✅ 좋은 예
const today = new Date(todayDate);
today.setHours(0, 0, 0, 0);

const endDate = new Date(goal.end_date);
endDate.setHours(0, 0, 0, 0);

const daysRemaining = Math.ceil(
  (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
);
```

### 2. 에러 로깅

모든 에러는 `context`를 포함하여 로깅합니다:

```typescript
try {
  // ...
} catch (error) {
  console.error("[metrics/getWeakSubjects] 취약 과목 조회 실패", error);
  return {
    weakSubjects: [],
    subjectStudyTime: new Map(),
    totalStudyTime: 0,
    weakSubjectStudyTimeRatio: 0,
  };
}
```

### 3. 타입 안전성

모든 쿼리 결과에 명시적 타입을 지정합니다:

```typescript
type PlanRow = {
  id: string;
  content_type: string | null;
  content_id: string | null;
};

const plans = await safeQueryArray<PlanRow>(...);
```

---

## 🔍 참고 자료

- **성능 최적화**: `lib/metrics/getWeakSubjects.ts`, `lib/metrics/getGoalStatus.ts`
- **안정성 패턴**: `lib/supabase/safeQuery.ts`
- **테스트 전략**: `__tests__/lib/metrics/getWeakSubjects.test.ts`, `__tests__/lib/metrics/todayProgress.test.ts`

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-02-05


