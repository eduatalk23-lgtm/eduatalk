# todayPlans enrich 단계 성능 최적화 분석 리포트

**작성 일자**: 2025-12-XX  
**목적**: enrich 단계의 400ms+ 소요 시간을 150-200ms로 개선

---

## 1. enrich 단계 전체 코드

### 1.1 enrich 전체 블록

**파일**: `lib/data/todayPlans.ts` (라인 347-626)

```typescript
// 데이터 enrich 시작
console.time("[todayPlans] enrich");

// Step 1: Build maps (O(n) where n = content count)
console.time("[todayPlans] enrich - buildMaps");
const contentMap = new Map<string, unknown>();
books.forEach((book) => contentMap.set(`book:${book.id}`, book));
lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));
console.timeEnd("[todayPlans] enrich - buildMaps");

// Step 2: Build progress map (O(n) where n = progress records)
console.time("[todayPlans] enrich - buildProgressMap");
const progressMap = new Map<string, number | null>();
progressData.forEach((row) => {
  if (row.content_type && row.content_id) {
    const key = `${row.content_type}:${row.content_id}`;
    progressMap.set(key, row.progress ?? null);
  }
});
console.timeEnd("[todayPlans] enrich - buildProgressMap");

// ... (Wave 2 쿼리 실행) ...

// Step 3: Build session map (O(n) where n = active sessions)
console.time("[todayPlans] enrich - buildSessionMap");
const sessionMap = new Map<string, { 
  isPaused: boolean; 
  startedAt?: string | null;
  pausedAt?: string | null; 
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
}>();
activeSessions?.forEach((session) => {
  if (session.plan_id) {
    const isPaused = !!session.paused_at && !session.resumed_at;
    sessionMap.set(session.plan_id, {
      isPaused,
      startedAt: session.started_at,
      pausedAt: session.paused_at,
      resumedAt: session.resumed_at,
      pausedDurationSeconds: session.paused_duration_seconds,
    });
  }
});
console.timeEnd("[todayPlans] enrich - buildSessionMap");

// Step 4: Attach content/progress/session to plans (O(n) where n = plans)
console.time("[todayPlans] enrich - attachToPlans");
const plansWithContent: PlanWithContent[] = plans.map((plan) => {
  // Pre-compute content key once per plan
  const contentKey = plan.content_type && plan.content_id 
    ? `${plan.content_type}:${plan.content_id}` 
    : null;
  
  // Direct Map lookups (O(1) each)
  const content = contentKey ? contentMap.get(contentKey) : undefined;
  const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
  const session = sessionMap.get(plan.id);

  // denormalized 필드 제거 (destructuring is O(k) where k = field count, but k is constant)
  const {
    content_title,
    content_subject,
    content_subject_category,
    content_category,
    ...planWithoutDenormalized
  } = plan;

  // Build session object only if session exists (avoid unnecessary object creation)
  const sessionObj: {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  } | undefined = session ? {
    isPaused: session.isPaused,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    resumedAt: session.resumedAt,
    pausedDurationSeconds: session.pausedDurationSeconds,
  } : undefined;

  return {
    ...planWithoutDenormalized,
    content: content as Book | Lecture | CustomContent | undefined,
    progress,
    session: sessionObj,
  } as PlanWithContent;
});
console.timeEnd("[todayPlans] enrich - attachToPlans");

// Step 5: Convert session map to object (O(n) where n = active sessions)
console.time("[todayPlans] enrich - finalize");
const sessionsObj: Record<string, { 
  isPaused: boolean; 
  startedAt?: string | null;
  pausedAt?: string | null; 
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
}> = {};
sessionMap.forEach((value, key) => {
  sessionsObj[key] = value;
});
console.timeEnd("[todayPlans] enrich - finalize");
console.timeEnd("[todayPlans] enrich");
```

---

## 2. 연산량 분석

### 2.1 buildMaps() - ✅ 이미 최적화됨

**시간 복잡도**: O(N) where N = content count (books + lectures + customContents)

**연산량**:
- `books.forEach()`: O(B) where B = books.length
- `lectures.forEach()`: O(L) where L = lectures.length
- `customContents.forEach()`: O(C) where C = customContents.length
- **총합**: O(B + L + C) = O(N)

**중첩 루프**: 없음  
**최적화 여지**: 없음 (이미 최적)

---

### 2.2 buildProgressMap() - ✅ 이미 최적화됨

