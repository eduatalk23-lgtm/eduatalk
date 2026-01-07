# 플래너 → 플랜 그룹 상속 모델: 다음 진행 작업

**작성일**: 2026-01-06
**관련 계획 파일**: `/Users/johyeon-u/.claude/plans/streamed-seeking-horizon.md`

---

## 완료된 작업 요약

### Phase 1: 타입 정의 (완료)
- `AdminWizardData`에 `studyHours`, `selfStudyHours`, `lunchTime`, `nonStudyTimeBlocks` 추가
- `TimeRange`, `NonStudyTimeBlock` 인터페이스 정의

### Phase 2: Context 초기화 (완료)
- `AdminWizardContext.tsx` 기본값 초기화 로직 업데이트

### Phase 3: Step1BasicInfo 자동 채우기 (완료)
- `handlePlannerSelect()` 함수에서 플래너 시간 설정 자동 상속

### Phase 4: Step2TimeSettings UI (완료)
- 시간대 표시 섹션 (읽기 전용)
- 학원일정 travel_time 입력 UI

### Phase 5: 서버 사이드 통합 (완료)
- DB 마이그레이션: `plan_groups` 테이블에 `study_hours`, `self_study_hours`, `lunch_time` 컬럼 추가
- RPC 함수 업데이트: `create_plan_group_atomic`
- TypeScript 타입 업데이트: `PlanGroup`, `PlanGroupCreationData`, `TimeRange`
- `create.ts` 4개 함수에 새 필드 매핑

---

## 다음 진행 작업 제안

### 1. 스케줄러 로직 통합 (우선순위: 높음)

**목적**: 플랜 생성 시 저장된 시간 설정을 실제 스케줄링에 반영

**관련 파일**:
- `lib/scheduler/calculateAvailableDates.ts`
- `lib/scheduler/generateTimeSlots.ts`
- `lib/plan/services/TimeAllocationService.ts`

**작업 내용**:
```typescript
// 현재: 하드코딩된 기본값 사용
const DEFAULT_STUDY_HOURS = { start: "10:00", end: "19:00" };

// 개선: plan_group에서 저장된 값 사용
const studyHours = planGroup.study_hours ?? DEFAULT_STUDY_HOURS;
const lunchTime = planGroup.lunch_time ?? { start: "12:00", end: "13:00" };
```

**예상 소요**: 2-3시간

---

### 2. Step3SchedulePreview 강화 (우선순위: 중간)

**목적**: 플랜 생성 전 실제 가용 시간 시각화

**관련 파일**:
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step3SchedulePreview.tsx`

**작업 내용**:
- 주간 타임라인 뷰 구현
- 학습시간/점심시간/학원일정 시각적 표시
- 가용 시간 하이라이트
- 일별 가용 시간 합계 표시

**UI 예시**:
```
월  | ████░░░░████████░░████ | 가용: 6시간
화  | ████░░░░██████████████ | 가용: 8시간
수  | ████░░░░████████░░░░░░ | 가용: 5시간 (학원)
...
```

**예상 소요**: 4-6시간

---

### 3. 플래너 생성/수정 UI 개선 (우선순위: 중간)

**목적**: 플래너 설정 관리 UX 향상

**관련 파일**:
- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx`

**작업 내용**:
- 시간 설정 폼 UI 개선 (TimePicker 컴포넌트)
- 비학습 블록 관리 UI (추가/삭제/수정)
- 제외일/학원일정 일괄 관리
- 플래너 복제 기능

**예상 소요**: 4-5시간

---

### 4. 플래너 해제 시 정리 로직 (우선순위: 중간)

**목적**: 플래너 연결 해제 시 상속된 설정 적절히 처리

**관련 파일**:
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo.tsx`

**작업 내용**:
```typescript
// 플래너 해제 시
if (!selectedPlannerId) {
  updateData({
    plannerId: undefined,
    studyHours: null,
    selfStudyHours: null,
    lunchTime: null,
    nonStudyTimeBlocks: [],
    // is_locked 항목만 제거, 수동 추가 항목 유지
    exclusions: wizardData.exclusions.filter(e => !e.is_locked),
    academySchedules: wizardData.academySchedules.filter(s => !s.is_locked),
  });
}
```

**예상 소요**: 1-2시간

---

### 5. 데이터 마이그레이션 (우선순위: 낮음)

**목적**: 기존 플랜 그룹에 플래너 시간 설정 백필

**작업 내용**:
- 마이그레이션 스크립트 작성
- `planner_id`가 있는 기존 `plan_groups`에 플래너 시간 설정 복사
- 검증 쿼리 작성

**SQL 예시**:
```sql
UPDATE plan_groups pg
SET
  study_hours = p.study_hours,
  self_study_hours = p.self_study_hours,
  lunch_time = p.lunch_time
FROM planners p
WHERE pg.planner_id = p.id
  AND pg.study_hours IS NULL;
```

**예상 소요**: 1-2시간

---

### 6. E2E 테스트 작성 (우선순위: 낮음)

**목적**: 플래너 → 플랜 그룹 상속 플로우 자동화 테스트

**관련 파일**:
- `tests/e2e/admin-wizard/planner-inheritance.spec.ts` (신규)

**테스트 시나리오**:
1. 플래너 생성 → 시간 설정 입력
2. 플랜 그룹 생성 → 플래너 선택 → 자동 채우기 확인
3. 플랜 생성 → DB에 시간 설정 저장 확인
4. 플래너 해제 → 상속 설정 정리 확인

**예상 소요**: 3-4시간

---

### 7. 학생 위저드 동기화 (우선순위: 낮음)

**목적**: Student 위저드에도 동일한 시간 설정 지원

**관련 파일**:
- `app/(student)/plan/new-group/_components/_context/types.ts`
- `app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings.tsx`

**작업 내용**:
- Student 위저드 타입에 시간 설정 필드 추가
- Student용 플래너 선택 UI (선택적)
- 시간 설정 표시 UI

**예상 소요**: 3-4시간

---

## 권장 진행 순서

| 순서 | 작업 | 이유 |
|------|------|------|
| 1 | 스케줄러 로직 통합 | 핵심 기능, 저장된 데이터 활용 |
| 2 | 플래너 해제 시 정리 로직 | 버그 방지, UX 완성도 |
| 3 | Step3SchedulePreview 강화 | 사용자 확인 가능, UX 향상 |
| 4 | 플래너 생성/수정 UI 개선 | 관리자 경험 향상 |
| 5 | 데이터 마이그레이션 | 기존 데이터 정합성 |
| 6 | E2E 테스트 | 안정성 확보 |
| 7 | 학생 위저드 동기화 | 기능 확장 |

---

## 관련 파일 목록

### 위저드
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/types.ts`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/AdminWizardContext.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step3SchedulePreview.tsx`

### 플래너
- `lib/domains/admin-plan/actions/planners.ts`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`
- `app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx`

### 플랜 생성
- `lib/domains/plan/actions/plan-groups/create.ts`
- `lib/types/plan/domain.ts`
- `lib/types/plan/input.ts`

### 스케줄러
- `lib/scheduler/calculateAvailableDates.ts`
- `lib/scheduler/generateTimeSlots.ts`
- `lib/plan/services/TimeAllocationService.ts`

### 마이그레이션
- `supabase/migrations/` (시간 설정 컬럼 추가 마이그레이션)
