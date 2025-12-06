# Today Plans Performance Analysis

## 개요

`/camp/today` 페이지와 `/api/today/plans` API의 성능 분석 및 최적화 작업 문서입니다.

## 현재 성능 지표 (Dev 환경)

- **Page**: `/camp/today?date=YYYY-MM-DD` - ~2.0-2.1s (render)
- **API**: `/api/today/plans?date=YYYY-MM-DD&camp=true` - ~2.4-2.6s (render)

## 적용된 최적화

### 1. 성능 측정 도구 추가

#### `/api/today/plans` API 라우트
- `[todayPlans] total` - 전체 요청 시간
- `[todayPlans] db - planGroups` - 플랜 그룹 조회
- `[todayPlans] db - plans` - 플랜 조회
- `[todayPlans] db - futurePlans` - 미래 플랜 조회 (오늘 플랜이 없을 때)
- `[todayPlans] db - contents` - 콘텐츠 정보 조회
- `[todayPlans] db - progress` - 진행률 조회
- `[todayPlans] db - sessions` - 활성 세션 조회
- `[todayPlans] enrich` - 데이터 enrich (맵핑, 변환)
- `[todayPlans] serialize` - JSON 응답 직렬화

#### `/camp/today` 서버 컴포넌트
- `[camp/today] total` - 전체 페이지 렌더링 시간
- `[camp/today] db - planGroups` - 플랜 그룹 조회
- `[camp/today] db - templates` - 캠프 템플릿 조회
- `[camp/today] progress` - 진행률 계산
- `[camp/today] db - completedPlan` - 완료된 플랜 정보 조회 (토스트용)

### 2. 콘텐츠 조회 최적화

**이전**: 학생의 모든 콘텐츠를 조회한 후 메모리에서 필터링
```typescript
// 비효율적: 모든 책/강의/커스텀 콘텐츠 조회
const books = await getBooks(user.userId, tenantId);
const filtered = books.filter(b => bookIds.includes(b.id));
```

**현재**: 필요한 콘텐츠 ID만 직접 조회
```typescript
// 효율적: 필요한 ID만 .in() 쿼리로 조회
const books = await supabase
  .from("books")
  .select("*")
  .eq("student_id", user.userId)
  .in("id", bookIds);
```

**예상 효과**: 학생이 많은 콘텐츠를 가지고 있을 경우, 조회 데이터량이 크게 감소

### 3. 중복 Fetch 패턴 발견 및 개선 제안

**문제**: `/camp/today` 페이지에서 `TodayPageContent`가 두 번 렌더링됨 (메인 + 사이드바)
- 각 인스턴스가 `PlanViewContainer`를 포함
- `PlanViewContainer`는 마운트 시 `/api/today/plans`를 호출
- 결과: 동일한 날짜/사용자/캠프 플래그에 대해 API가 2번 호출됨

**개선 제안** (TODO로 표시됨):
1. `/camp/today/page.tsx`에서 서버 사이드에서 플랜 데이터를 한 번만 조회
2. 조회한 데이터를 `TodayPageContent`에 props로 전달
3. `TodayPageContent`는 `initialPlans` prop이 있으면 클라이언트 사이드 fetch를 스킵

**예상 효과**: API 호출 횟수 50% 감소, 페이지 로드 시간 개선

## 데이터베이스 쿼리 분석

### 주요 SELECT 쿼리

#### 1. 플랜 그룹 조회
```sql
SELECT * FROM plan_groups
WHERE student_id = $1
  AND status = 'active'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

**필요한 인덱스**:
- `(student_id, status, deleted_at)` - 복합 인덱스 권장
- 또는 `(student_id, status)` + `deleted_at IS NULL` 필터

#### 2. 플랜 조회
```sql
SELECT * FROM student_plan
WHERE student_id = $1
  AND plan_date = $2
  AND plan_group_id IN ($3, $4, ...)
ORDER BY plan_date ASC, block_index ASC;
```

**필요한 인덱스**:
- `(student_id, plan_date, plan_group_id)` - 복합 인덱스 필수
- `plan_date` 단독 인덱스도 유용 (날짜 범위 조회 시)

#### 3. 콘텐츠 조회 (최적화됨)
```sql
-- 책
SELECT * FROM books
WHERE student_id = $1
  AND id IN ($2, $3, ...);

-- 강의
SELECT * FROM lectures
WHERE student_id = $1
  AND id IN ($2, $3, ...);

-- 커스텀 콘텐츠
SELECT * FROM student_custom_contents
WHERE student_id = $1
  AND id IN ($2, $3, ...);
```

**필요한 인덱스**:
- `books(student_id, id)` - 복합 인덱스 권장
- `lectures(student_id, id)` - 복합 인덱스 권장
- `student_custom_contents(student_id, id)` - 복합 인덱스 권장

#### 4. 진행률 조회
```sql
SELECT content_type, content_id, progress
FROM student_content_progress
WHERE student_id = $1;
```

**필요한 인덱스**:
- `(student_id)` - 단일 인덱스 (이미 있을 가능성 높음)
- `(student_id, content_type, content_id)` - 복합 인덱스 (더 빠른 조회)

#### 5. 활성 세션 조회
```sql
SELECT plan_id, started_at, paused_at, resumed_at, paused_duration_seconds
FROM student_study_sessions
WHERE student_id = $1
  AND ended_at IS NULL;