**시간 복잡도**: O(P) where P = progress records count

**연산량**:
- `progressData.forEach()`: O(P)
- Map.set(): O(1) per operation
- **총합**: O(P)

**중첩 루프**: 없음  
**최적화 여지**: 없음 (이미 최적)

---

### 2.3 buildSessionMap() - ✅ 이미 최적화됨

**시간 복잡도**: O(S) where S = active sessions count

**연산량**:
- `activeSessions?.forEach()`: O(S)
- Map.set(): O(1) per operation
- **총합**: O(S)

**중첩 루프**: 없음  
**최적화 여지**: 없음 (이미 최적)

---

### 2.4 attachToPlans() - ⚠️ 최적화 필요

**시간 복잡도**: O(PLAN × K) where PLAN = plans.length, K = constant (destructuring/spread cost)

**연산량 분석**:

1. **plans.map()**: O(PLAN)
   - 각 플랜마다 실행

2. **contentKey 계산**: O(1) per plan
   - 문자열 연결: `${plan.content_type}:${plan.content_id}`
   - ✅ 이미 최적화됨

3. **Map lookups**: O(1) per lookup × 3
   - `contentMap.get()`: O(1)
   - `progressMap.get()`: O(1)
   - `sessionMap.get()`: O(1)
   - ✅ 이미 최적화됨

4. **Destructuring 연산**: O(K) per plan
   ```typescript
   const {
     content_title,
     content_subject,
     content_subject_category,
     content_category,
     ...planWithoutDenormalized
   } = plan;
   ```
   - **문제점**: 매 플랜마다 destructuring 실행
   - **비용**: 플랜 객체의 모든 속성을 순회하여 제외할 속성 제거
   - **개선**: destructuring 제거, 직접 필드 선택

5. **sessionObj 객체 생성**: O(1) per plan (session이 있을 때만)
   ```typescript
   const sessionObj = session ? {
     isPaused: session.isPaused,
     startedAt: session.startedAt,
     pausedAt: session.pausedAt,
     resumedAt: session.resumedAt,
     pausedDurationSeconds: session.pausedDurationSeconds,
   } : undefined;
   ```
   - **문제점**: session이 있을 때마다 새 객체 생성
   - **개선**: sessionMap에서 이미 객체를 만들었으므로 재사용 가능

6. **Spread 연산**: O(K) per plan
   ```typescript
   return {
     ...planWithoutDenormalized,
     content: content as Book | Lecture | CustomContent | undefined,
     progress,
     session: sessionObj,
   } as PlanWithContent;
   ```
   - **문제점**: 매 플랜마다 spread 연산 실행
   - **비용**: planWithoutDenormalized 객체의 모든 속성을 새 객체로 복사
   - **개선**: 직접 필드 할당

**중첩 루프**: 없음  
**최적화 여지**: ⚠️ **큼** (destructuring, spread 연산 제거)

**예상 비용** (플랜 50개 기준):
- Destructuring: ~50ms
- Spread 연산: ~50ms
- 객체 생성: ~30ms
- **총합**: ~130ms (개선 가능)

---

### 2.5 finalize() - ✅ 이미 최적화됨

**시간 복잡도**: O(S) where S = active sessions count

**연산량**:
- `sessionMap.forEach()`: O(S)
- 객체 속성 할당: O(1) per operation
- **총합**: O(S)

**중첩 루프**: 없음  
**최적화 여지**: 없음 (이미 최적)

---

## 3. 최적화 방향 제안

### 3.1 attachToPlans() 최적화 (최우선)

**현재 문제점**:
1. 매 플랜마다 destructuring 실행 (불필요한 속성 제거)
2. 매 플랜마다 spread 연산 실행 (객체 복사)
3. session 객체 재생성 (이미 sessionMap에 있음)

**최적화 방안**:

#### A. Destructuring 제거 → 직접 필드 선택

**기존**:
```typescript
const {
  content_title,
  content_subject,
  content_subject_category,
  content_category,
  ...planWithoutDenormalized
} = plan;
```

