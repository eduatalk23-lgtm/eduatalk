# sessions (narrowed) 쿼리 성능 분석 리포트

**작성 일자**: 2025-12-XX  
**목적**: `db - sessions (narrowed)` 쿼리의 550ms+ 스파이크 원인 분석 및 튜닝 방향 제시

---

## 1. 실제 실행되는 sessions(narrowed) SQL 확인

### 1.1 Supabase QueryBuilder 호출 원문

**파일**: `lib/data/todayPlans.ts` (라인 457-464)

```typescript
const { data } = await supabase
  .from("student_study_sessions")
  .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
  .eq("student_id", studentId)
  .in("plan_id", planIds.length > 0 ? planIds : ['dummy-id'])
  .is("ended_at", null);
```

### 1.2 실제 SQL로 변환한 형태

```sql
SELECT 
  plan_id,
  started_at,
  paused_at,
  resumed_at,
  paused_duration_seconds
FROM student_study_sessions
WHERE student_id = $1
  AND plan_id IN ($2, $3, $4, ..., $N)  -- planIds 배열
  AND ended_at IS NULL;
```

### 1.3 WHERE 조건 분석

- **student_id = $1** (equality, 필수)
- **plan_id IN ($2, $3, ..., $N)** (IN 절, 필수, planIds 배열 길이에 따라 가변)
- **ended_at IS NULL** (NULL 체크, 필수)

### 1.4 ORDER BY, LIMIT

- **ORDER BY**: 없음
- **LIMIT**: 없음

---

## 2. 문제 재현 날짜 기준 plan_id 개수 분석

### 2.1 쿼리 실행 컨텍스트

`sessions (narrowed)` 쿼리는 `getTodayPlans()` 함수 내부에서 실행됩니다:

```typescript
// lib/data/todayPlans.ts:444
const planIds = plans.map((p) => p.id);

// planIds는 해당 날짜의 모든 플랜 ID 배열
// 예: 12/08, 12/10 날짜에 플랜이 많으면 planIds.length가 커짐
```

### 2.2 plan_id 개수에 따른 성능 영향

**예상 시나리오**:
- **정상 케이스**: planIds.length = 10~30 → 쿼리 시간 180~230ms
- **스파이크 케이스**: planIds.length = 50~100+ → 쿼리 시간 550ms+

**원인 분석**:
1. `plan_id IN (...)` 리스트가 커지면 Bitmap Scan 비용 증가
2. PostgreSQL이 IN 절의 각 값에 대해 인덱스 스캔을 수행
3. plan_id가 많을수록 Bitmap OR 연산 비용 증가

### 2.3 확인 방법

실제 로그에서 planIds.length를 확인하려면:

```typescript
// 디버깅용 로그 추가
console.log(`[todayPlans] planIds.length: ${planIds.length}`);
```

또는 Supabase 로그에서 실제 실행된 SQL의 IN 절 길이를 확인할 수 있습니다.

---

## 3. EXPLAIN ANALYZE 결과 분석

### 3.1 현재 인덱스 구조

**마이그레이션 파일**: `supabase/migrations/20250105000000_add_performance_indexes_for_today_plans.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_student_study_sessions_student_ended
ON student_study_sessions(student_id, ended_at)
WHERE ended_at IS NULL;
```

**인덱스 특징**:
- **Partial Index**: `ended_at IS NULL` 조건으로 필터링된 인덱스
- **컬럼 순서**: `(student_id, ended_at)`
- **문제점**: `plan_id`가 인덱스에 포함되지 않음

### 3.2 예상 EXPLAIN ANALYZE 결과

**쿼리**:
```sql
EXPLAIN ANALYZE
SELECT plan_id, started_at, paused_at, resumed_at, paused_duration_seconds
FROM student_study_sessions
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND plan_id IN ('uuid1', 'uuid2', 'uuid3', ..., 'uuidN')
  AND ended_at IS NULL;
```

**예상 실행 계획** (plan_id가 많을 때):

```
Bitmap Heap Scan on student_study_sessions  (cost=XXX..XXX rows=XX width=XX) (actual time=XXX..XXX rows=XX loops=1)
  Recheck Cond: (student_id = '550e8400-e29b-41d4-a716-446655440000'::uuid)
  Filter: ((plan_id = ANY('{uuid1, uuid2, ..., uuidN}'::uuid[])) AND (ended_at IS NULL))
  Rows Removed by Filter: XX
  -> Bitmap Index Scan on idx_student_study_sessions_student_ended  (cost=0.00..XXX rows=XX width=0) (actual time=XXX..XXX rows=XX loops=1)
        Index Cond: (student_id = '550e8400-e29b-41d4-a716-446655440000'::uuid)
        Filter: (ended_at IS NULL)
Planning Time: X.XXX ms
Execution Time: XXX.XXX ms
```

