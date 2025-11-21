# 플랜 회차 계산 로직 개선

## 작업 일시
2025-01-XX

## 문제점
플랜번호처럼 쪼개진 플랜에 대한 회차도 같은 회차로 계산되지 않는 문제가 있었습니다.

### 발견된 문제
- 같은 `plan_number`를 가진 플랜들(쪼개진 플랜)이 서로 다른 회차로 계산됨
- 회차 계산 시 `plan_number`를 고려하지 않음

## 해결 방법

### 1. 회차 계산 로직 수정
같은 `plan_number`를 가진 플랜들은 같은 회차를 가지도록 회차 계산 로직을 수정했습니다.

**수정된 파일:**
1. `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`
2. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
3. `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`

**회차 계산 로직:**
- 같은 `content_id`를 가진 플랜들 중에서
- `plan_number`가 null이 아닌 경우, 같은 `plan_number`를 가진 첫 번째 플랜의 회차를 사용
- `plan_number`가 null인 경우, 날짜 순서대로 개별 카운트
- 같은 `plan_number`를 가진 그룹은 한 번만 카운트

### 2. plan_number 필드 추가
`_getScheduleResultData` 함수에서 반환하는 plans 배열에 `plan_number` 필드를 추가했습니다.

**수정된 파일:**
- `app/(student)/actions/planGroupActions.ts`

**변경 사항:**
- `_getScheduleResultData` 함수의 반환 타입에 `plan_number: number | null` 추가
- 플랜 조회 시 `plan_number` 컬럼 포함
- 반환 데이터에 `plan_number` 필드 추가

### 3. 타입 정의 업데이트
회차 계산에 필요한 타입 정의에 `plan_number` 필드를 추가했습니다.

**수정된 타입:**
- `PlanPreview` (PlanPreviewDialog.tsx)
- `Plan` (ScheduleTableView.tsx)
- `PlanData` (scheduleTransform.ts)

## 회차 정보 저장 여부

### 답변
**회차(sequence) 정보는 데이터베이스에 저장되지 않습니다.**

회차는 UI에서만 계산되어 표시됩니다. 데이터베이스에는 다음 정보만 저장됩니다:

- `plan_number`: 플랜 그룹 내에서의 논리적 플랜 번호 (같은 플랜이 여러 블록에 걸쳐 쪼개진 경우 동일한 번호 사용)
- `student_plan` 테이블의 `plan_number` 컬럼에 저장됨

회차는 같은 `content_id`를 가진 플랜들 중에서 `plan_number`를 고려하여 날짜 순서대로 계산됩니다.

## 수정된 파일 목록
1. `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx` - 회차 계산 로직 수정
2. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx` - 회차 계산 로직 수정 및 타입 업데이트
3. `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - 회차 계산 로직 수정 및 타입 업데이트
4. `app/(student)/actions/planGroupActions.ts` - `plan_number` 필드 추가

## 개선 효과
- 쪼개진 플랜들이 같은 회차로 표시됨
- 플랜번호와 회차의 일관성 유지
- 사용자가 플랜을 더 쉽게 이해할 수 있음