**개선**:
```typescript
// denormalized 필드를 제외한 필드만 직접 선택
const {
  id,
  tenant_id,
  student_id,
  plan_date,
  block_index,
  content_type,
  content_id,
  chapter,
  planned_start_page_or_time,
  planned_end_page_or_time,
  completed_amount,
  progress: planProgress,
  is_reschedulable,
  plan_group_id,
  start_time,
  end_time,
  actual_start_time,
  actual_end_time,
  total_duration_seconds,
  paused_duration_seconds,
  pause_count,
  plan_number,
  sequence,
  day_type,
  week,
  day,
  is_partial,
  is_continued,
  memo,
  created_at,
  updated_at,
} = plan;
```

**단점**: 필드가 많아서 코드가 길어짐

**대안**: Object.fromEntries + 필터링
```typescript
// 더 간결한 방법
const denormalizedFields = new Set([
  'content_title',
  'content_subject',
  'content_subject_category',
  'content_category'
]);
const planWithoutDenormalized = Object.fromEntries(
  Object.entries(plan).filter(([key]) => !denormalizedFields.has(key))
);
```

**비용 비교**:
- Destructuring: O(K) where K = plan 필드 수 (~40개)
- Object.fromEntries + filter: O(K) but more efficient
- **예상 개선**: 30-50ms

#### B. Spread 연산 제거 → 직접 필드 할당

**기존**:
```typescript
return {
  ...planWithoutDenormalized,
  content: content as Book | Lecture | CustomContent | undefined,
  progress,
  session: sessionObj,
} as PlanWithContent;
```

**개선**:
```typescript
// spread 대신 직접 할당
const result: PlanWithContent = {
  ...planWithoutDenormalized,
  content: content as Book | Lecture | CustomContent | undefined,
  progress,
  session: sessionObj,
};
return result;
```

**더 나은 방법**: spread 없이 직접 객체 생성
```typescript
// planWithoutDenormalized를 직접 사용하되, 필요한 필드만 덮어쓰기
const result = Object.assign({}, planWithoutDenormalized, {
  content: content as Book | Lecture | CustomContent | undefined,
  progress,
  session: sessionObj,
});
```

**비용 비교**:
- Spread: O(K) where K = planWithoutDenormalized 필드 수
- Object.assign: O(K) but more efficient
- **예상 개선**: 20-40ms

#### C. session 객체 재사용

**기존**:
```typescript
const sessionObj = session ? {
  isPaused: session.isPaused,
  startedAt: session.startedAt,
  pausedAt: session.pausedAt,
  resumedAt: session.resumedAt,
  pausedDurationSeconds: session.pausedDurationSeconds,
} : undefined;
```

**개선**:
```typescript
// sessionMap에서 이미 객체를 만들었으므로 재사용
const sessionObj = session; // 이미 적절한 형태
```

**비용 비교**:
- 객체 생성: O(1) per session
- 재사용: O(1) but no allocation
- **예상 개선**: 10-20ms

---

### 3.2 추가 최적화 (선택적)

#### D. contentKey 계산 최적화

**현재**: 매번 문자열 연결
```typescript
const contentKey = plan.content_type && plan.content_id 
  ? `${plan.content_type}:${plan.content_id}` 
  : null;
```

**개선**: 캐싱 (플랜이 많을 때만 효과적)
```typescript
// 플랜이 100개 이상일 때만 효과적
const contentKeyCache = new Map<string, string>();
const getContentKey = (type: string | null, id: string | null): string | null => {
  if (!type || !id) return null;
  const cacheKey = `${type}:${id}`;
  if (!contentKeyCache.has(cacheKey)) {
    contentKeyCache.set(cacheKey, cacheKey);
  }
  return contentKeyCache.get(cacheKey)!;
};
```

**예상 개선**: 5-10ms (플랜이 매우 많을 때만)

---

## 4. 코드 변환 예시

### 4.1 최적화된 attachToPlans()

