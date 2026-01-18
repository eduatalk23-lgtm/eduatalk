# 교과별 할당 검증 및 콘텐츠별 설정 유지 문제 수정

## 📋 작업 개요

Step 5 검증에서 "다음 교과의 콘텐츠를 선택해주세요" 오류가 발생하는 문제와, 교과별 일괄 설정이 활성화되어 있을 때 콘텐츠별 설정이 유지되지 않는 문제를 수정했습니다.

## 🎯 목표

1. 교과별 할당 검증 로직 개선 (부분 매칭 추가)
2. 콘텐츠별 설정 변경 시 교과별 일괄 설정 자동 취소
3. 콘텐츠별 설정이 올바르게 유지되도록 보장

## 🔧 변경 사항

### 1. 검증 로직 개선

**파일**: `lib/validation/wizardValidator.ts`

**문제점**:
- `subject_allocations`의 `subject_name`이 교과명인데, 콘텐츠의 `subject_category`가 과목명일 수 있어 정확히 일치하지 않음
- 예: `subject_name`이 "수학"인데, `subject_category`가 "수학I", "수학II" 등일 수 있음

**변경 내용**:
- 부분 매칭 로직 추가
- `subject_name`이 `subject_category`에 포함되는지 확인
- `subject_category`가 `subject_name`에 포함되는지 확인 (역방향)

**코드 변경**:
```typescript
// 변경 전: 정확 일치만 확인
if (contentSubjectCategories.has(subjectName)) {
  return; // 매칭됨
}

// 변경 후: 부분 매칭도 확인
// 2. subject_name이 subject_category와 정확히 일치하는지 확인
if (contentSubjectCategories.has(subjectName)) {
  return; // 매칭됨
}

// 3. subject_name이 subject_category에 포함되는지 확인 (부분 매칭)
const hasMatchingCategory = Array.from(contentSubjectCategories).some(
  (category) => category && category.includes(subjectName)
);
if (hasMatchingCategory) {
  return; // 매칭됨
}

// 4. subject_category가 subject_name에 포함되는지 확인 (역방향)
const hasMatchingName = Array.from(contentSubjectCategories).some(
  (category) => subjectName && category && subjectName.includes(category)
);
if (hasMatchingName) {
  return; // 매칭됨
}
```

### 2. 콘텐츠별 설정 변경 시 교과별 일괄 설정 자동 취소

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

**문제점**:
- 교과별 일괄 설정이 활성화되어 있을 때, 콘텐츠별 설정을 변경해도 일괄 설정이 유지됨
- 일괄 설정이 다시 적용되면서 콘텐츠별 설정이 덮어씌워짐

**변경 내용**:
- 콘텐츠별 설정 변경 시 해당 교과의 일괄 설정 자동 취소
- 해당 교과의 `subject_allocations`에서 제거
- 콘텐츠별 설정만 유지

**코드 변경**:
```typescript
// 변경 전: 콘텐츠별 설정만 업데이트
const handleContentAllocationChange = (content, allocation) => {
  // ... 콘텐츠별 설정 업데이트만
  onUpdate({ content_allocations: updatedAllocations });
};

// 변경 후: 교과별 일괄 설정도 취소
const handleContentAllocationChange = (content, allocation) => {
  // 해당 콘텐츠가 속한 교과 찾기
  const contentInfo = contentInfos.find(...);
  
  if (contentInfo) {
    const subjectGroup = contentInfo.subject_group_name || contentInfo.subject_category || "기타";
    
    // 일괄 설정 취소
    if (batchSettingSubjectGroup === subjectGroup) {
      setBatchSettingSubjectGroup(null);
    }
    
    // 해당 교과의 subject_allocations에서 제거
    const updatedSubjectAllocations = currentSubjectAllocations.filter(
      (a) => a.subject_name !== subjectGroup
    );
    
    // 콘텐츠별 설정 업데이트
    onUpdate({
      content_allocations: updatedAllocations,
      subject_allocations: updatedSubjectAllocations,
    });
  }
};
```

## ✅ 검증 사항

### 1. 검증 로직
- [x] `subject_name`이 "수학"이고 `subject_category`가 "수학I", "수학II" 등일 때 매칭 성공
- [x] `subject_id`로 매칭 시도 (가장 정확)
- [x] 정확 일치 확인
- [x] 부분 매칭 확인 (양방향)

### 2. 콘텐츠별 설정 유지
- [x] 콘텐츠별 설정 변경 시 교과별 일괄 설정 자동 취소
- [x] 해당 교과의 `subject_allocations`에서 제거
- [x] 콘텐츠별 설정이 올바르게 저장됨

## 📝 참고 사항

### 검증 우선순위
1. `subject_id`로 매칭 (가장 정확)
2. `subject_name`과 `subject_category` 정확 일치
3. `subject_name`이 `subject_category`에 포함되는지 확인 (부분 매칭)
4. `subject_category`가 `subject_name`에 포함되는지 확인 (역방향)

### 교과별 일괄 설정 동작
- 교과별 일괄 설정 활성화 시: 모든 콘텐츠에 동일한 설정 적용
- 콘텐츠별 설정 변경 시: 해당 교과의 일괄 설정 자동 취소, 콘텐츠별 설정만 유지
- 일괄 설정 취소 시: 기존 콘텐츠별 설정 유지

## 🎨 UI 개선 효과

1. **정확한 검증**: 교과명과 과목명의 부분 매칭으로 검증 오류 감소
2. **설정 유지**: 콘텐츠별 설정이 올바르게 유지되어 사용자 혼란 방지
3. **직관적인 동작**: 콘텐츠별 설정 변경 시 일괄 설정이 자동으로 취소되어 예상대로 동작

