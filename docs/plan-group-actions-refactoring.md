# planGroupActions.ts 분리 및 모듈화 작업 완료

## 작업 개요

`app/(student)/actions/planGroupActions.ts` 파일이 5850+ 줄로 매우 크고 복잡했기 때문에, 기능별로 모듈화하여 유지보수성을 향상시켰습니다.

## 모듈 구조

### 1. `plan-groups/create.ts`
플랜 그룹 생성 관련 함수들:
- `createPlanGroupAction`: 플랜 그룹 생성 (JSON 데이터)
- `savePlanGroupDraftAction`: 플랜 그룹 임시저장
- `copyPlanGroupAction`: 플랜 그룹 복사

### 2. `plan-groups/update.ts`
플랜 그룹 업데이트 관련 함수들:
- `updatePlanGroupDraftAction`: 플랜 그룹 임시저장 업데이트
- `updatePlanGroupAction`: 플랜 그룹 업데이트

### 3. `plan-groups/delete.ts`
플랜 그룹 삭제 관련 함수들:
- `deletePlanGroupAction`: 플랜 그룹 삭제 (Soft Delete)

### 4. `plan-groups/status.ts`
플랜 그룹 상태 관리 관련 함수들:
- `updatePlanGroupStatus`: 플랜 그룹 상태 업데이트

### 5. `plan-groups/plans.ts`
플랜 생성/미리보기 관련 함수들:
- `generatePlansFromGroupAction`: 플랜 그룹에서 개별 플랜 생성
- `previewPlansFromGroupAction`: 플랜 그룹에서 개별 플랜 미리보기

### 6. `plan-groups/queries.ts`
조회 관련 함수들:
- `getPlansByGroupIdAction`: 플랜 그룹의 플랜 목록 조회
- `checkPlansExistAction`: 플랜 그룹에 플랜이 생성되었는지 확인
- `getScheduleResultDataAction`: 플랜 그룹의 스케줄 결과 데이터 조회
- `getActivePlanGroups`: 활성 상태인 다른 플랜 그룹 조회

### 7. `plan-groups/exclusions.ts`
제외일 관련 함수들:
- `addPlanExclusion`: 플랜 그룹 제외일 추가
- `deletePlanExclusion`: 플랜 그룹 제외일 삭제
- `syncTimeManagementExclusionsAction`: 시간 관리 데이터 반영 (제외일)

### 8. `plan-groups/academy.ts`
학원 관련 함수들:
- `addAcademySchedule`: 플랜 그룹 학원 일정 추가
- `updateAcademySchedule`: 플랜 그룹 학원 일정 수정
- `deleteAcademySchedule`: 플랜 그룹 학원 일정 삭제
- `getAcademySchedulesAction`: 플랜 그룹 학원 일정 조회
- `createAcademy`: 학원 생성
- `updateAcademy`: 학원 수정
- `deleteAcademy`: 학원 삭제
- `syncTimeManagementAcademySchedulesAction`: 시간 관리 데이터 반영 (학원일정)

### 9. `plan-groups/utils.ts`
유틸리티 함수들:
- `normalizePlanPurpose`: plan_purpose 값 정규화
- `timeToMinutes`: 시간 문자열을 분 단위로 변환

## 리팩토링 결과

### Before
- 단일 파일: `planGroupActions.ts` (5850+ 줄)
- 모든 함수가 하나의 파일에 집중
- 유지보수 어려움

### After
- 모듈화된 구조: 9개의 파일로 분리
- 기능별로 명확하게 분리
- 유지보수 용이성 향상
- 원본 파일은 re-export만 담당하여 하위 호환성 유지

## 하위 호환성

기존 코드에서 `planGroupActions.ts`를 import하는 모든 경로는 그대로 작동합니다. 원본 파일이 각 모듈에서 export한 함수들을 re-export하도록 구성되어 있습니다.

```typescript
// 기존 코드 (변경 불필요)
import { createPlanGroupAction } from "@/app/(student)/actions/planGroupActions";
```

## 다음 단계

1. ✅ 모듈 분리 완료
2. ✅ 하위 호환성 유지
3. ⏳ 테스트 및 검증 (필요시)
4. ⏳ 추가 리팩토링 (필요시)

## 참고 사항

- 모든 함수는 `withErrorHandling`으로 래핑되어 에러 처리가 일관되게 이루어집니다.
- 각 모듈은 독립적으로 작동하며, 필요한 경우 다른 모듈을 import하여 사용합니다.
- `utils.ts`의 유틸리티 함수들은 여러 모듈에서 공통으로 사용됩니다.

