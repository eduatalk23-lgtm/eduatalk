# 캠프 모드 플랜 생성 권한 문제 수정

**작업 일시**: 2025-11-27  
**관련 이슈**: 캠프 모드에서 관리자가 플랜을 생성할 때 권한 문제 발생

## 문제 상황

캠프 모드에서 관리자가 플랜을 생성할 때 다음 에러가 발생했습니다:

```
플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.
```

### 원인 분석

1. `app/(admin)/actions/campTemplateActions.ts`의 `continueCampStepsForAdmin` 함수에서 플랜을 생성할 때 `generatePlansFromGroupAction`을 호출합니다.

2. 이 함수는 `app/(student)/actions/plan-groups/plans.ts`의 `_generatePlansFromGroup` 함수를 호출합니다.

3. `_generatePlansFromGroup` 함수의 81-87번 줄에서 플랜 그룹의 상태가 "saved" 또는 "active"가 아니면 에러를 던집니다.

4. 하지만 캠프 모드에서는 관리자가 플랜을 생성할 때 플랜 그룹이 아직 "draft" 상태일 수 있습니다.

## 수정 내용

### 1. 플랜 생성 함수 수정 (`_generatePlansFromGroup`)

**파일**: `app/(student)/actions/plan-groups/plans.ts`

**변경 사항**:
- 관리자/컨설턴트 권한이거나 캠프 모드일 때는 상태 체크를 우회하도록 수정
- "draft" 상태에서도 플랜 생성 가능하도록 변경

```typescript
// 수정 전
// 2. 상태 확인
if (group.status !== "saved" && group.status !== "active") {
  throw new AppError(
    "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

// 수정 후
// 2. 상태 확인
// 관리자/컨설턴트 권한이거나 캠프 모드일 때는 상태 체크 우회 (draft 상태에서도 플랜 생성 가능)
const isAdminOrConsultant = role === "admin" || role === "consultant";
const isCampMode = group.plan_type === "camp";

if (!isAdminOrConsultant && !isCampMode) {
  // 일반 학생 모드에서만 상태 체크
  if (group.status !== "saved" && group.status !== "active") {
    throw new AppError(
      "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}
```

### 2. 플랜 미리보기 함수 수정 (`_previewPlansFromGroup`)

**파일**: `app/(student)/actions/plan-groups/plans.ts`

**변경 사항**:
- 플랜 미리보기 함수에도 동일한 로직 적용
- 관리자/컨설턴트 권한이거나 캠프 모드일 때는 상태 체크를 우회

```typescript
// 수정 전
// 2. 상태 확인
if (group.status !== "saved" && group.status !== "active") {
  throw new AppError(
    "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

// 수정 후
// 2. 상태 확인
// 관리자/컨설턴트 권한이거나 캠프 모드일 때는 상태 체크 우회 (draft 상태에서도 플랜 미리보기 가능)
const isCampMode = group.plan_type === "camp";

if (!isAdminOrConsultant && !isCampMode) {
  // 일반 학생 모드에서만 상태 체크
  if (group.status !== "saved" && group.status !== "active") {
    throw new AppError(
      "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}
```

## 수정 효과

1. **캠프 모드에서 관리자가 플랜 생성 가능**: 플랜 그룹이 "draft" 상태에서도 관리자가 플랜을 생성할 수 있습니다.

2. **일반 학생 모드 보호 유지**: 일반 학생 모드는 기존과 동일하게 "saved" 또는 "active" 상태에서만 플랜 생성 가능합니다.

3. **플랜 미리보기 기능도 동일하게 수정**: 관리자가 캠프 모드에서 플랜을 미리볼 때도 동일한 권한 우회가 적용됩니다.

## 추가 확인 사항

### 관리자 페이지에서의 사용

관리자 페이지(`/admin/camp-templates/[id]/participants/[groupId]/continue`)에서:
- `PlanGroupWizard` 컴포넌트에 `isAdminMode={true}`, `isAdminContinueMode={true}` props 전달
- Step 6에서 "플랜 생성하기" 버튼 클릭 시 `generatePlansFromGroupAction` 호출
- Step 7에서 "플랜 미리보기 및 재생성" 버튼 클릭 시 `PlanPreviewDialog` 사용
- `PlanPreviewDialog`에서 "플랜 미리보기" 버튼 클릭 시 `previewPlansFromGroupAction` 호출
- `PlanPreviewDialog`에서 "플랜 생성하기" 버튼 클릭 시 `generatePlansFromGroupAction` 호출

모든 액션들이 `_generatePlansFromGroup` 또는 `_previewPlansFromGroup` 함수를 사용하므로, 관리자 권한 우회가 정상적으로 작동합니다.

## 테스트 필요 사항

1. 캠프 모드에서 관리자가 "draft" 상태의 플랜 그룹으로 플랜 생성 테스트
2. 일반 학생 모드에서 "draft" 상태의 플랜 그룹으로 플랜 생성 시도 시 에러 발생 확인
3. 캠프 모드에서 관리자가 플랜 미리보기 기능 테스트
4. 관리자 페이지에서 Step 6의 "플랜 생성하기" 버튼 테스트
5. 관리자 페이지에서 Step 7의 "플랜 미리보기 및 재생성" 버튼 테스트

## 추가 수정 사항 (2025-11-27)

### 플랜 미리보기에서 교재 정보 조회 문제 수정

**문제**: 플랜 미리보기에서 교재 정보가 제대로 표시되지 않음

**원인**:
- `_previewPlansFromGroup` 함수에서 학생 교재 조회 시 `master_content_id`를 확인하지 않음
- 학생 교재가 없을 때 마스터 콘텐츠 ID로 학생 교재를 찾는 로직이 없음
- `_generatePlansFromGroup`과 달리 마스터 콘텐츠 ID로 학생 콘텐츠를 찾는 로직이 누락됨

**수정 내용**:
1. 학생 교재 조회 시 `master_content_id`도 함께 조회
2. 학생 교재가 없을 때 마스터 콘텐츠 ID로 학생 교재 찾기 로직 추가
3. 학생 강의에도 동일한 로직 적용

```typescript
// 수정 전
const { data: book } = await queryClient
  .from("books")
  .select("title, subject, subject_category, content_category")
  .eq("id", finalContentId)
  .eq("student_id", studentId)
  .maybeSingle();

if (book) {
  // ...
} else {
  // 마스터 교재 조회 (바로 조회)
  const { data: masterBook } = await supabase
    .from("master_books")
    .select("...")
    .eq("id", content.content_id)
    .maybeSingle();
}

// 수정 후
const { data: book } = await queryClient
  .from("books")
  .select("title, subject, subject_category, content_category, master_content_id")
  .eq("id", finalContentId)
  .eq("student_id", studentId)
  .maybeSingle();

if (book) {
  // ...
} else {
  // 마스터 콘텐츠 ID로 학생 교재 찾기
  const masterContentId = content.content_id;
  const { data: bookByMaster } = await queryClient
    .from("books")
    .select("...")
    .eq("student_id", studentId)
    .eq("master_content_id", masterContentId)
    .maybeSingle();

  if (bookByMaster) {
    // ...
  } else {
    // 마스터 교재 조회
    const { data: masterBook } = await supabase
      .from("master_books")
      .select("...")
      .eq("id", masterContentId)
      .maybeSingle();
  }
}
```

## 관련 파일

- `app/(student)/actions/plan-groups/plans.ts`
- `app/(admin)/actions/campTemplateActions.ts`

