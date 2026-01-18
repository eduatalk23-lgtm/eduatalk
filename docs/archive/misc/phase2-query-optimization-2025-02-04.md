# Phase 2 쿼리 최적화 작업 완료 보고

**작업 일자**: 2025-02-04  
**작업 범위**: SELECT 컬럼 최소화를 통한 쿼리 성능 최적화

## 개요

Phase 2 계획에 따라 `student_plan` 테이블의 fallback 쿼리에서 `select("*")`를 필요한 컬럼만 선택하도록 개선하여 쿼리 성능을 최적화했습니다.

## 완료된 작업

### `lib/data/studentPlans.ts` 쿼리 최적화

**문제점**:
- Line 262: fallback 쿼리에서 `select("*")` 사용
- `student_plan` 테이블은 40개 이상의 컬럼을 가지고 있어 불필요한 데이터 전송 발생
- 네트워크 대역폭 및 메모리 사용량 증가

**해결 방법**:
- fallback 쿼리에서도 필요한 컬럼만 명시적으로 선택
- 메인 쿼리와 동일한 컬럼 목록 사용

**수정 전**:
```typescript
if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  // fallback: tenant_id 컬럼이 없는 경우
  let fallbackQuery = supabase
    .from("student_plan")
    .select("*")  // ❌ 모든 컬럼 선택
    .eq("student_id", filters.studentId);
  // ...
}
```

**수정 후**:
```typescript
if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  // fallback: tenant_id 컬럼이 없는 경우
  // 필요한 컬럼만 선택하여 성능 최적화
  let fallbackQuery = supabase
    .from("student_plan")
    .select("id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at")  // ✅ 필요한 컬럼만 선택
    .eq("student_id", filters.studentId);
  // ...
}
```

**효과**:
- 네트워크 대역폭 절약: 불필요한 컬럼 데이터 전송 방지
- 메모리 사용량 감소: 필요한 데이터만 메모리에 로드
- 쿼리 실행 시간 단축: 데이터베이스에서 필요한 컬럼만 읽음
- 일관성 향상: 메인 쿼리와 fallback 쿼리가 동일한 컬럼 선택

## 최적화된 컬럼 목록

`student_plan` 테이블에서 선택하는 컬럼 (총 33개):

1. 기본 정보: `id`, `student_id`, `plan_date`, `block_index`
2. 콘텐츠 정보: `content_type`, `content_id`, `chapter`, `content_title`, `content_subject`, `content_subject_category`, `content_category`
3. 계획 정보: `planned_start_page_or_time`, `planned_end_page_or_time`, `completed_amount`, `progress`, `is_reschedulable`
4. 그룹 정보: `plan_group_id`
5. 시간 정보: `start_time`, `end_time`, `actual_start_time`, `actual_end_time`, `total_duration_seconds`, `paused_duration_seconds`, `pause_count`
6. 순서 정보: `plan_number`, `sequence`, `day_type`, `week`, `day`
7. 상태 정보: `is_partial`, `is_continued`
8. 메모: `memo`
9. 타임스탬프: `created_at`, `updated_at`

**참고**: `tenant_id`는 메인 쿼리에서만 선택하고, fallback 쿼리에서는 제외 (컬럼이 없는 경우를 대비)

## 기존 최적화 상태

### 이미 최적화된 쿼리

1. **메인 쿼리**: 이미 필요한 컬럼만 명시적으로 선택
2. **`getPlanById`**: 필요한 컬럼만 명시적으로 선택
3. **`getActiveSessionsForPlans`**: 필요한 컬럼만 명시적으로 선택, `plan_id IN (...)` 최적화 (MAX_IN_CLAUSE_SIZE 체크)

### 우선순위 낮은 최적화 대상

- `regions` 테이블: 작은 테이블이며 모든 컬럼을 사용하므로 `select("*")` 유지
- `school_info` 테이블: 단일 행 조회 시 `select("*")` 사용 (필요한 모든 컬럼 사용)

## 개선 효과

1. **성능 향상**
   - 네트워크 대역폭 절약
   - 메모리 사용량 감소
   - 쿼리 실행 시간 단축

2. **일관성 향상**
   - 메인 쿼리와 fallback 쿼리가 동일한 컬럼 선택
   - 예측 가능한 데이터 구조

3. **유지보수성 향상**
   - 필요한 컬럼이 명시적으로 드러남
   - 불필요한 컬럼 제거로 코드 가독성 향상

## 다음 단계

향후 개선 가능한 사항:

1. **다른 테이블 최적화**: `student_study_sessions`, `student_content_progress` 등
2. **인덱스 활용 개선**: 쿼리 실행 계획 분석 및 인덱스 최적화
3. **배치 쿼리 최적화**: 여러 쿼리를 하나로 통합하여 N+1 문제 해결

## 참고 사항

- 데이터베이스 인덱스는 이미 충분히 최적화되어 있음 (계획 파일 참조)
- `student_plan`: 43개 인덱스
- `student_study_sessions`: 11개 인덱스
- `student_content_progress`: 7개 인덱스