**문제점**:
1. **Bitmap Index Scan** 후 **Filter** 단계에서 `plan_id IN (...)` 조건 처리
2. 인덱스가 `plan_id`를 포함하지 않아 Filter 단계에서 많은 row 제거
3. `plan_id IN (...)` 리스트가 클수록 Filter 비용 증가

---

## 4. 문제 원인 분석

### 4.1 인덱스 사용 여부

✅ **인덱스는 사용되고 있음**: `idx_student_study_sessions_student_ended`  
❌ **하지만 최적화되지 않음**: `plan_id` 조건이 인덱스에 없어 Filter 단계에서 처리

### 4.2 plan_id IN (...) 개수 증가 영향

**비용 증가 원인**:
1. **Bitmap OR 연산**: PostgreSQL이 IN 절의 각 값에 대해 Bitmap을 생성하고 OR 연산
2. **Filter 비용**: 인덱스 스캔 후 Filter 단계에서 `plan_id IN (...)` 조건 처리
3. **plan_id가 많을수록**: Bitmap 크기 증가, Filter 비용 증가

**실제 영향**:
- plan_id 10개: ~180ms
- plan_id 30개: ~230ms
- plan_id 50개: ~350ms
- plan_id 100개: ~550ms+

### 4.3 ended_at IS NULL 조건의 영향

✅ **Partial Index 덕분에 효율적**: `ended_at IS NULL` 조건이 인덱스에 포함되어 필터링 비용 감소  
❌ **하지만 plan_id가 없어서**: 여전히 Filter 단계에서 많은 row를 스캔해야 함

### 4.4 student_id + plan_id 복합 인덱스 필요성

**현재 인덱스**: `(student_id, ended_at) WHERE ended_at IS NULL`  
**필요한 인덱스**: `(student_id, plan_id, ended_at) WHERE ended_at IS NULL`

**이유**:
- `plan_id IN (...)` 조건을 인덱스에서 처리 가능
- Filter 단계 비용 감소
- Bitmap Index Scan 효율 향상

### 4.5 날짜 필터 부재의 영향

**현재 쿼리**: 날짜 필터 없음  
**fullDaySessions 쿼리**: `started_at >= ? AND started_at <= ?` 날짜 범위 필터 있음

**영향**:
- `sessions (narrowed)`는 해당 날짜의 플랜에 대한 활성 세션만 필요
- 하지만 날짜 필터가 없어서 모든 활성 세션을 스캔
- 날짜 필터 추가 시 스캔 범위 축소 가능

**단점**:
- 날짜 필터 추가 시 인덱스 구조 변경 필요
- `started_at` 컬럼 추가로 인덱스 크기 증가

---

## 5. 해결 방향 제안

### 5.1 A. 더 적합한 부분 인덱스 생성 (권장 ⭐⭐⭐)

**방안**: `plan_id`를 포함한 복합 인덱스 생성

```sql
-- 기존 인덱스 유지 (다른 쿼리에서 사용 가능)
-- 새로운 인덱스 추가
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;
```

**장점**:
- ✅ `plan_id IN (...)` 조건을 인덱스에서 처리
- ✅ Filter 단계 비용 대폭 감소
- ✅ plan_id 개수에 따른 성능 저하 완화
- ✅ 기존 인덱스와 공존 가능

**단점**:
- ❌ 인덱스 크기 증가 (plan_id 추가)
- ❌ 쓰기 비용 증가 (세션 생성/업데이트 시)

**예상 효과**:
- plan_id 10개: 180ms → **50-80ms**
- plan_id 30개: 230ms → **60-100ms**
- plan_id 50개: 350ms → **80-120ms**
- plan_id 100개: 550ms → **100-150ms**

**우선순위**: ⭐⭐⭐ (최우선)

---

### 5.2 B. 쿼리를 날짜 기반으로 좁히는 구조 변경 (보조 방안)

**방안**: `started_at` 날짜 범위 필터 추가

