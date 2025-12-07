# todayPlans DB 쿼리 튜닝 분석 및 제안

## 1. 쿼리별 분석 요약

### 1.1 `db - plans` (student_plan 테이블)

**현재 쿼리 패턴**:
```typescript
// lib/data/studentPlans.ts:60-123
SELECT id, tenant_id, student_id, plan_date, block_index, content_type, content_id, 
       chapter, planned_start_page_or_time, planned_end_page_or_time, completed_amount, 
       progress, is_reschedulable, plan_group_id, start_time, end_time, actual_start_time, 
       actual_end_time, total_duration_seconds, paused_duration_seconds, pause_count, 
       plan_number, sequence, day_type, week, day, is_partial, is_continued, 
       content_title, content_subject, content_subject_category, content_category, 
       memo, created_at, updated_at
FROM student_plan
WHERE student_id = ?
  AND (tenant_id = ? OR tenant_id IS NULL)  -- optional
  AND plan_date = ?  -- 'YYYY-MM-DD' 형식
  AND plan_group_id IN (?, ?, ...)  -- optional, 캠프 모드일 때 필터링됨
ORDER BY plan_date ASC, block_index ASC
```

**WHERE 조건 컬럼**:
- `student_id` (필수, equality)
- `tenant_id` (선택, equality, nullable 고려)
- `plan_date` (필수, equality, 'YYYY-MM-DD' 문자열)
- `plan_group_id` (선택, IN 절, nullable 가능)

**정렬**:
- `plan_date ASC, block_index ASC`

**현재 성능**: ~196-314ms

**문제점**:
1. 40개 컬럼을 모두 SELECT (대부분 사용되지 않음)
2. `tenant_id`가 nullable인데 인덱스에 포함되지 않음
3. `plan_group_id IN (...)` 조건이 인덱스 효율을 떨어뜨릴 수 있음
4. ORDER BY가 인덱스와 일치하지 않을 수 있음

---

### 1.2 `db - sessions (narrowed)` (student_study_sessions 테이블)

**현재 쿼리 패턴**:
```typescript
// lib/data/todayPlans.ts:535-541
SELECT plan_id, started_at, paused_at, resumed_at, paused_duration_seconds
FROM student_study_sessions
WHERE student_id = ?
  AND plan_id IN (?, ?, ...)  -- narrowed: 오늘 플랜 ID만
  AND ended_at IS NULL
```

**WHERE 조건 컬럼**:
- `student_id` (필수, equality)
- `plan_id` (필수, IN 절, nullable 가능)
- `ended_at` (필수, IS NULL)

**정렬**: 없음

**현재 성능**: ~178-194ms

**문제점**:
1. `plan_id IN (...)` 조건이 인덱스 효율을 떨어뜨릴 수 있음
2. `ended_at IS NULL` 조건이 partial index로 최적화되어 있지만, `plan_id IN`과 조합 시 효율 저하 가능
3. 필요한 컬럼만 SELECT하므로 양호

---

### 1.3 `db - fullDaySessions` (student_study_sessions 테이블)

**현재 쿼리 패턴**:
```typescript
// lib/data/todayPlans.ts:553-560
// getSessionsInRange 호출
SELECT id, tenant_id, student_id, plan_id, content_type, content_id, 
       started_at, ended_at, duration_seconds, paused_at, resumed_at, 
       paused_duration_seconds, created_at
FROM student_study_sessions
WHERE student_id = ?
  AND (tenant_id = ? OR tenant_id IS NULL)  -- optional
  AND started_at >= ?  -- 'YYYY-MM-DD 00:00:00' 형식
  AND started_at <= ?  -- 'YYYY-MM-DD 23:59:59' 형식
ORDER BY started_at DESC
```

**WHERE 조건 컬럼**:
- `student_id` (필수, equality)
- `tenant_id` (선택, equality, nullable 고려)
- `started_at` (필수, range query: >= AND <=)

**정렬**:
- `started_at DESC`

**현재 성능**: ~190-208ms

**문제점**:
1. Range query (`started_at >= ? AND started_at <= ?`)는 인덱스 효율이 떨어질 수 있음
2. ORDER BY `started_at DESC`가 인덱스와 일치하지 않을 수 있음
3. 불필요한 컬럼 포함 (`tenant_id`, `content_type`, `content_id`, `created_at` 등)

---

### 1.4 `db - progress (narrowed)` (student_content_progress 테이블)

