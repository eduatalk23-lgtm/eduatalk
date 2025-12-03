# 캠프 템플릿 생성 시 시간 관리 동기화 에러 수정

## 문제 상황

관리자가 캠프 템플릿을 생성할 때 아래 에러가 발생했습니다:

1. **"학생 권한이 필요합니다"** 에러
   - `syncTimeManagementExclusionsAction` 호출 시 발생
   - `requireStudentAuth()` 함수가 학생 권한만 허용

2. **"학생 ID가 필요합니다"** 에러
   - `syncTimeManagementAcademySchedulesAction` 호출 시 발생
   - 템플릿 모드에서 `groupId`와 `studentId`가 모두 없을 때 발생

## 원인 분석

### 1. `syncTimeManagementExclusions` 함수
- `requireStudentAuth()`를 사용하여 학생 권한만 허용
- 관리자/컨설턴트 모드를 지원하지 않음
- 템플릿 모드에서 `studentId`가 없을 때 처리 로직 없음

### 2. `syncTimeManagementAcademySchedules` 함수
- 관리자 모드는 지원하지만, `groupId`가 없을 때 `studentId`가 필수
- 템플릿 모드에서는 `studentId`가 없을 수 있음
- `studentId`가 없으면 에러를 throw

### 3. 호출 위치
- `ExclusionsPanel`: 제외일 불러오기 버튼 클릭 시
- `AcademySchedulePanel`: 학원 일정 불러오기 버튼 클릭 시
- 템플릿 모드에서도 이 버튼들이 표시됨

## 해결 방법

### 1. `syncTimeManagementExclusions` 함수 수정

**파일**: `app/(student)/actions/plan-groups/exclusions.ts`

**변경 사항**:
- `requireStudentAuth()` → `getCurrentUserRole()`로 변경하여 관리자 모드 지원
- `getTenantContext()` 사용 (기존 `requireTenantContext()` 대신)
- 관리자/컨설턴트 모드일 때 `getPlanGroupByIdForAdmin` 사용
- 템플릿 모드에서 `studentId`가 없으면 빈 결과 반환

```typescript
async function _syncTimeManagementExclusions(
  groupId: string | null,
  periodStart: string,
  periodEnd: string,
  studentId?: string  // 새로 추가된 파라미터
): Promise<{...}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();
  
  // 관리자/컨설턴트 모드 처리
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  let targetStudentId: string;
  
  if (groupId) {
    // 플랜 그룹이 있는 경우
    if (isAdminOrConsultant) {
      group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
      targetStudentId = studentId || group.student_id;
    } else {
      group = await getPlanGroupById(groupId, userId, tenantContext.tenantId);
      targetStudentId = userId;
    }
  } else {
    // groupId가 없는 경우 (템플릿 모드)
    if (isAdminOrConsultant) {
      if (!studentId) {
        // 템플릿 모드에서는 빈 결과 반환
        return { count: 0, exclusions: [] };
      }
      targetStudentId = studentId;
    } else {
      targetStudentId = userId;
    }
  }
  
  // ... 나머지 로직
}
```

### 2. `syncTimeManagementAcademySchedules` 함수 수정

**파일**: `app/(student)/actions/plan-groups/academy.ts`

**변경 사항**:
- 템플릿 모드에서 `studentId`가 없으면 빈 결과 반환 (에러 throw 대신)

```typescript
} else {
  // groupId가 없는 경우
  if (isAdminOrConsultant) {
    // 관리자 모드: studentId 파라미터 필수
    if (!studentId) {
      // 템플릿 모드에서는 빈 결과 반환
      return {
        count: 0,
        academySchedules: [],
      };
    }
    targetStudentId = studentId;
  } else {
    // 학생 모드: 현재 사용자 ID 사용
    targetStudentId = userId;
  }
}
```

### 3. `ExclusionsPanel` 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`

**변경 사항**:
- `syncTimeManagementExclusionsAction` 호출 시 `studentId` 파라미터 추가
- 템플릿 모드에서는 `undefined` 전달

```typescript
const result = await syncTimeManagementExclusionsAction(
  groupId || null,
  periodStart,
  periodEnd,
  undefined // studentId는 템플릿 모드에서 사용하지 않음
);
```

## 수정된 파일 목록

1. `app/(student)/actions/plan-groups/exclusions.ts`
   - 관리자 모드 지원 추가
   - 템플릿 모드 처리 추가

2. `app/(student)/actions/plan-groups/academy.ts`
   - 템플릿 모드에서 빈 결과 반환하도록 수정

3. `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`
   - `studentId` 파라미터 전달 추가

## 테스트 시나리오

### ✅ 정상 동작 시나리오

1. **학생 모드**: 기존과 동일하게 동작
2. **관리자 모드 (플랜 그룹 수정)**: `groupId`와 `studentId`가 있으면 정상 동작
3. **템플릿 모드**: `studentId`가 없어도 빈 결과 반환하여 에러 없음

### ❌ 에러 발생 시나리오 (수정 전)

1. **템플릿 생성 시 제외일 불러오기**: "학생 권한이 필요합니다" 에러
2. **템플릿 생성 시 학원 일정 불러오기**: "학생 ID가 필요합니다" 에러

## 추가 고려사항

- 템플릿 모드에서 시간 관리 데이터를 불러오는 것은 의미가 없으므로, 빈 결과를 반환하는 것이 적절합니다.
- 향후 템플릿 생성 시 특정 학생의 시간 관리 데이터를 미리보기로 불러오고 싶다면, `studentId`를 선택할 수 있는 UI를 추가할 수 있습니다.

## 관련 이슈

- 캠프 템플릿 생성 플로우 개선 필요
- 템플릿 모드에서 시간 관리 데이터 불러오기 기능 제한


