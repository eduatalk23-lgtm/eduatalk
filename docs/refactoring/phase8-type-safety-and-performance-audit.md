# Phase 8: 최종 안정화 및 성능 최적화 - 타입 안전성 및 성능 감사 리포트

**작성일**: 2025-01-15  
**작성자**: AI Assistant  
**상태**: 🔄 진행 중

---

## 📋 개요

Phase 1~7의 대규모 리팩토링 완료 후, 타입 안전성 전수 조사와 성능 최적화 포인트를 식별하기 위한 감사를 수행했습니다.

---

## 🔍 1. 타입 안전성 전수 조사

### 1.1 `any` 타입 사용 현황

**검색 범위**: `lib/data/`, `lib/hooks/`, `app/actions/`

#### ✅ `lib/hooks/` - 타입 안전성 양호

- **결과**: `any` 타입 사용 없음
- 모든 훅이 `useTypedQuery`를 사용하여 타입 안전성 보장

#### ✅ `app/actions/` - 타입 안전성 양호

- **결과**: `any` 타입 사용 없음

#### ⚠️ `lib/data/` - 개선 필요

**총 31개 파일에서 `any` 타입 사용 발견**

| 파일 경로 | `any` 사용 위치 | 사용 이유 | 개선 우선순위 |
|-----------|----------------|-----------|--------------|
| `lib/data/planGroups.ts` | 211, 501, 507-510, 515, 1462, 1547, 2139 | JSONB 필드, fallback 결과 변환 | 🔴 높음 |
| `lib/data/studentContents.ts` | 409, 460, 512 | `Record<string, any>` (업데이트 payload) | 🟡 중간 |
| `lib/data/schools.ts` | 377, 389, 802, 823 | 배열 변환, 타입 단언 | 🟡 중간 |
| `lib/data/contentMasters.ts` | 536, 593, 1598, 1744 | 반환 타입, 업데이트 payload | 🟡 중간 |
| `lib/data/contentQueryBuilder.ts` | 120 | 로깅용 샘플 데이터 | 🟢 낮음 |
| `lib/data/campParticipants.ts` | 333, 346, 353, 354 | 데이터 병합 로직 | 🟡 중간 |
| `lib/data/scoreQueries.ts` | 98, 106 | Supabase 조인 결과 변환 | 🟡 중간 |
| `lib/data/scoreDetails.ts` | 89, 176, 268 | Supabase 조인 결과 변환 | 🟡 중간 |

### 1.2 상세 분석

#### 🔴 높은 우선순위: `lib/data/planGroups.ts`

**문제점**:
1. **JSONB 필드 타입**: `scheduler_options`, `daily_schedule`, `subject_constraints` 등이 `any | null`로 정의됨
2. **Fallback 결과 변환**: `fallbackResult.data.map((group: any) => ...)` 패턴 사용

**개선 방안**:
```typescript
// Before
scheduler_options?: any | null;
daily_schedule?: any | null;

// After
type SchedulerOptions = {
  study_days?: number;
  review_days?: number;
  student_level?: "high" | "medium" | "low";
  // ... 기타 필드
};

scheduler_options?: SchedulerOptions | null;
daily_schedule?: DailySchedule | null;
```

#### 🟡 중간 우선순위: `lib/data/scoreQueries.ts`, `lib/data/scoreDetails.ts`

**문제점**:
- Supabase 조인 결과를 `any`로 단언한 후 변환

**개선 방안**:
```typescript
// Before
internalScores: ((internalScores as any) ?? []).map((score: any) => ({
  ...score,
  subject: score.subject?.[0] || null,
  subject_group: score.subject_group?.[0] || null,
}))

// After
type InternalScoreWithRelations = Tables<"student_internal_scores"> & {
  subject?: Tables<"subjects">[];
  subject_group?: Tables<"subject_groups">[];
};

internalScores: ((internalScores as InternalScoreWithRelations[]) ?? []).map((score) => ({
  ...score,
  subject: score.subject?.[0] || null,
  subject_group: score.subject_group?.[0] || null,
}))
```

#### 🟢 낮은 우선순위: `lib/data/contentQueryBuilder.ts`