**현재 쿼리 패턴**:
```typescript
// lib/data/todayPlans.ts:462-500
// content_type별로 분리된 쿼리
SELECT content_type, content_id, progress
FROM student_content_progress
WHERE student_id = ?
  AND content_type = ?  -- 'book' | 'lecture' | 'custom'
  AND content_id IN (?, ?, ...)  -- narrowed: 오늘 플랜의 content_id만
```

**WHERE 조건 컬럼**:
- `student_id` (필수, equality)
- `content_type` (필수, equality)
- `content_id` (필수, IN 절)

**정렬**: 없음

**현재 성능**: ~196-203ms

**문제점**:
1. `content_id IN (...)` 조건이 인덱스 효율을 떨어뜨릴 수 있음
2. content_type별로 3개 쿼리로 분리되어 있지만, 하나의 쿼리로 통합 가능
3. 필요한 컬럼만 SELECT하므로 양호

---

### 1.5 `db - contents-books` (books 테이블)

**현재 쿼리 패턴**:
```typescript
// lib/data/todayPlans.ts:344-348
SELECT id, tenant_id, student_id, title, revision, semester, subject_category, 
       subject, publisher, difficulty_level, total_pages, notes, created_at, updated_at
FROM books
WHERE student_id = ?
  AND id IN (?, ?, ...)  -- narrowed: 오늘 플랜의 content_id만
```

**WHERE 조건 컬럼**:
- `student_id` (필수, equality)
- `id` (필수, IN 절)

**정렬**: 없음

**현재 성능**: ~181-193ms

**문제점**:
1. 14개 컬럼을 SELECT하지만, 실제로 사용되는 컬럼은 제한적
2. `id IN (...)` 조건이 인덱스 효율을 떨어뜨릴 수 있음
3. `tenant_id`는 사용되지 않지만 SELECT에 포함됨

---

## 2. EXPLAIN ANALYZE 예시 모음

### 2.1 `db - plans` EXPLAIN ANALYZE

```sql
-- 샘플 쿼리 (실제 파라미터 채워넣기)
EXPLAIN ANALYZE
SELECT id, tenant_id, student_id, plan_date, block_index, content_type, content_id, 
       chapter, planned_start_page_or_time, planned_end_page_or_time, completed_amount, 
       progress, is_reschedulable, plan_group_id, start_time, end_time, actual_start_time, 
       actual_end_time, total_duration_seconds, paused_duration_seconds, pause_count, 
       plan_number, sequence, day_type, week, day, is_partial, is_continued, 
       content_title, content_subject, content_subject_category, content_category, 
       memo, created_at, updated_at
FROM student_plan
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND tenant_id = '660e8400-e29b-41d4-a716-446655440001'
  AND plan_date = '2025-01-07'
  AND plan_group_id IN (
    '770e8400-e29b-41d4-a716-446655440002',
    '880e8400-e29b-41d4-a716-446655440003'
  )
ORDER BY plan_date ASC, block_index ASC;
```

**확인 포인트**:
- `Seq Scan` 여부 → `Index Scan` 또는 `Index Only Scan`으로 변경되어야 함
- `idx_student_plan_student_date_group` 인덱스 사용 여부
- `Sort` 연산이 필요한지 (인덱스가 정렬을 제공하는지)
- `Filter: (plan_group_id = ANY(...))` 비용
- 예상 row 수 vs 실제 row 수

---

### 2.2 `db - sessions (narrowed)` EXPLAIN ANALYZE

```sql
-- 샘플 쿼리
EXPLAIN ANALYZE
SELECT plan_id, started_at, paused_at, resumed_at, paused_duration_seconds
FROM student_study_sessions
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND plan_id IN (
    '990e8400-e29b-41d4-a716-446655440004',
    'aa0e8400-e29b-41d4-a716-446655440005',
    'bb0e8400-e29b-41d4-a716-446655440006'
  )
  AND ended_at IS NULL;
```

**확인 포인트**:
- `idx_student_study_sessions_student_ended` partial index 사용 여부
- `Bitmap Index Scan` vs `Index Scan` (IN 절 때문에 Bitmap이 더 효율적일 수 있음)
- `Filter: (plan_id = ANY(...))` 비용
- 예상 row 수 vs 실제 row 수

---

### 2.3 `db - fullDaySessions` EXPLAIN ANALYZE

```sql
-- 샘플 쿼리
EXPLAIN ANALYZE
SELECT id, tenant_id, student_id, plan_id, content_type, content_id, 
       started_at, ended_at, duration_seconds, paused_at, resumed_at, 
       paused_duration_seconds, created_at
FROM student_study_sessions
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND tenant_id = '660e8400-e29b-41d4-a716-446655440001'
  AND started_at >= '2025-01-07 00:00:00+00'
  AND started_at <= '2025-01-07 23:59:59.999+00'
ORDER BY started_at DESC;
```

