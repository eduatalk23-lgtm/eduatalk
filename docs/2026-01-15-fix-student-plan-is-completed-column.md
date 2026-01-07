# student_plan 테이블 is_completed 컬럼 제거 및 status 기반 변경

## 문제 상황

플랜 생성 시 다음과 같은 에러가 발생했습니다:
```
플랜 생성 실패: Could not find the 'is_completed' column of 'student_plan' in the schema cache
```

## 원인 분석

데이터베이스 스키마 확인 결과:
- `student_plan` 테이블에는 `is_completed` 컬럼이 **존재하지 않음**
- 대신 `status` 컬럼이 있으며 값은: 'pending', 'in_progress', 'completed', 'canceled'
- 코드에서 `is_completed`를 사용하는 곳이 여러 곳 발견됨

## 수정 내용

### 1. QuickActions.tsx
- **58줄**: `is_completed: !isCompleted` 업데이트 제거
- **329줄**: `is_completed: isComplete` 업데이트 제거
- `status` 업데이트만 유지 (이미 구현되어 있음)

### 2. SummaryDashboard.tsx
- **59줄**: select 쿼리에서 `is_completed` 제거
- **82줄**: `p.is_completed` → `p.status === 'completed'`
- **104줄**: `p.is_completed` → `p.status === 'completed'`
- **125줄**: `p.is_completed` → `p.status === 'completed'`

### 3. RedistributeModal.tsx
- **280줄**: insert 시 `is_completed: false` 제거, `status: 'pending'` 명시
- **310줄**: insert 시 `is_completed: false` 제거, `status: 'pending'` 명시

### 4. createPlanFromContent.ts
- **152줄**: insert 시 `is_completed: false` 제거

### 5. planTemplates.ts
- **237줄**: insert 시 `is_completed: false` 제거

### 6. copyPlan.ts
- **101줄**: insert 시 `is_completed: false` 제거

### 7. filter.ts
- **30줄**: `FilteredPlan` 인터페이스에서 `is_completed: boolean` 제거
- **67줄**: select 쿼리에서 `is_completed` 제거
- **87줄**: `query.eq('is_completed', true)` → `query.eq('status', 'completed')`

### 8. carryover.ts
- **60줄**: `.eq('is_completed', false)` → `.neq('status', 'completed')`
- **319줄**: `.eq('is_completed', false)` → `.neq('status', 'completed')`

## 데이터베이스 스키마

`student_plan` 테이블의 `status` 컬럼:
- 타입: `text`
- CHECK 제약조건: `status IN ('pending', 'in_progress', 'completed', 'canceled')`
- 기본값: `'pending'`

## 참고사항

- `completed_start_page_or_time`, `completed_end_page_or_time` 컬럼은 다른 목적(진행 상황 추적)으로 사용되므로 유지
- `ad_hoc_plans` 테이블의 `completed_at` 필드는 별개이므로 영향 없음
- `student_plans` (복수형) 테이블을 사용하는 코드는 별도 확인 필요 (다른 테이블일 수 있음)

## 테스트 시나리오

1. **플랜 생성 테스트**
   - 관리자 페이지에서 플랜 생성 시도
   - 에러 없이 생성되는지 확인

2. **플랜 완료 토글 테스트**
   - QuickActions의 완료 버튼 클릭
   - status가 'completed'로 변경되는지 확인

3. **통계 대시보드 테스트**
   - SummaryDashboard에서 완료 플랜 수가 정확히 표시되는지 확인

4. **필터링 테스트**
   - filter.ts의 완료 플랜 필터가 정상 작동하는지 확인

5. **이월 기능 테스트**
   - carryover.ts의 미완료 플랜 조회가 정상 작동하는지 확인

## 변경 파일 목록

1. `app/(admin)/admin/students/[id]/plans/_components/QuickActions.tsx`
2. `app/(admin)/admin/students/[id]/plans/_components/SummaryDashboard.tsx`
3. `app/(admin)/admin/students/[id]/plans/_components/RedistributeModal.tsx`
4. `lib/domains/admin-plan/actions/createPlanFromContent.ts`
5. `lib/domains/admin-plan/actions/planTemplates.ts`
6. `lib/domains/admin-plan/actions/copyPlan.ts`
7. `lib/domains/admin-plan/actions/filter.ts`
8. `lib/domains/admin-plan/actions/carryover.ts`

## 마이그레이션

마이그레이션 불필요:
- `is_completed` 컬럼이 존재하지 않으므로 제거할 필요 없음
- `status` 컬럼은 이미 존재하고 정상 작동 중

## 완료일

2026-01-15