**문제점**:
- 로깅용 샘플 데이터만 `any` 사용

**개선 방안**:
```typescript
// Before
sample: result.data.slice(0, 3).map((item: any) => ({
  id: item.id,
  title: item.title,
})),

// After
sample: result.data.slice(0, 3).map((item) => ({
  id: item.id,
  title: item.title,
})),
```

---

## ⚡ 2. 성능 병목 점검

### 2.1 `getTodayPlans` 성능 분석

**파일**: `lib/data/todayPlans.ts`

#### 현재 최적화 상태

✅ **이미 구현된 최적화**:
1. **캐시 시스템**: `today_plans_cache` 테이블 사용 (2분 TTL)
2. **View 활용**: `today_plan_view`를 통한 Application-side Join 제거
3. **병렬 쿼리**: Wave 1, Wave 2 패턴으로 독립 쿼리 병렬 실행
4. **Narrowed Queries**: `narrowQueries` 옵션으로 불필요한 데이터 조회 방지
5. **In-memory 계산**: `todayProgress` 계산을 DB 쿼리 대신 메모리에서 수행

#### 🔍 추가 최적화 포인트

##### 1. 캐시 히트율 개선

**현재 문제**:
- 캐시 TTL이 2분으로 짧아 캐시 미스가 빈번할 수 있음
- 캐시 키에 `is_camp_mode` 포함으로 일반/캠프 모드별로 별도 캐시 필요

**개선 제안**:
```typescript
// 캐시 TTL을 동적으로 조정 (오늘 날짜는 더 짧게, 과거/미래는 더 길게)
const cacheTtlSeconds = isToday 
  ? 120  // 오늘: 2분
  : 600; // 과거/미래: 10분
```

##### 2. 불필요한 쿼리 제거

**현재 로직**:
```typescript
// 오늘 플랜이 없으면 30일/180일 범위를 병렬로 조회
if (!requestedDateParam && plans.length === 0) {
  const [shortRangePlans, longRangePlans] = await Promise.all([...]);
}
```

**개선 제안**:
- 사용자가 명시적으로 날짜를 요청한 경우에만 미래 날짜 조회
- 또는 클라이언트에서 "다음 플랜 보기" 버튼으로 명시적 요청

##### 3. 인덱스 최적화 확인 필요

**확인 사항**:
- `today_plan_view`에 적절한 인덱스가 있는지 확인
- `today_plans_cache` 테이블의 UNIQUE 제약조건이 인덱스로 활용되는지 확인

**권장 인덱스**:
```sql
-- today_plan_view 성능 향상을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_today_plan_view_student_date 
ON student_plan (student_id, plan_date, tenant_id) 
WHERE deleted_at IS NULL;

-- 캐시 조회 최적화
CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup 
ON today_plans_cache (student_id, plan_date, is_camp_mode, tenant_id, expires_at);
```

### 2.2 클라이언트 사이드 리렌더링 최적화

#### ✅ React Query 캐시 전략

**현재 상태**: 모든 훅이 적절한 `staleTime`과 `gcTime` 설정
- Dynamic Data: 1분 / 10분
- Stats Data: 5분 / 30분
- Realtime Data: 10초 / 5분

#### 🔍 추가 확인 사항

**`useTodayPlans` 훅**:
- `refetchOnWindowFocus` 기본값 확인 필요
- `refetchInterval` 설정 여부 확인

**권장 설정**:
```typescript
export function todayPlansQueryOptions(...) {
  return queryOptions({
    // ...
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
    refetchOnWindowFocus: false, // 서버 컴포넌트 prefetch 사용 시 불필요
    refetchOnMount: false, // HydrationBoundary 사용 시 불필요
  });
}
```

---

## 🧹 3. 최종 코드 정리

### 3.1 미사용 코드 식별

#### ✅ Deprecated 함수 확인

**`checkSchoolDuplicate`**:
- **상태**: `@deprecated` 표시됨
- **사용 여부**: 코드베이스 검색 결과 사용되지 않음
- **조치**: 유지 (하위 호환성 유지 필요)

