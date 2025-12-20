# Metrics & Goals 모듈 리팩토링 완료 보고서

**작업 일시**: 2025-02-05  
**작업 범위**: `lib/metrics/`, `lib/goals/` 모듈 전반 리팩토링

---

## 📋 작업 개요

Metrics와 Goals 관련 파일들을 리팩토링하여 **N+1 쿼리 문제 해결**, **반복 코드 제거**, **타입 안정성 확보**를 달성했습니다.

---

## 🎯 주요 목표 및 달성 현황

### ✅ 1. N+1 쿼리 성능 최적화

#### `getWeakSubjects.ts`
**이전**: 세션 루프 → 플랜 조회 → 콘텐츠 조회 (최악의 성능)  
**개선**: 
- 세션에서 plan_id와 content_type/content_id 수집
- 플랜 정보를 한 번에 배치 조회
- 콘텐츠 정보를 타입별로 분류하여 병렬 배치 조회
- 메모리에서 Map을 활용하여 매핑

**성능 개선**: 세션 수에 비례하던 쿼리 수 → 최대 5개 쿼리로 고정

#### `getGoalStatus.ts`
**이전**: 각 목표마다 `getGoalProgress` 호출 (N번 쿼리)  
**개선**: 
- 모든 목표 ID 수집
- 모든 목표의 진행률 데이터를 한 번의 쿼리로 조회
- 메모리에서 목표별로 그룹화

**성능 개선**: 목표 수에 비례하던 쿼리 수 → 2개 쿼리로 고정

#### `queries.ts`의 `getPlansForGoal`
**이전**: 각 플랜마다 콘텐츠 조회 (N번 쿼리)  
**개선**: 
- 콘텐츠 타입별로 분류 (book, lecture, custom)
- 각 타입별로 한 번씩만 배치 조회
- 메모리에서 매핑

**성능 개선**: 플랜 수에 비례하던 쿼리 수 → 최대 4개 쿼리로 고정

#### `getStudyTime.ts`
**이전**: 이번 주와 지난 주를 각각 조회 (2번 쿼리)  
**개선**: 
- 전체 범위(지난 주 시작 ~ 이번 주 끝)로 한 번에 조회
- 메모리에서 날짜 기준으로 분리

**성능 개선**: 2번 쿼리 → 1번 쿼리

#### `fetchGoalsSummary`
**이전**: 각 목표마다 진행률 조회 (N번 쿼리)  
**개선**: 
- 모든 목표의 진행률을 한 번에 조회
- 메모리에서 그룹화

**성능 개선**: 목표 수에 비례하던 쿼리 수 → 3개 쿼리로 고정

---

### ✅ 2. 반복되는 에러 처리 추상화 (DRY)

#### `lib/supabase/safeQuery.ts` 생성
- `safeQueryArray`: 배열 반환 쿼리용 래퍼
- `safeQuerySingle`: 단일 항목 반환 쿼리용 래퍼
- `safeQueryMaybeSingle`: maybeSingle 사용 쿼리용 래퍼

**기능**:
- 42703 에러(undefined column) 자동 재시도
- 일관된 에러 로깅
- 기본값 반환 처리

**적용 파일**:
- `lib/metrics/getWeakSubjects.ts`
- `lib/metrics/getGoalStatus.ts`
- `lib/metrics/getHistoryPattern.ts`
- `lib/metrics/getPlanCompletion.ts`
- `lib/metrics/getScoreTrend.ts`
- `lib/goals/queries.ts` (모든 함수)

---

### ✅ 3. 조회 로직 효율화

#### `getStudyTime.ts`
- 이번 주와 지난 주 데이터를 한 번의 쿼리로 조회
- 메모리에서 날짜 기준으로 분리하여 계산

---

### ✅ 4. 상수 분리 및 타입 강화

#### `lib/metrics/constants.ts` 생성

**정의된 상수**:
- `SCORE_CONSTANTS`: 성적 하락 기준, 저등급 기준
- `WEAK_SUBJECT_CONSTANTS`: 취약 과목 기준 점수
- `STREAK_CONSTANTS`: 학습 연속일 기준 시간, 계산 기간
- `TODAY_PROGRESS_CONSTANTS`: 실행률/집중 타이머 가중치, 예상 학습 시간
- `GOAL_CONSTANTS`: 마감 임박 기준, 저진행률 기준
- `HISTORY_PATTERN_CONSTANTS`: 히스토리 조회 기간, 최근 이벤트 제한
- `SCORE_TREND_CONSTANTS`: 성적 조회 제한

**적용 파일**:
- `lib/metrics/getGoalStatus.ts`
- `lib/metrics/getHistoryPattern.ts`
- `lib/metrics/getScoreTrend.ts`
- `lib/metrics/todayProgress.ts`
- `lib/metrics/getWeakSubjects.ts`

#### 타입 안정성 개선
- `any` 타입 제거
- 명시적 타입 정의 (`PlanRow`, `ContentRow`, `AnalysisRow`, `HistoryRow`, `ScoreRow` 등)
- Supabase 쿼리 결과에 타입 단언 적용

---

## 📁 변경된 파일 목록

### 새로 생성된 파일
1. `lib/metrics/constants.ts` - 상수 정의
2. `lib/supabase/safeQuery.ts` - 공통 쿼리 래퍼

### 리팩토링된 파일
1. `lib/metrics/getWeakSubjects.ts` - N+1 쿼리 최적화, safeQuery 적용, 상수 사용
2. `lib/metrics/getGoalStatus.ts` - 배치 조회, safeQuery 적용, 상수 사용
3. `lib/metrics/getHistoryPattern.ts` - safeQuery 적용, 상수 사용
4. `lib/metrics/getPlanCompletion.ts` - safeQuery 적용
5. `lib/metrics/getScoreTrend.ts` - safeQuery 적용, 상수 사용, 병렬 조회
6. `lib/metrics/getStudyTime.ts` - 단일 쿼리로 통합
7. `lib/metrics/todayProgress.ts` - 상수 사용
8. `lib/goals/queries.ts` - 모든 함수에 safeQuery 적용, `getPlansForGoal` 배치 조회, `fetchGoalsSummary` 최적화