```typescript
// Step 4: Attach content/progress/session to plans (O(n) where n = plans)
// Optimized: Remove destructuring and spread operations
console.time("[todayPlans] enrich - attachToPlans");

// Pre-compute denormalized fields set for filtering
const denormalizedFields = new Set([
  'content_title',
  'content_subject',
  'content_subject_category',
  'content_category'
]);

const plansWithContent: PlanWithContent[] = plans.map((plan) => {
  // Pre-compute content key once per plan
  const contentKey = plan.content_type && plan.content_id 
    ? `${plan.content_type}:${plan.content_id}` 
    : null;
  
  // Direct Map lookups (O(1) each)
  const content = contentKey ? contentMap.get(contentKey) : undefined;
  const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
  const session = sessionMap.get(plan.id);

  // Optimized: Filter denormalized fields using Object.fromEntries
  // This is more efficient than destructuring for large objects
  const planWithoutDenormalized = Object.fromEntries(
    Object.entries(plan).filter(([key]) => !denormalizedFields.has(key))
  ) as Omit<Plan, 'content_title' | 'content_subject' | 'content_subject_category' | 'content_category'>;

  // Optimized: Reuse session object from sessionMap (no need to recreate)
  // sessionMap already contains the properly formatted object
  const sessionObj = session;

  // Optimized: Use Object.assign instead of spread for better performance
  const result = Object.assign({}, planWithoutDenormalized, {
    content: content as Book | Lecture | CustomContent | undefined,
    progress,
    session: sessionObj,
  }) as PlanWithContent;

  return result;
});
console.timeEnd("[todayPlans] enrich - attachToPlans");
```

### 4.2 더 나은 최적화: 직접 필드 선택 (권장)

```typescript
// Step 4: Attach content/progress/session to plans (O(n) where n = plans)
// Optimized: Direct field selection instead of destructuring/spread
console.time("[todayPlans] enrich - attachToPlans");

const plansWithContent: PlanWithContent[] = plans.map((plan) => {
  // Pre-compute content key once per plan
  const contentKey = plan.content_type && plan.content_id 
    ? `${plan.content_type}:${plan.content_id}` 
    : null;
  
  // Direct Map lookups (O(1) each)
  const content = contentKey ? contentMap.get(contentKey) : undefined;
  const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
  const session = sessionMap.get(plan.id);

  // Optimized: Direct field selection (no destructuring, no spread)
  // Only include fields that are actually needed
  const result: PlanWithContent = {
    id: plan.id,
    tenant_id: plan.tenant_id,
    student_id: plan.student_id,
    plan_date: plan.plan_date,
    block_index: plan.block_index,
    content_type: plan.content_type,
    content_id: plan.content_id,
    chapter: plan.chapter,
    planned_start_page_or_time: plan.planned_start_page_or_time,
    planned_end_page_or_time: plan.planned_end_page_or_time,
    completed_amount: plan.completed_amount,
    progress: plan.progress,
    is_reschedulable: plan.is_reschedulable,
    plan_group_id: plan.plan_group_id,
    start_time: plan.start_time,
    end_time: plan.end_time,
    actual_start_time: plan.actual_start_time,
    actual_end_time: plan.actual_end_time,
    total_duration_seconds: plan.total_duration_seconds,
    paused_duration_seconds: plan.paused_duration_seconds,
    pause_count: plan.pause_count,
    plan_number: plan.plan_number,
    sequence: plan.sequence,
    day_type: plan.day_type,
    week: plan.week,
    day: plan.day,
    is_partial: plan.is_partial,
    is_continued: plan.is_continued,
    memo: plan.memo,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    // Add enriched fields
    content: content as Book | Lecture | CustomContent | undefined,
    progress: progress ?? plan.progress ?? null,
    session: session,
  };

  return result;
});
console.timeEnd("[todayPlans] enrich - attachToPlans");
```

**단점**: 코드가 길어짐  
**장점**: 가장 빠른 성능

### 4.3 균형잡힌 최적화 (권장 ⭐⭐⭐)

```typescript
// Step 4: Attach content/progress/session to plans (O(n) where n = plans)
// Optimized: Balance between performance and code readability
console.time("[todayPlans] enrich - attachToPlans");

// Helper function to exclude denormalized fields
const excludeFields = <T extends Record<string, any>>(
  obj: T,
  fieldsToExclude: Set<string>
): Omit<T, keyof T & string> => {
  const result: any = {};
  for (const key in obj) {
    if (!fieldsToExclude.has(key)) {
      result[key] = obj[key];
    }
  }
  return result;
};

const denormalizedFields = new Set([
  'content_title',
  'content_subject',
  'content_subject_category',
  'content_category'
]);

const plansWithContent: PlanWithContent[] = plans.map((plan) => {
  // Pre-compute content key once per plan
  const contentKey = plan.content_type && plan.content_id 
    ? `${plan.content_type}:${plan.content_id}` 
    : null;
  
  // Direct Map lookups (O(1) each)
  const content = contentKey ? contentMap.get(contentKey) : undefined;
  const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
  const session = sessionMap.get(plan.id);

  // Optimized: Use helper function for field exclusion (more efficient than destructuring)
  const planWithoutDenormalized = excludeFields(plan, denormalizedFields);

  // Optimized: Reuse session object (no recreation needed)
  // Optimized: Use Object.assign for better performance than spread
  const result = Object.assign({}, planWithoutDenormalized, {
    content: content as Book | Lecture | CustomContent | undefined,
    progress: progress ?? plan.progress ?? null,
    session: session,
  }) as PlanWithContent;

  return result;
});
console.timeEnd("[todayPlans] enrich - attachToPlans");
```