**`autoRegisterSchool`**:
- **상태**: `@deprecated` 표시됨
- **사용 여부**: 일부 레거시 코드에서 사용 가능성
- **조치**: 유지 (하위 호환성 유지 필요)

### 3.2 TODO 주석 정리

**발견된 TODO 주석**:

| 파일 경로 | TODO 내용 | 상태 |
|-----------|-----------|------|
| `lib/data/contentMetadata.ts` | 마스터 콘텐츠의 subject_category를 올바르게 조회 | 🔄 확인 필요 |
| `lib/data/studentPlans.ts` | `@see docs/refactoring/03_phase_todo_list.md [P2-9]` | ✅ 참조 문서 확인 |
| `lib/data/studentPlans.ts` | `@see docs/refactoring/03_phase_todo_list.md [P2-8]` | ✅ 참조 문서 확인 |
| `lib/data/planGroupItems.ts` | `@see docs/refactoring/03_phase_todo_list.md [P2-4]` | ✅ 참조 문서 확인 |

**조치 계획**:
1. `contentMetadata.ts`의 TODO 확인 및 해결
2. 참조 문서 확인 후 TODO 상태 업데이트

---

## 📊 4. 개선 우선순위 및 액션 아이템

### 🔴 높은 우선순위

1. **`lib/data/planGroups.ts` JSONB 타입 정의**
   - `SchedulerOptions`, `DailySchedule`, `SubjectConstraints` 등 타입 정의
   - 예상 작업 시간: 2-3시간

2. **`getTodayPlans` 캐시 TTL 동적 조정**
   - 오늘/과거/미래 날짜별 다른 TTL 적용
   - 예상 작업 시간: 1시간

### 🟡 중간 우선순위

3. **`lib/data/scoreQueries.ts`, `lib/data/scoreDetails.ts` 타입 개선**
   - Supabase 조인 결과 타입 명시
   - 예상 작업 시간: 2-3시간

4. **`lib/data/schools.ts`, `lib/data/campParticipants.ts` 타입 개선**
   - 배열 변환 로직 타입 안전성 향상
   - 예상 작업 시간: 1-2시간

5. **인덱스 최적화 확인**
   - `today_plan_view`, `today_plans_cache` 인덱스 확인 및 추가
   - 예상 작업 시간: 1시간

### 🟢 낮은 우선순위

6. **`lib/data/contentQueryBuilder.ts` 로깅 타입 개선**
   - 예상 작업 시간: 30분

7. **TODO 주석 정리**
   - `contentMetadata.ts` TODO 확인 및 해결
   - 예상 작업 시간: 1시간

---

## 📝 5. 다음 단계

### 즉시 실행 가능한 작업

1. ✅ 타입 안전성 개선 (높은 우선순위부터)
2. ✅ 성능 최적화 (캐시 TTL 동적 조정)
3. ✅ 인덱스 최적화 확인

### 모니터링 필요

1. **프로덕션 배포 후**:
   - `getTodayPlans` 응답 시간 모니터링
   - 캐시 히트율 확인
   - React Query DevTools로 쿼리 상태 확인

2. **성능 메트릭 수집**:
   - API 응답 시간 (P50, P95, P99)
   - 캐시 히트율
   - 데이터베이스 쿼리 실행 시간

---

## ✅ 체크리스트

### 타입 안전성
- [ ] `lib/data/planGroups.ts` JSONB 타입 정의
- [ ] `lib/data/scoreQueries.ts` 타입 개선
- [ ] `lib/data/scoreDetails.ts` 타입 개선
- [ ] `lib/data/schools.ts` 타입 개선
- [ ] `lib/data/campParticipants.ts` 타입 개선
- [ ] `lib/data/contentMasters.ts` 타입 개선
- [ ] `lib/data/contentQueryBuilder.ts` 타입 개선

### 성능 최적화
- [ ] `getTodayPlans` 캐시 TTL 동적 조정
- [ ] 인덱스 최적화 확인 및 추가
- [ ] React Query 설정 최적화 (`refetchOnWindowFocus` 등)

### 코드 정리
- [ ] TODO 주석 확인 및 해결
- [ ] 미사용 코드 최종 확인

---

**다음 업데이트**: 타입 안전성 개선 작업 완료 후

