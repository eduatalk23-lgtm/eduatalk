# 캠프 모드에서 학생 권한 요청 부분 점검

## 점검 개요

캠프 모드에서 Admin/Consultant가 사용할 수 있는지 확인하기 위해 학생 권한을 요청하는 부분들을 점검했습니다.

## 점검 결과

### ✅ 이미 Admin/Consultant 지원이 완료된 부분

#### 1. `generatePlansFromGroupAction` (플랜 생성)
- **파일**: `app/(student)/actions/plan-groups/plans.ts`
- **상태**: ✅ Admin/Consultant 지원 완료
- **이유**: `verifyPlanGroupAccess()` 함수를 사용하여 Admin/Consultant 권한도 허용
- **참고**: `lib/auth/planGroupAuth.ts`의 `verifyPlanGroupAccess` 함수가 `allowedRoles: ["student", "admin", "consultant"]`를 허용

#### 2. `getCampPlanGroupForReview` (플랜 그룹 조회)
- **파일**: `app/(admin)/actions/campTemplateActions.ts`
- **상태**: ✅ Admin/Consultant 전용 함수
- **이유**: Admin/Consultant 권한 체크 후 `getPlanGroupWithDetailsForAdmin` 사용

#### 3. `continueCampStepsForAdmin` (남은 단계 진행)
- **파일**: `app/(admin)/actions/campTemplateActions.ts`
- **상태**: ✅ Admin/Consultant 전용 함수
- **이유**: 
  - 직접 Supabase를 사용하여 플랜 그룹 업데이트
  - `generatePlansFromGroupAction` 호출 시 `verifyPlanGroupAccess`가 Admin/Consultant를 허용

### ✅ 학생 전용으로 유지해야 하는 부분

#### 1. `submitCampParticipation` (캠프 참여 정보 제출)
- **파일**: `app/(student)/actions/campActions.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 캠프 참여 정보를 제출하는 함수이므로 학생만 사용해야 함
- **권한 체크**: `user.role !== "student"` 체크

#### 2. `getStudentCampInvitations` (학생의 캠프 초대 목록 조회)
- **파일**: `app/(student)/actions/campActions.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 초대 목록을 조회하는 함수이므로 학생만 사용해야 함

#### 3. `getCampInvitationWithTemplate` (캠프 초대 상세 조회)
- **파일**: `app/(student)/actions/campActions.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 초대를 조회하는 함수이므로 학생만 사용해야 함

#### 4. `_createPlanGroup` (플랜 그룹 생성)
- **파일**: `app/(student)/actions/plan-groups/create.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 
  - 학생이 자신의 플랜 그룹을 생성하는 함수
  - `campTemplateActions.ts`의 `continueCampStepsForAdmin`에서는 직접 Supabase를 사용하여 플랜 그룹을 업데이트하므로 이 함수를 사용하지 않음
  - 내부에서 `user.userId`를 `student_id`로 사용하므로 학생 전용이어야 함

#### 5. `_savePlanGroupDraft` (플랜 그룹 임시저장)
- **파일**: `app/(student)/actions/plan-groups/create.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 플랜 그룹을 임시저장하는 함수

#### 6. `_copyPlanGroup` (플랜 그룹 복사)
- **파일**: `app/(student)/actions/plan-groups/create.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 플랜 그룹을 복사하는 함수

#### 7. `_getPlansByGroupId` (플랜 목록 조회)
- **파일**: `app/(student)/actions/plan-groups/plans.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 
  - 학생이 자신의 플랜을 조회하는 함수
  - Admin은 `getCampPlanGroupForReview`를 사용하여 플랜 그룹 정보를 조회

#### 8. `_checkPlansExist` (플랜 존재 확인)
- **파일**: `app/(student)/actions/plan-groups/plans.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 
  - 학생이 자신의 플랜 존재 여부를 확인하는 함수
  - Admin은 `getCampPlanGroupForReview`를 사용하여 플랜 그룹 정보를 조회

#### 9. `_getActivePlanGroups` (활성 플랜 그룹 조회)
- **파일**: `app/(student)/actions/plan-groups/plans.ts`
- **상태**: ✅ 학생 전용 (의도된 동작)
- **이유**: 학생이 자신의 활성 플랜 그룹을 조회하는 함수

## 수정 사항

### 1. 오래된 주석 업데이트

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**변경 전**:
```typescript
// generatePlansFromGroupAction은 학생 권한만 허용하므로,
// 관리자용으로 별도 처리 필요
// 일단은 generatePlansFromGroupAction을 호출하되,
// planGroupActions.ts에서 관리자 권한을 지원하도록 수정 필요
```

**변경 후**:
```typescript
// generatePlansFromGroupAction은 verifyPlanGroupAccess를 사용하여
// Admin/Consultant 권한도 지원합니다 (planGroupAuth.ts 참조)
```

## 권한 체크 패턴

### Admin/Consultant 지원 패턴

1. **`verifyPlanGroupAccess()` 사용**
   - `lib/auth/planGroupAuth.ts`의 함수
   - `allowedRoles: ["student", "admin", "consultant"]` 허용
   - 사용 예: `_generatePlansFromGroup`

2. **`getPlanGroupWithDetailsByRole()` 사용**
   - 역할에 따라 적절한 함수 호출
   - Admin/Consultant: `getPlanGroupWithDetailsForAdmin`
   - Student: `getPlanGroupWithDetails`

3. **`getStudentIdForPlanGroup()` 사용**
   - 역할에 따라 실제 사용할 studentId 반환
   - Admin/Consultant: `group.student_id`
   - Student: `userId`

4. **`shouldBypassStatusCheck()` 사용**
   - 캠프 모드이거나 Admin/Consultant인 경우 상태 체크 우회

### 학생 전용 패턴

1. **`requireStudentAuth()` 사용**
   - 학생 권한만 허용
   - 사용 예: `_createPlanGroup`, `_savePlanGroupDraft`

2. **`user.role !== "student"` 체크**
   - 간단한 권한 체크
   - 사용 예: `submitCampParticipation`, `getStudentCampInvitations`

## 결론

캠프 모드에서 Admin/Consultant가 필요한 기능들은 이미 지원되고 있습니다:

1. ✅ 플랜 그룹 조회 (`getCampPlanGroupForReview`)
2. ✅ 플랜 그룹 업데이트 (`continueCampStepsForAdmin`)
3. ✅ 플랜 생성 (`generatePlansFromGroupAction`)

학생 전용으로 유지해야 하는 기능들도 의도된 대로 학생만 사용할 수 있도록 올바르게 구현되어 있습니다.

## 관련 파일

- `app/(admin)/actions/campTemplateActions.ts` - Admin/Consultant 전용 캠프 관련 액션
- `app/(student)/actions/campActions.ts` - 학생 전용 캠프 관련 액션
- `app/(student)/actions/plan-groups/plans.ts` - 플랜 생성 (Admin/Consultant 지원)
- `app/(student)/actions/plan-groups/create.ts` - 플랜 그룹 생성 (학생 전용)
- `lib/auth/planGroupAuth.ts` - 플랜 그룹 권한 관리

## 완료 일자

2025-02-02