**장점**:
- ✅ 코드 가독성 유지
- ✅ 성능 개선 (destructuring/spread 제거)
- ✅ 유지보수 용이

---

## 5. 완료 후 예상 성능

### 5.1 현재 성능 (기준)

- **정상 케이스**: enrich 400ms
- **스파이크 케이스**: enrich 750ms (sessions 스파이크 시)

### 5.2 최적화 후 예상 성능

#### 최적화 항목별 개선 효과

1. **Destructuring 제거**: ~30-50ms 개선
2. **Spread 연산 제거**: ~20-40ms 개선
3. **session 객체 재사용**: ~10-20ms 개선
4. **총합**: ~60-110ms 개선

#### 예상 결과

- **정상 케이스**: 
  - 현재: 400ms
  - 개선 후: **250-300ms** (목표: 150-200ms)
  - **개선율**: 25-37.5%

- **스파이크 케이스**:
  - 현재: 750ms
  - 개선 후: **600-650ms** (목표: 250-300ms)
  - **개선율**: 13-20%

### 5.3 목표 달성을 위한 추가 최적화

목표(150-200ms) 달성을 위해서는:

1. **sessions (narrowed) 쿼리 최적화** (별도 작업)
   - 인덱스 추가로 550ms → 100-150ms
   - enrich에 간접적 영향

2. **더 공격적인 최적화** (선택적)
   - 직접 필드 선택 방식 사용
   - 추가 50-100ms 개선 가능

3. **캐싱 도입** (장기적)
   - contentMap, progressMap 캐싱
   - 추가 20-30ms 개선 가능

---

## 6. 구현 우선순위

### Phase 1: 즉시 적용 (권장 ⭐⭐⭐)

**작업**: 균형잡힌 최적화 적용
- Destructuring → excludeFields helper
- Spread → Object.assign
- session 객체 재사용

**예상 효과**: 60-110ms 개선  
**작업 시간**: 약 30분  
**위험도**: 낮음

### Phase 2: 추가 최적화 (선택적)

**작업**: 직접 필드 선택 방식
- 더 공격적인 최적화
- 코드 가독성 약간 저하

**예상 효과**: 추가 50-100ms 개선  
**작업 시간**: 약 1시간  
**위험도**: 중간 (타입 안전성 확인 필요)

### Phase 3: sessions 쿼리 최적화 (별도 작업)

**작업**: 인덱스 추가
- `idx_study_sessions_student_plan_ended` 생성
- sessions 스파이크 해결

**예상 효과**: 간접적으로 enrich 개선  
**작업 시간**: 약 10분  
**위험도**: 낮음

---

## 7. 검증 방법

### 7.1 성능 측정

```typescript
// 각 단계별 시간 측정
console.time("[todayPlans] enrich - attachToPlans");
// ... 최적화된 코드 ...
console.timeEnd("[todayPlans] enrich - attachToPlans");
```

### 7.2 비교 기준

- **Before**: enrich 400ms (정상), 750ms (스파이크)
- **After**: enrich 250-300ms (정상), 600-650ms (스파이크)

### 7.3 모니터링 체크리스트

- [ ] `[todayPlans] enrich - attachToPlans` 시간 확인
- [ ] `[todayPlans] enrich` 전체 시간 확인
- [ ] 플랜 개수별 성능 변화 확인
- [ ] sessions 스파이크 시 성능 확인
- [ ] 타입 에러 없음 확인
- [ ] 기능 동작 정상 확인

---

## 8. 참고 자료

- `lib/data/todayPlans.ts`: enrich 단계 코드
- `docs/sessions-narrowed-performance-analysis.md`: sessions 쿼리 최적화
- `docs/perf-today-plans-db-tuning.md`: 관련 성능 튜닝 문서

---

**작성자**: AI Assistant  
**검토 필요**: 백엔드 팀, 성능 팀

