# 캠프 템플릿 리뷰 페이지에서 전략과목/취약과목 정보 섹션 제거

## 작업 개요

**작업일**: 2024년 11월  
**작업 내용**: 캠프 템플릿 참가자 리뷰 페이지에서 '전략과목/취약과목 정보' 항목 제거

## 변경 사항

### 제거된 항목

1. **UI 섹션 제거**
   - '전략과목/취약과목 정보' 섹션 전체 제거
   - 개요 탭에서 표시되던 전략과목/취약과목 설정 UI 제거

2. **관련 함수 제거**
   - `handleSubjectAllocationChange`: 과목 할당 변경 핸들러 제거
   - `handleSave`: 전략과목/취약과목 설정 저장 함수 제거

3. **상태 및 변수 제거**
   - `subjectAllocations` 상태 제거
   - `subjects` 계산 로직 제거
   - `SubjectAllocation` 타입 정의 제거

4. **버튼 제거**
   - '설정 저장' 버튼 제거
   - '플랜 생성하기' 버튼의 전략과목/취약과목 검증 로직 제거

5. **Import 제거**
   - `updateCampPlanGroupSubjectAllocations` import 제거

### 수정된 함수

**`handleGeneratePlans` 함수**
- 전략과목/취약과목 설정 검증 로직 제거
- `subject_allocations` 저장 로직 제거
- 플랜 생성 로직만 유지

**변경 전**:
```typescript
const handleGeneratePlans = async () => {
  // 모든 과목에 대한 설정이 있는지 확인
  const missingSubjects = subjects.filter(
    (subject) => !subjectAllocations.some((a) => a.subject_name === subject)
  );

  if (missingSubjects.length > 0) {
    toast.showError(
      `다음 과목의 전략과목/취약과목 설정이 필요합니다: ${missingSubjects.join(", ")}`
    );
    return;
  }

  startTransition(async () => {
    try {
      // 먼저 subject_allocations 저장
      const updateResult = await updateCampPlanGroupSubjectAllocations(
        groupId,
        subjectAllocations
      );

      if (!updateResult.success) {
        throw new Error("전략과목/취약과목 설정 저장에 실패했습니다.");
      }

      // 플랜 생성
      const generateResult = await generatePlansFromGroupAction(groupId);
      // ...
    });
  });
};
```

**변경 후**:
```typescript
const handleGeneratePlans = async () => {
  startTransition(async () => {
    try {
      // 플랜 생성
      const generateResult = await generatePlansFromGroupAction(groupId);

      if (!generateResult || generateResult.count === 0) {
        throw new Error("플랜 생성에 실패했습니다.");
      }

      toast.showSuccess(`플랜이 생성되었습니다. (${generateResult.count}개)`);
      router.push(`/plan/group/${groupId}`);
    } catch (error) {
      console.error("플랜 생성 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "플랜 생성에 실패했습니다."
      );
    }
  });
};
```

## 영향 범위

### 수정된 파일

- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`

### 영향받는 기능

- **캠프 템플릿 리뷰 페이지**: 개요 탭에서 전략과목/취약과목 정보 섹션이 더 이상 표시되지 않음
- **플랜 생성**: 전략과목/취약과목 설정 없이 바로 플랜 생성 가능

## 사유

- 불필요한 항목으로 판단되어 제거
- 사용자 경험 개선을 위해 복잡한 설정 단계 제거

## 테스트 확인 사항

- [ ] 캠프 템플릿 리뷰 페이지에서 전략과목/취약과목 정보 섹션이 표시되지 않는지 확인
- [ ] 플랜 생성하기 버튼이 정상적으로 작동하는지 확인
- [ ] 플랜 생성 시 오류가 발생하지 않는지 확인