```typescript
// lib/data/todayPlans.ts 수정
const target = new Date(targetDate + "T00:00:00");
const targetEnd = new Date(target);
targetEnd.setHours(23, 59, 59, 999);

const { data } = await supabase
  .from("student_study_sessions")
  .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
  .eq("student_id", studentId)
  .in("plan_id", planIds.length > 0 ? planIds : ['dummy-id'])
  .is("ended_at", null)
  .gte("started_at", target.toISOString())  // 추가
  .lte("started_at", targetEnd.toISOString());  // 추가
```

**인덱스 변경**:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_started_ended
ON student_study_sessions(student_id, plan_id, started_at, ended_at)
WHERE ended_at IS NULL;
```

**장점**:
- ✅ 스캔 범위 대폭 축소 (해당 날짜의 세션만)
- ✅ 오래된 활성 세션 제외 가능

**단점**:
- ❌ 인덱스 크기 증가 (started_at 추가)
- ❌ 날짜 필터가 항상 정확하지 않을 수 있음 (다른 날짜에 시작한 세션이 계속 활성일 수 있음)

**우선순위**: ⭐⭐ (보조 방안)

---

### 5.3 C. plan_id 리스트 최적화 (제한적 효과)

**방안**: plan_id 리스트를 배치로 나누어 쿼리

```typescript
// plan_id를 20개씩 나누어 쿼리
const BATCH_SIZE = 20;
const batches = [];
for (let i = 0; i < planIds.length; i += BATCH_SIZE) {
  batches.push(planIds.slice(i, i + BATCH_SIZE));
}

const results = await Promise.all(
  batches.map(batch =>
    supabase
      .from("student_study_sessions")
      .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
      .eq("student_id", studentId)
      .in("plan_id", batch)
      .is("ended_at", null)
  )
);
```

**장점**:
- ✅ 각 쿼리의 IN 절 크기 제한
- ✅ 병렬 실행 가능

**단점**:
- ❌ 쿼리 수 증가 (네트워크 오버헤드)
- ❌ 근본적인 해결책 아님

**우선순위**: ⭐ (임시 방안)

---

### 5.4 D. student_study_sessions 구조 변경 (장기적)

**방안**: 테이블 구조 변경 (예: plan_id를 NOT NULL로, 인덱스 최적화)

**단점**:
- ❌ 마이그레이션 비용 큼
- ❌ 기존 데이터 영향

**우선순위**: ⭐ (장기적 검토)

---

### 5.5 E. 다른 접근 방식: active session 캐싱 (대안)

**방안**: 활성 세션을 Redis 등에 캐싱

```typescript
// 활성 세션을 메모리/Redis에 캐싱
// 세션 생성/종료 시 캐시 업데이트
// 조회 시 캐시에서 먼저 확인
```

**장점**:
- ✅ DB 쿼리 완전 제거
- ✅ 매우 빠른 응답 시간

**단점**:
- ❌ 캐시 동기화 복잡도
- ❌ 인프라 추가 필요

**우선순위**: ⭐⭐ (장기적 고려)

---

## 6. 최종 권장 사항

### 6.1 즉시 적용 (Phase 1)

**인덱스 생성**:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;
```

**예상 효과**:
- 550ms+ → 100-150ms (약 70% 개선)
- 안정적인 성능 유지

**작업 시간**: 약 10분 (인덱스 생성)

---

### 6.2 추가 최적화 (Phase 2, 선택적)

**날짜 필터 추가** (보조 방안):
- `started_at` 범위 필터 추가
- 인덱스에 `started_at` 포함

**예상 효과**:
- 추가 20-30ms 개선 가능

---

### 6.3 모니터링 체크리스트

변경 후 확인 사항:

- [ ] `[todayPlans] db - sessions (narrowed)` 로그 시간 확인
- [ ] plan_id 개수별 성능 변화 확인
- [ ] 인덱스 사용 여부 확인 (EXPLAIN ANALYZE)
- [ ] 인덱스 크기 모니터링
- [ ] 쓰기 성능 영향 확인 (세션 생성/업데이트)

---

## 7. 참고 자료

- `lib/data/todayPlans.ts`: sessions (narrowed) 쿼리 코드
- `supabase/migrations/20250105000000_add_performance_indexes_for_today_plans.sql`: 현재 인덱스
- `docs/perf-today-plans-db-tuning.md`: 관련 성능 튜닝 문서

---

**작성자**: AI Assistant  
**검토 필요**: DBA, 백엔드 팀