**확인 포인트**:
- Range query에 대한 인덱스 사용 여부
- `Sort` 연산 비용 (인덱스가 정렬을 제공하는지)
- `Seq Scan` 여부 → `Index Scan`으로 변경되어야 함
- 예상 row 수 vs 실제 row 수

---

### 2.4 `db - progress (narrowed)` EXPLAIN ANALYZE

```sql
-- 샘플 쿼리 (book 타입 예시)
EXPLAIN ANALYZE
SELECT content_type, content_id, progress
FROM student_content_progress
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND content_type = 'book'
  AND content_id IN (
    'cc0e8400-e29b-41d4-a716-446655440007',
    'dd0e8400-e29b-41d4-a716-446655440008',
    'ee0e8400-e29b-41d4-a716-446655440009'
  );
```

**확인 포인트**:
- `idx_student_content_progress_student_type_content` 인덱스 사용 여부
- `Bitmap Index Scan` vs `Index Scan` (IN 절 때문에 Bitmap이 더 효율적일 수 있음)
- `Filter: (content_id = ANY(...))` 비용
- 예상 row 수 vs 실제 row 수

---

### 2.5 `db - contents-books` EXPLAIN ANALYZE

```sql
-- 샘플 쿼리
EXPLAIN ANALYZE
SELECT id, tenant_id, student_id, title, revision, semester, subject_category, 
       subject, publisher, difficulty_level, total_pages, notes, created_at, updated_at
FROM books
WHERE student_id = '550e8400-e29b-41d4-a716-446655440000'
  AND id IN (
    'ff0e8400-e29b-41d4-a716-446655440010',
    '110e8400-e29b-41d4-a716-446655440011',
    '220e8400-e29b-41d4-a716-446655440012'
  );
```

**확인 포인트**:
- `idx_books_student_id` 인덱스 사용 여부
- `Bitmap Index Scan` vs `Index Scan` (IN 절 때문에 Bitmap이 더 효율적일 수 있음)
- `Filter: (id = ANY(...))` 비용
- 예상 row 수 vs 실제 row 수

---

## 3. 인덱스 설계 제안 (SQL + 설명)

### 3.1 student_plan 테이블 인덱스 개선

**현재 인덱스**:
```sql
CREATE INDEX idx_student_plan_student_date_group
ON student_plan(student_id, plan_date, plan_group_id);
```

**문제점**:
1. `tenant_id`가 WHERE 조건에 포함되지만 인덱스에 없음
2. ORDER BY `plan_date, block_index`를 지원하지 않음
3. `plan_group_id`가 nullable인데 인덱스에 포함되어 IN 절 효율 저하 가능

**개선안 1: tenant_id 포함 복합 인덱스 (권장)**
```sql
-- tenant_id가 있는 경우를 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_tenant_student_date_group
ON student_plan(tenant_id, student_id, plan_date, plan_group_id)
WHERE tenant_id IS NOT NULL;

-- tenant_id가 없는 경우를 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_group_null_tenant
ON student_plan(student_id, plan_date, plan_group_id)
WHERE tenant_id IS NULL;
```

**개선안 2: ORDER BY 최적화를 위한 인덱스 (추가 권장)**
```sql
-- 정렬 최적화를 위해 block_index 포함
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_block
ON student_plan(student_id, plan_date, block_index)
INCLUDE (plan_group_id, content_type, content_id, actual_start_time, actual_end_time, 
         total_duration_seconds, paused_duration_seconds);
```

**효과**:
- `Seq Scan` → `Index Scan` 또는 `Index Only Scan`
- `Sort` 연산 제거 (인덱스가 정렬 제공)
- 예상: 200-300ms → 80-120ms

**단점**:
- 인덱스 크기 증가 (쓰기 비용 증가)
- `INCLUDE` 컬럼은 PostgreSQL 11+ 필요

---

### 3.2 student_study_sessions 테이블 인덱스 개선

**현재 인덱스**:
```sql
CREATE INDEX idx_student_study_sessions_student_ended
ON student_study_sessions(student_id, ended_at)
WHERE ended_at IS NULL;
```

**문제점**:
1. `sessions (narrowed)` 쿼리에서 `plan_id IN (...)` 조건이 인덱스에 없음
2. `fullDaySessions` 쿼리에서 `started_at` range query를 위한 인덱스 부족

