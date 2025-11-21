# 플랜 회차 정보 저장 구현

## 작업 일시
2025-11-26

## 작업 내용
회차(sequence) 정보를 데이터베이스에 저장하도록 구현했습니다.

## 구현 사항

### 1. 데이터베이스 마이그레이션
`student_plan` 테이블에 `sequence` 컬럼을 추가하는 마이그레이션 파일을 생성했습니다.

**파일:** `supabase/migrations/20251126000001_add_sequence_to_student_plan.sql`

**추가된 컬럼:**
- `sequence`: integer (nullable)
- 같은 `content_id`를 가진 플랜들 중에서의 회차 번호
- 같은 `plan_number`를 가진 플랜들은 같은 회차를 가짐
- 학습 플랜에만 부여 (학원일정, 이동시간, 점심시간, 자율학습은 null)

**인덱스:**
- `idx_student_plan_sequence`: sequence 컬럼 인덱스
- `idx_student_plan_group_content_sequence`: 복합 인덱스 (plan_group_id, content_id, sequence)
- `idx_student_plan_content_sequence`: 복합 인덱스 (content_id, sequence)

### 2. 플랜 생성 시 회차 계산 및 저장
플랜 생성 후 자동으로 회차를 계산하여 저장하도록 구현했습니다.

**구현 위치:** `app/(student)/actions/planGroupActions.ts`의 `_generatePlansFromGroup` 함수

**회차 계산 로직:**
1. 생성된 플랜들을 조회 (일반 플랜만, 더미 플랜 제외)
2. `content_id`별로 그룹화
3. 각 `content_id`별로:
   - 날짜와 `block_index` 순으로 정렬
   - `plan_number`를 고려하여 회차 계산
   - 같은 `plan_number`를 가진 플랜들은 같은 회차 부여
   - `plan_number`가 null인 경우 개별 카운트
4. 계산된 회차를 배치로 업데이트

### 3. 플랜 조회 시 sequence 필드 포함
플랜 조회 시 `sequence` 필드를 포함하도록 수정했습니다.

**수정된 함수:**
- `_getScheduleResultData`: `sequence` 필드 추가
- `_getPlansByGroupId`: `sequence` 필드 추가

### 4. 타입 정의 업데이트
회차 정보를 포함하도록 타입 정의를 업데이트했습니다.

**수정된 타입:**
- `Plan` (ScheduleTableView.tsx): `sequence: number | null` 추가
- `PlanData` (scheduleTransform.ts): `sequence: number | null` 추가

### 5. UI에서 저장된 회차 사용
저장된 `sequence`가 있으면 우선 사용하고, 없으면 계산하도록 수정했습니다.

**수정된 파일:**
- `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
  - `calculateSequenceForPlan` 함수: 저장된 `sequence` 우선 사용
- `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`
  - 저장된 `sequence` 우선 사용

## 회차 계산 규칙

1. **같은 content_id를 가진 플랜들**에 대해 회차 계산
2. **날짜 순서**로 정렬하여 회차 부여
3. **plan_number 고려:**
   - 같은 `plan_number`를 가진 플랜들은 같은 회차
   - `plan_number`가 null인 경우 개별 카운트
4. **비학습 항목** (학원일정, 이동시간, 점심시간, 자율학습)은 회차가 null

## 수정된 파일 목록

1. `supabase/migrations/20251126000001_add_sequence_to_student_plan.sql` - 마이그레이션 파일 생성
2. `app/(student)/actions/planGroupActions.ts` - 회차 계산 및 저장 로직 추가
3. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx` - 저장된 회차 사용
4. `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - 저장된 회차 사용
5. 타입 정의 업데이트 (Plan, PlanData)

## 개선 효과

- 회차 정보가 데이터베이스에 저장되어 조회 성능 향상
- 회차 계산 로직이 한 곳에서 관리되어 유지보수 용이
- 저장된 회차를 우선 사용하여 계산 비용 절감
- 플랜 그룹별로 독립적인 회차 관리 가능

