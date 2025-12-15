# today_plan_view 에러 수정 및 최적화 완료 보고서

## 작업 개요

`today_plan_view`가 존재하지 않아 발생하는 PGRST205 에러를 해결하고, fallback 로직을 최적화하며 중복 코드를 제거했습니다.

## 완료된 작업

### 1. 데이터베이스 View 생성 ✅

**문제**: `today_plan_view`가 데이터베이스에 존재하지 않음

**해결**:

- Supabase MCP를 통해 View 존재 여부 확인
- `student_custom_contents` 테이블에 `subject_category` 컬럼이 없음을 확인
- View 마이그레이션 수정 및 적용
- 마이그레이션 파일 업데이트: `supabase/migrations/20251215163535_create_today_plan_view.sql`

**변경 사항**:

```sql
-- 수정 전
COALESCE(b.subject_category, l.subject_category, c.subject_category)

-- 수정 후
COALESCE(b.subject_category, l.subject_category, NULL)
```

### 2. View 존재 여부 확인 헬퍼 함수 추가 ✅

**파일**: `lib/utils/databaseFallback.ts`

**추가된 함수**:

- `isViewNotFoundError(error)`: PGRST205 에러 확인
- `checkViewExists(supabase, viewName)`: View 존재 여부 확인

### 3. Fallback 로직 리팩토링 ✅

**파일**: `lib/data/todayPlans.ts`

**개선 사항**:

- `withErrorFallback` 유틸리티 활용
- PGRST205 에러만 fallback 처리
- 기타 에러는 실제 에러로 처리하되 안정성을 위해 fallback도 제공

**변경 전**:

```typescript
if (error) {
  console.warn("[data/todayPlans] View 조회 실패, 기존 방식으로 fallback:", error);
  return getPlansForStudent({...});
}
```

**변경 후**:

```typescript
const result = await withErrorFallback(
  queryPlansFromView,
  fallbackQuery,
  (error) => isViewNotFoundError(error)
);
```

### 4. 중복 코드 제거 ✅

**파일**: `lib/data/studentPlans.ts`, `lib/data/todayPlans.ts`

**개선 사항**:

- 공통 쿼리 빌더 함수 `buildPlanQuery` 추가
- `getPlansFromView()`와 `getPlansForStudent()`에서 공통 로직 사용
- 쿼리 빌딩 로직 중복 제거

**추가된 함수**:

```typescript
export function buildPlanQuery(
  supabase: SupabaseServerClient,
  tableName: "student_plan" | "today_plan_view",
  selectFields: string,
  options: PlanQueryOptions
);
```

### 5. 에러 처리 개선 ✅

**개선 사항**:

- 구조화된 로깅 시스템 적용
- 에러 타입별 처리 분기
- 개발/프로덕션 환경별 로깅 레벨

**에러 로깅 예시**:

```typescript
const errorDetails = {
  code: result.error?.code,
  message: result.error?.message,
  hint: result.error?.hint,
  details: result.error?.details,
  timestamp: new Date().toISOString(),
  context: {
    studentId: options.studentId,
    tenantId: options.tenantId,
    // ...
  },
};
```

## 성능 개선

### View 사용 시 이점

- Application-side Join 제거
- 단일 쿼리로 콘텐츠 정보 조회
- 데이터베이스 레벨 최적화

### Fallback 처리

- View가 없어도 정상 동작 보장
- 에러 발생 시 자동 fallback
- 안정성 우선 설계

## 테스트 시나리오

### 1. View 사용 시나리오

- `today_plan_view`가 존재하는 경우
- View를 통해 플랜 조회
- 콘텐츠 정보 자동 조인

### 2. Fallback 시나리오

- `today_plan_view`가 없는 경우 (PGRST205 에러)
- 자동으로 `getPlansForStudent()` 호출
- 정상 동작 보장

### 3. 에러 처리 시나리오

- 기타 에러 발생 시
- 구조화된 로깅
- 안정성을 위한 fallback 제공

## 변경된 파일

1. `supabase/migrations/20251215163535_create_today_plan_view.sql`

   - `student_custom_contents.subject_category` 참조 제거

2. `lib/utils/databaseFallback.ts`

   - `isViewNotFoundError()` 함수 추가
   - `checkViewExists()` 함수 추가
   - `withErrorFallback()` 로깅 개선

3. `lib/data/studentPlans.ts`

   - `buildPlanQuery()` 공통 함수 추가
   - `getPlansForStudent()` 리팩토링

4. `lib/data/todayPlans.ts`
   - `getPlansFromView()` 리팩토링
   - `withErrorFallback` 유틸리티 활용
   - 에러 처리 개선

## 향후 개선 사항

1. **성능 측정**

   - View 사용 시와 fallback 시의 성능 차이 측정
   - 쿼리 실행 시간 비교

2. **캐싱 전략**

   - View 존재 여부 캐싱
   - Fallback 호출 최소화

3. **모니터링**
   - 에러 발생 빈도 추적
   - Fallback 사용률 모니터링

## 참고 문서

- `docs/2025-02-15-today-page-performance-improvement.md`: 성능 개선 문서
- `lib/utils/databaseFallback.ts`: Fallback 유틸리티 문서