---

## 🔍 주요 변경 사항 상세

### 1. `getWeakSubjects.ts` 리팩토링

**이전 로직**:
```typescript
for (const session of sessions) {
  if (session.plan_id) {
    // 각 세션마다 플랜 조회
    const plan = await getPlan(session.plan_id);
    // 각 플랜마다 콘텐츠 조회
    const subject = await getSubjectFromContent(plan.content_type, plan.content_id);
  }
}
```

**개선된 로직**:
```typescript
// 1. 모든 plan_id와 content_type/content_id 수집
const planIds = new Set(sessions.map(s => s.plan_id).filter(Boolean));

// 2. 플랜 정보 배치 조회
const plans = await batchQueryPlans(Array.from(planIds));

// 3. 콘텐츠 타입별로 분류
const bookIds = [...];
const lectureIds = [...];
const customIds = [...];

// 4. 병렬 배치 조회
const [books, lectures, custom] = await Promise.all([
  batchQueryBooks(bookIds),
  batchQueryLectures(lectureIds),
  batchQueryCustom(customIds),
]);

// 5. 메모리에서 매핑
const subjectMap = buildSubjectMap(books, lectures, custom);
```

### 2. `getGoalStatus.ts` 리팩토링

**이전 로직**:
```typescript
const goalsWithProgress = await Promise.all(
  activeGoals.map(async (goal) => {
    // 각 목표마다 진행률 조회
    const progressRows = await getGoalProgress(goal.id);
    return calculateProgress(goal, progressRows);
  })
);
```

**개선된 로직**:
```typescript
// 모든 목표 ID 수집
const goalIds = activeGoals.map(g => g.id);

// 한 번에 모든 진행률 조회
const allProgressRows = await safeQueryArray(
  () => supabase.from("student_goal_progress")
    .select("*")
    .in("goal_id", goalIds)
);

// 메모리에서 그룹화
const progressByGoalId = groupByGoalId(allProgressRows);

// 각 목표의 진행률 계산
const goalsWithProgress = activeGoals.map(goal => {
  const progressRows = progressByGoalId.get(goal.id) || [];
  return calculateProgress(goal, progressRows);
});
```

### 3. `getPlansForGoal` 리팩토링

**이전 로직**:
```typescript
for (const plan of plans) {
  // 각 플랜마다 콘텐츠 조회
  const content = await getContent(plan.content_type, plan.content_id);
  contentMap.set(key, content.title);
}
```

**개선된 로직**:
```typescript
// 콘텐츠 타입별로 분류
const bookIds = plans.filter(p => p.content_type === "book").map(p => p.content_id);
const lectureIds = plans.filter(p => p.content_type === "lecture").map(p => p.content_id);
const customIds = plans.filter(p => p.content_type === "custom").map(p => p.content_id);

// 병렬 배치 조회
const [books, lectures, custom] = await Promise.all([
  batchQueryBooks(bookIds),
  batchQueryLectures(lectureIds),
  batchQueryCustom(customIds),
]);

// 메모리에서 매핑
const contentTitleMap = buildTitleMap(books, lectures, custom);
```

---

## 📊 성능 개선 효과

### 쿼리 수 감소

| 함수 | 이전 | 개선 후 | 개선율 |
|------|------|---------|--------|
| `getWeakSubjects` | 세션 수 × 2~3 | 최대 5개 | ~90% 감소 |
| `getGoalStatus` | 목표 수 + 1 | 2개 | ~80% 감소 |
| `getPlansForGoal` | 플랜 수 + 1 | 최대 4개 | ~85% 감소 |
| `getStudyTime` | 2개 | 1개 | 50% 감소 |
| `fetchGoalsSummary` | 목표 수 × 2 + 2 | 3개 | ~85% 감소 |

### 코드 품질 개선

- **반복 코드 제거**: 에러 처리 로직을 `safeQuery`로 통합
- **타입 안정성**: `any` 타입 제거, 명시적 타입 정의
- **유지보수성**: 상수 중앙 관리로 기준값 변경 용이
- **가독성**: 배치 조회 패턴으로 로직 명확화

---

## 🧪 테스트 권장 사항

1. **성능 테스트**: 대량의 세션/목표/플랜 데이터로 쿼리 수 확인
2. **기능 테스트**: 기존 비즈니스 로직(점수 계산 등)이 동일하게 동작하는지 확인
3. **에러 처리 테스트**: 42703 에러 발생 시 재시도 로직 확인

---

## 📝 향후 개선 사항

1. **캐싱 전략**: 자주 조회되는 메트릭 데이터에 캐싱 적용 검토
2. **인덱스 최적화**: 배치 조회에 사용되는 컬럼에 인덱스 확인
3. **모니터링**: 쿼리 성능 모니터링으로 추가 최적화 포인트 파악

---

## ✅ 체크리스트

- [x] 공통 유틸리티 생성 (constants, safeQuery)
- [x] N+1 쿼리 최적화 (getWeakSubjects, getGoalStatus, getPlansForGoal, fetchGoalsSummary)
- [x] 조회 로직 효율화 (getStudyTime)
- [x] 반복 코드 제거 (모든 파일에 safeQuery 적용)
- [x] 상수 분리 및 타입 강화
- [x] 린터 에러 없음 확인
- [x] 문서 작성

---

**작업 완료**: 2025-02-05