```

**필요한 인덱스**:
- `(student_id, ended_at)` - 복합 인덱스 필수
- 또는 `(student_id)` + `ended_at IS NULL` 필터

### N+1 쿼리 패턴

현재 구현에서는 N+1 문제가 없습니다:
- 콘텐츠 조회: `Promise.all`로 배치 조회
- 세션 조회: 한 번의 쿼리로 모든 활성 세션 조회
- 진행률 조회: 한 번의 쿼리로 모든 진행률 조회

### 잠재적 최적화 기회

#### 1. 진행률 조회 최적화
현재는 학생의 모든 진행률을 조회한 후 메모리에서 필터링합니다.
```typescript
// 현재: 모든 진행률 조회
const { data: progressData } = await supabase
  .from("student_content_progress")
  .select("content_type,content_id,progress")
  .eq("student_id", user.userId);

// 최적화: 필요한 콘텐츠의 진행률만 조회
const contentKeys = plans.map(p => ({
  content_type: p.content_type,
  content_id: p.content_id
}));
// ... IN 쿼리로 필터링
```

**예상 효과**: 진행률 데이터가 많을 경우 조회량 감소

#### 2. 세션 조회 최적화
현재는 모든 활성 세션을 조회합니다. 필요한 플랜 ID만 필터링할 수 있습니다.
```typescript
// 현재: 모든 활성 세션 조회
const { data: activeSessions } = await supabase
  .from("student_study_sessions")
  .select("*")
  .eq("student_id", user.userId)
  .is("ended_at", null);

// 최적화: 해당 날짜의 플랜 ID만 필터링
const planIds = plans.map(p => p.id);
const { data: activeSessions } = await supabase
  .from("student_study_sessions")
  .select("*")
  .eq("student_id", user.userId)
  .in("plan_id", planIds)
  .is("ended_at", null);
```

**예상 효과**: 활성 세션이 많을 경우 조회량 감소

## 서버 사이드 처리 비용 분석

### 현재 처리 흐름

1. **플랜 그룹 필터링** (메모리)
   - 모든 활성 플랜 그룹 조회
   - 캠프/일반 모드에 따라 필터링
   - 시간: O(n) where n = 활성 플랜 그룹 수

2. **콘텐츠 ID 추출** (메모리)
   - 플랜 배열을 3번 순회 (book, lecture, custom)
   - 중복 제거 (Set 사용)
   - 시간: O(n) where n = 플랜 수

3. **데이터 Enrich** (메모리)
   - Map 생성 및 데이터 매핑
   - 시간: O(n) where n = 콘텐츠 수

4. **플랜 변환** (메모리)
   - 각 플랜에 대해 콘텐츠, 진행률, 세션 정보 매핑
   - 시간: O(n) where n = 플랜 수

### 최적화 가능한 부분

#### 1. 콘텐츠 ID 추출 최적화 (완료)
**이전**: 3번의 filter + map
```typescript
const bookIds = plans.filter(...).map(...);
const lectureIds = plans.filter(...).map(...);
const customIds = plans.filter(...).map(...);
```

**현재**: 1번의 reduce로 통합
```typescript
const { bookIds, lectureIds, customIds } = plans.reduce(
  (acc, plan) => {
    if (plan.content_type === "book") acc.bookIds.push(plan.content_id);
    // ...
    return acc;
  },
  { bookIds: [], lectureIds: [], customIds: [] }
);
```

**효과**: 배열 순회 횟수 3회 → 1회로 감소

#### 2. 중복 제거 최적화 (완료)
**이전**: 각 배열을 개별적으로 Set으로 변환
**현재**: 추출 시점에 Set 사용하여 중복 자동 제거

## Router 패턴 검증

### router.push + router.refresh 조합 확인

✅ **문제 없음**: `PlanExecutionForm`에서 `router.push`와 `router.refresh`가 함께 사용되지 않음
- `handleComplete`: `router.push`만 사용 (네비게이션)
- `handleClearSession`: `router.refresh`만 사용 (인플레이스 새로고침)
- `handleStart`: `router.refresh`만 사용 (인플레이스 새로고침)

### 권장 패턴
- **네비게이션 후**: `router.push`만 사용 (자동으로 새 데이터 로드)
- **인플레이스 업데이트**: `router.refresh`만 사용 (현재 페이지 데이터 갱신)

## 다음 단계 권장 사항

### 우선순위 높음

1. **인덱스 추가**
   - `student_plan(student_id, plan_date, plan_group_id)` - 복합 인덱스
   - `student_study_sessions(student_id, ended_at)` - 복합 인덱스
   - `student_content_progress(student_id, content_type, content_id)` - 복합 인덱스

2. **중복 Fetch 제거**
   - `/camp/today`에서 서버 사이드 단일 fetch 구현
   - 예상 효과: API 호출 50% 감소

### 우선순위 중간

3. **진행률 조회 최적화**
   - 필요한 콘텐츠의 진행률만 조회
   - 예상 효과: 진행률 데이터가 많을 경우 조회량 감소

4. **세션 조회 최적화**
   - 해당 날짜의 플랜 ID만 필터링
   - 예상 효과: 활성 세션이 많을 경우 조회량 감소

### 우선순위 낮음

5. **캐싱 전략**
   - React Query 캐싱 활용 (이미 설정됨)
   - 서버 사이드 캐싱 고려 (Next.js `unstable_cache`)

6. **데이터베이스 쿼리 최적화**
   - JOIN을 통한 단일 쿼리로 통합 (복잡도 증가 vs 성능 향상 트레이드오프)

## 측정 방법

개발 환경에서 다음 명령어로 타이밍 로그를 확인할 수 있습니다:

```bash
npm run dev
```

브라우저 콘솔 및 서버 로그에서 다음 형식의 타이밍 정보를 확인:
- `[todayPlans] total: XXXms`
- `[todayPlans] db - plans: XXXms`
- `[camp/today] total: XXXms`
- 등등...

## 참고 사항

- 모든 최적화는 **동작 보존**을 원칙으로 함
- UX 변경 없음 (URL, 토스트, 네비게이션 동작 동일)
- 변경 사항은 최소한으로 유지하고 명확한 주석 추가