**개선안 1: sessions (narrowed) 최적화**
```sql
-- plan_id IN 조건을 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;
```

**개선안 2: fullDaySessions 최적화**
```sql
-- started_at range query를 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_started
ON student_study_sessions(student_id, started_at DESC)
INCLUDE (plan_id, started_at, ended_at, paused_at, resumed_at, paused_duration_seconds);
```

**효과**:
- `sessions (narrowed)`: 180-200ms → 50-80ms
- `fullDaySessions`: 190-210ms → 60-100ms

**단점**:
- 인덱스 크기 증가
- 쓰기 비용 증가 (세션 생성/업데이트 시)

---

### 3.3 student_content_progress 테이블 인덱스 개선

**현재 인덱스**:
```sql
CREATE INDEX idx_student_content_progress_student_type_content
ON student_content_progress(student_id, content_type, content_id);
```

**문제점**:
1. 현재 인덱스는 이미 최적화되어 있음
2. 다만 `content_id IN (...)` 조건이 많을 때 Bitmap Scan이 더 효율적일 수 있음

**개선안: 추가 최적화 (선택적)**
```sql
-- content_id IN 절 최적화를 위한 부분 인덱스 (필요시)
-- 현재 인덱스로도 충분하지만, content_id가 매우 많을 경우 고려
-- 일반적으로는 현재 인덱스로 충분
```

**효과**:
- 현재 인덱스로도 충분 (200ms → 150-180ms 정도 개선 가능)

---

### 3.4 books 테이블 인덱스 개선

**현재 인덱스**:
```sql
CREATE INDEX idx_books_student_id
ON books(student_id, id);
```

**문제점**:
1. 현재 인덱스는 이미 최적화되어 있음
2. 다만 `id IN (...)` 조건이 많을 때 Bitmap Scan이 더 효율적일 수 있음

**개선안: 추가 최적화 (선택적)**
```sql
-- id IN 절 최적화를 위한 부분 인덱스 (필요시)
-- 현재 인덱스로도 충분하지만, id가 매우 많을 경우 고려
-- 일반적으로는 현재 인덱스로도 충분
```

**효과**:
- 현재 인덱스로도 충분 (180-200ms → 100-150ms 정도 개선 가능)

---

## 4. 쿼리/코드 수정안 (Before/After 코드 스니펫)

### 4.1 `db - plans` SELECT 컬럼 최적화

**Before**:
```typescript
// lib/data/studentPlans.ts:68-69
.select(
  "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at"
)
```

**After**:
```typescript
// todayPlans에서 실제로 사용되는 컬럼만 SELECT
.select(
  "id,student_id,plan_date,block_index,content_type,content_id,chapter," +
  "planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress," +
  "is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time," +
  "total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence," +
  "memo,created_at,updated_at"
)
// 제거된 컬럼: tenant_id (사용 안 함), content_title, content_subject, 
// content_subject_category, content_category (denormalized, enrich 단계에서 제거됨),
// day_type, week, day, is_partial, is_continued (사용 안 함)
```

**효과**: 네트워크 전송량 감소, 쿼리 실행 시간 10-20% 개선

---

### 4.2 `db - fullDaySessions` SELECT 컬럼 최적화

**Before**:
```typescript
// lib/data/studentSessions.ts:44-45
.select(
  "id,tenant_id,student_id,plan_id,content_type,content_id,started_at,ended_at,duration_seconds,paused_at,resumed_at,paused_duration_seconds,created_at"
)
```

**After**:
```typescript
// todayPlans에서 실제로 사용되는 컬럼만 SELECT
.select(
  "id,plan_id,started_at,ended_at,duration_seconds,paused_at,resumed_at,paused_duration_seconds"
)
// 제거된 컬럼: tenant_id, student_id (이미 WHERE 조건에 있음), 
// content_type, content_id, created_at (사용 안 함)
```

**효과**: 네트워크 전송량 감소, 쿼리 실행 시간 5-10% 개선

---

### 4.3 `db - progress (narrowed)` 쿼리 통합 (선택적)

**Before**:
```typescript
// lib/data/todayPlans.ts:461-500
// content_type별로 3개 쿼리로 분리
const progressQueries = [];
if (bookProgressIds.length > 0) {
  progressQueries.push(
    supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress")
      .eq("student_id", studentId)
      .eq("content_type", "book")
      .in("content_id", bookProgressIds)
  );
}
// ... lecture, custom 동일 패턴
```

