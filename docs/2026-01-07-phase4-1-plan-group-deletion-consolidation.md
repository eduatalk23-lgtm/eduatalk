# Phase 4.1: 플랜 그룹 삭제 로직 통합 및 중복 코드 제거

## 작업 개요

**작업 일자**: 2026-01-07  
**우선순위**: MEDIUM  
**상태**: 완료 ✅

## 목표

`lib/domains/camp/actions/student.ts`에 중복된 플랜 그룹 삭제 코드를 유틸리티 함수로 추출하여 코드 중복을 제거하고 일관성을 유지했습니다.

## 문제점

`lib/domains/camp/actions/student.ts`에 3곳에서 동일한 패턴의 플랜 그룹 삭제 코드가 중복되어 있었습니다:

1. **745줄**: `plan_contents` 삭제 → `plan_groups` 삭제 (이미 `student_plan` 삭제는 위에서 수행)
2. **1070-1073줄**: `student_plan` 삭제 → `plan_contents` 삭제 → `plan_groups` 삭제
3. **1178-1181줄**: `student_plan` 삭제 → `plan_contents` 삭제 → `plan_groups` 삭제

**중복 코드의 문제점**:
- 코드 중복으로 유지보수 어려움
- 삭제 순서나 로직 변경 시 여러 곳을 수정해야 함
- 에러 처리 로직이 일관되지 않음

## 구현 내용

### 1. 유틸리티 함수 생성

`lib/domains/plan/utils/planGroupDeletion.ts` 파일을 생성하여 플랜 그룹 삭제 로직을 통합했습니다.

**주요 기능**:
- `deletePlanGroupCascade` 함수: 플랜 그룹과 관련 데이터를 캐스케이드 삭제
- Hard delete와 soft delete 옵션 지원
- `plan_exclusions` 삭제 옵션 (기본값: false, 전역 관리이므로 삭제하지 않음)
- 일관된 에러 처리 및 로깅

**함수 시그니처**:
```typescript
export async function deletePlanGroupCascade(
  groupId: string,
  options: DeletePlanGroupCascadeOptions
): Promise<DeletePlanGroupCascadeResult>
```

**옵션**:
- `studentId`: 학생 ID (필수)
- `hardDelete`: Hard delete 여부 (기본값: false, soft delete)
- `deleteExclusions`: plan_exclusions 삭제 여부 (기본값: false)

**삭제 순서**:
1. `student_plan` 삭제 (hard delete)
2. `plan_contents` 삭제 (hard delete)
3. `plan_exclusions` 삭제 (옵션, 기본값: false)
4. `plan_groups` 삭제 (hard delete 또는 soft delete)

### 2. 중복 코드 대체

3곳의 중복 코드를 유틸리티 함수 호출로 대체했습니다:

#### 2.1. submitCampParticipation 함수 (745줄)

**변경 전**:
```typescript
const { error: deleteExistingError } = await supabase
  .from("student_plan")
  .delete()
  .eq("plan_group_id", existingGroupByTemplate.id);

if (deleteExistingError) {
  // 에러 처리
} else {
  await supabase.from("plan_contents").delete().eq("plan_group_id", existingGroupByTemplate.id);
  await supabase.from("plan_groups").delete().eq("id", existingGroupByTemplate.id);
}
```

**변경 후**:
```typescript
const deleteResult = await deletePlanGroupCascade(existingGroupByTemplate.id, {
  studentId: user.userId,
  hardDelete: true,
  deleteExclusions: false,
});
```

#### 2.2. declineCampInvitation 함수 (1070-1073줄)

**변경 전**:
```typescript
if (draftGroup) {
  await supabase.from("student_plan").delete().eq("plan_group_id", draftGroup.id);
  await supabase.from("plan_contents").delete().eq("plan_group_id", draftGroup.id);
  await supabase.from("plan_groups").delete().eq("id", draftGroup.id);
}
```

**변경 후**:
```typescript
if (draftGroup) {
  const deleteResult = await deletePlanGroupCascade(draftGroup.id, {
    studentId: user.userId,
    hardDelete: true,
    deleteExclusions: false,
  });
  // 에러 처리
}
```

#### 2.3. cancelCampParticipation 함수 (1178-1181줄)

**변경 전**:
```typescript
if (planGroup) {
  await supabase.from("student_plan").delete().eq("plan_group_id", planGroup.id);
  await supabase.from("plan_contents").delete().eq("plan_group_id", planGroup.id);
  await supabase.from("plan_groups").delete().eq("id", planGroup.id);
}
```

**변경 후**:
```typescript
if (planGroup) {
  const deleteResult = await deletePlanGroupCascade(planGroup.id, {
    studentId: user.userId,
    hardDelete: true,
    deleteExclusions: false,
  });
  // 에러 처리
}
```

## 변경된 파일

- `lib/domains/plan/utils/planGroupDeletion.ts` (신규)
  - `deletePlanGroupCascade` 함수 구현
  - 타입 정의 (`DeletePlanGroupCascadeOptions`, `DeletePlanGroupCascadeResult`)

- `lib/domains/camp/actions/student.ts` (수정)
  - `deletePlanGroupCascade` import 추가
  - 3곳의 중복 코드를 유틸리티 함수 호출로 대체

## 개선 효과

1. **코드 중복 제거**: 3곳의 중복 코드를 1개의 유틸리티 함수로 통합
2. **일관성 향상**: 모든 플랜 그룹 삭제가 동일한 로직을 사용
3. **유지보수성 향상**: 삭제 로직 변경 시 한 곳만 수정하면 됨
4. **에러 처리 개선**: 일관된 에러 처리 및 로깅
5. **테스트 용이성**: 유틸리티 함수를 독립적으로 테스트 가능

## 참고

- 기존 RPC 함수 `delete_plan_group_cascade`는 soft delete를 사용하지만, 캠프 관련 코드에서는 hard delete가 필요하므로 유틸리티 함수에서 옵션으로 제공
- `plan_exclusions`는 전역 관리 데이터이므로 기본적으로 삭제하지 않음 (옵션으로 제공)

## 다음 단계

- [ ] 유틸리티 함수에 대한 단위 테스트 작성
- [ ] 다른 곳에서도 유사한 패턴이 있는지 확인 및 통합

---

**작업 완료 일자**: 2026-01-07  
**커밋**: `feat: Phase 4.1 - 플랜 그룹 삭제 로직 통합 및 중복 코드 제거`