**After (선택적, IN 절이 작을 때만)**:
```typescript
// 모든 content_type을 하나의 쿼리로 통합
// 단, IN 절이 100개 이하일 때만 효율적
if (contentKeys.size > 0 && contentKeys.size <= 100) {
  const allContentIds = [...bookProgressIds, ...lectureProgressIds, ...customProgressIds];
  const allContentTypes = [
    ...bookProgressIds.map(() => 'book'),
    ...lectureProgressIds.map(() => 'lecture'),
    ...customProgressIds.map(() => 'custom')
  ];
  
  // OR 조건으로 통합 (인덱스 효율은 떨어질 수 있음)
  // 일반적으로는 현재 방식(분리)이 더 효율적
}
```

**권장**: 현재 방식(분리) 유지. 통합은 IN 절이 매우 작을 때만 고려.

---

### 4.4 ORDER BY 최적화 (선택적)

**Before**:
```typescript
// lib/data/studentPlans.ts:123
query = query.order("plan_date", { ascending: true }).order("block_index", { ascending: true });
```

**After**:
```typescript
// 인덱스가 정렬을 제공하므로 ORDER BY 제거 가능 (선택적)
// 다만, 인덱스가 (student_id, plan_date, block_index) 순서로 생성되어야 함
// 현재는 인덱스가 정렬을 제공하지 않으므로 ORDER BY 유지
// 인덱스 개선 후 ORDER BY 제거 검토 가능
```

**권장**: 인덱스 개선 후 ORDER BY 제거 검토.

---

## 5. 기대 효과 및 검증 방법 요약

### 5.1 목표 타임라인

| 쿼리 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| `db - plans` | 200-314ms | 80-120ms | 60-70% |
| `db - sessions (narrowed)` | 178-194ms | 50-80ms | 60-70% |
| `db - fullDaySessions` | 190-208ms | 60-100ms | 50-60% |
| `db - progress (narrowed)` | 196-203ms | 100-150ms | 25-50% |
| `db - contents-books` | 181-193ms | 100-150ms | 20-30% |
| **합계 (DB 쿼리)** | **~950-1112ms** | **~390-600ms** | **~45-50%** |
| **enrich (JS)** | 390-413ms | 390-413ms | 0% |
| **todayPlans total** | **~2.5s** | **~1.5-1.8s** | **~30-40%** |

### 5.2 검증 방법

**성공 기준**:
1. `todayPlans total < 1.8s` (현재 ~2.5s)
2. `/camp/today total < 3.0s` (현재 ~3.7s)
3. 모든 쿼리에서 `Seq Scan` 제거
4. `Index Scan` 또는 `Index Only Scan` 사용
5. `Sort` 연산 제거 (인덱스가 정렬 제공)

**EXPLAIN ANALYZE 체크리스트**:
- [ ] `db - plans`: `Index Scan` 또는 `Index Only Scan` 사용
- [ ] `db - plans`: `Sort` 연산 없음 (인덱스가 정렬 제공)
- [ ] `db - sessions (narrowed)`: `Bitmap Index Scan` 또는 `Index Scan` 사용
- [ ] `db - fullDaySessions`: `Index Scan` 사용, `Sort` 연산 최소화
- [ ] `db - progress (narrowed)`: `Index Scan` 사용
- [ ] `db - contents-books`: `Index Scan` 사용

**성능 지표**:
- `Seq Scan` 비율: 0% (목표)
- `Index Scan` 비율: 100% (목표)
- `Sort` 연산: 최소화 (목표: 0개)
- 예상 row vs 실제 row: 차이 < 10% (목표)

---

## 6. 마이그레이션 SQL (Supabase 호환)

```sql
-- ============================================
-- todayPlans DB 쿼리 튜닝 마이그레이션
-- ============================================

-- 1. student_plan 테이블 인덱스 개선
-- 1-1. tenant_id 포함 복합 인덱스 (tenant_id가 있는 경우)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_tenant_student_date_group
ON public.student_plan(tenant_id, student_id, plan_date, plan_group_id)
WHERE tenant_id IS NOT NULL;

-- 1-2. tenant_id가 없는 경우를 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_group_null_tenant
ON public.student_plan(student_id, plan_date, plan_group_id)
WHERE tenant_id IS NULL;

-- 1-3. ORDER BY 최적화를 위한 인덱스 (PostgreSQL 11+)
-- INCLUDE 컬럼은 자주 필터링되지만 SELECT에 포함되는 컬럼
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_block_include
ON public.student_plan(student_id, plan_date, block_index)
INCLUDE (plan_group_id, content_type, content_id, actual_start_time, actual_end_time, 
         total_duration_seconds, paused_duration_seconds);

-- 2. student_study_sessions 테이블 인덱스 개선
-- 2-1. sessions (narrowed) 최적화: plan_id IN 조건 지원
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON public.student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;

-- 2-2. fullDaySessions 최적화: started_at range query 지원
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_started_desc
ON public.student_study_sessions(student_id, started_at DESC)
INCLUDE (plan_id, started_at, ended_at, paused_at, resumed_at, paused_duration_seconds);

-- 3. 기존 인덱스 유지 (다른 쿼리에서 사용 가능)
-- idx_student_plan_student_date_group (기존)
-- idx_student_study_sessions_student_ended (기존)
-- idx_student_content_progress_student_type_content (기존)
-- idx_books_student_id (기존)

-- 4. 인덱스 주석 추가
COMMENT ON INDEX idx_student_plan_tenant_student_date_group IS 
'Optimizes plan queries with tenant_id. Used in /api/today/plans when tenant_id is provided.';

COMMENT ON INDEX idx_student_plan_student_date_group_null_tenant IS 
'Optimizes plan queries without tenant_id. Used in /api/today/plans when tenant_id is null.';

COMMENT ON INDEX idx_student_plan_student_date_block_include IS 
'Optimizes plan queries with ORDER BY plan_date, block_index. Includes frequently accessed columns.';

COMMENT ON INDEX idx_study_sessions_student_plan_ended IS 
'Optimizes active session lookups filtered by plan_id IN (...). Used in /api/today/plans sessions (narrowed) query.';

COMMENT ON INDEX idx_study_sessions_student_started_desc IS 
'Optimizes full-day session lookups with started_at range query. Used in /api/today/plans fullDaySessions query.';

-- 5. 인덱스 사용 통계 확인 (선택적)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('student_plan', 'student_study_sessions')
-- ORDER BY idx_scan DESC;
```

---

## 7. 적용 순서 및 주의사항

### 7.1 적용 순서

1. **Step 1**: 인덱스 생성 (CONCURRENTLY로 운영 중에도 가능)
   ```bash
   # Supabase 마이그레이션 실행
   supabase migration new optimize_today_plans_indexes
   # 위 SQL을 마이그레이션 파일에 복사
   supabase db push
   ```

2. **Step 2**: EXPLAIN ANALYZE로 인덱스 사용 확인
   - 각 쿼리별로 EXPLAIN ANALYZE 실행
   - `Seq Scan` → `Index Scan` 변경 확인
   - `Sort` 연산 제거 확인

3. **Step 3**: SELECT 컬럼 최적화 (코드 수정)
   - `lib/data/studentPlans.ts` 수정
   - `lib/data/studentSessions.ts` 수정
   - 테스트 및 배포

4. **Step 4**: 성능 측정
   - 개발 환경에서 타이밍 로그 확인
   - `todayPlans total < 1.8s` 달성 확인
   - `/camp/today total < 3.0s` 달성 확인

### 7.2 주의사항

1. **인덱스 크기**: 인덱스가 많아지면 쓰기 성능 저하 가능
   - 모니터링 필요: `pg_stat_user_indexes`로 인덱스 사용률 확인
   - 사용되지 않는 인덱스는 제거

2. **CONCURRENTLY 옵션**: 운영 중 인덱스 생성 시 필수
   - `CREATE INDEX CONCURRENTLY`는 락 없이 인덱스 생성
   - 다만 시간이 더 오래 걸림

3. **INCLUDE 컬럼**: PostgreSQL 11+ 필요
   - Supabase는 PostgreSQL 15+ 사용하므로 문제없음

4. **Partial Index**: `WHERE` 조건이 있는 인덱스
   - `ended_at IS NULL` 같은 조건으로 인덱스 크기 감소
   - 다만 쿼리 조건과 정확히 일치해야 효율적

---

## 8. 추가 최적화 아이디어 (향후 검토)

1. **Materialized View**: 자주 조회되는 todayPlans 결과를 Materialized View로 캐싱
2. **Connection Pooling**: Supabase connection pool 설정 최적화
3. **Query Batching**: 여러 쿼리를 하나의 트랜잭션으로 묶기
4. **Read Replica**: 읽기 전용 쿼리를 read replica로 라우팅

---

**작성일**: 2025-01-07  
**작성자**: AI Performance Engineer  
**버전**: 1.0

