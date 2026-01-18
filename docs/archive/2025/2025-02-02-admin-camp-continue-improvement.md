# 관리자 캠프 모드 남은 단계 진행하기 개선

## 작업 일시
2025-02-02

## 문제점 분석

1. **시작 단계 문제**: 현재 Step 5 (최종 확인)부터 시작되어 콘텐츠 추가 단계를 건너뜀
2. **이전으로 단계를 돌리면 다음 버튼이 작동하지 않음**: `isAdminContinueMode`일 때 단계 이동 로직 문제
3. **콘텐츠 삭제가 안됨**: 추천 콘텐츠와 학생 콘텐츠 모두에서 삭제 기능이 제대로 작동하지 않음
4. **학습 범위 수정 기능 부재**: 학생 콘텐츠의 범위 수정 기능이 없음
5. **관리자 모드에서 편집 불가**: `editable` prop이 잘못 설정되어 관리자 모드에서 콘텐츠 추가/삭제/범위 수정이 안 됨
6. **다음 버튼이 저장만 하고 단계를 넘어가지 않음**: `isAdminContinueMode`일 때 Step 4에서 `setCurrentStep(5)`가 호출되지 않음

## 해결 방안

### Phase 1: 시작 단계를 Step 4로 변경

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

**변경사항**:
- `_startStep: 5`를 `_startStep: 4`로 변경
- 설명 텍스트 업데이트: "추천 콘텐츠 선택, 최종 확인, 스케줄 결과 단계를 진행하세요." → "학생이 등록한 콘텐츠를 확인하고, 추천 콘텐츠를 선택하여 조율하세요."
- Step 표시: "Step 5-7 진행 중" → "Step 4-7 진행 중"

### Phase 2: 단계 이동 로직 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경사항**:
- `handleNext` 함수에서 `isAdminContinueMode`일 때 Step 3에서 Step 4로 이동하는 로직 추가
- `handleBack` 함수에서 `isAdminContinueMode`일 때 Step 4 이상에서만 뒤로가기 가능하도록 수정

### Phase 3: 콘텐츠 삭제 기능 개선

**파일**:
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/AddedContentsList.tsx`

**변경사항**:
- `removeContent` 함수를 `recommended_contents`와 `student_contents` 모두에서 삭제 가능하도록 확장
- `removeContent` 함수에 `type: "recommended" | "student"` 파라미터 추가
- `AddedContentsList` 컴포넌트에서 학생 콘텐츠도 표시하고 삭제 가능하도록 개선
- Step4RecommendedContents에서 학생 콘텐츠 목록 표시 및 삭제 기능 추가

### Phase 4: 학습 범위 수정 기능 확장

**파일**:
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**변경사항**:
- `useRangeEditor` 훅을 `recommended_contents`뿐만 아니라 `student_contents`도 지원하도록 확장
- `editingContentType` 상태 추가하여 현재 편집 중인 콘텐츠 타입 추적
- `startEditingRange` 함수에 `type: "recommended" | "student"` 파라미터 추가
- `saveEditingRange` 함수에서 타입에 따라 `recommended_contents` 또는 `student_contents` 업데이트
- 학생 콘텐츠에 대한 범위 편집 기능 추가

## 구현 세부사항

### Phase 1: 시작 단계 변경

```typescript
// 변경 전
_startStep: 5, // Step 5부터 시작

// 변경 후
_startStep: 4, // Step 4 (콘텐츠 추가하기)부터 시작
```

### Phase 2: 단계 이동 로직 수정

```typescript
// handleNext 함수 수정
if (isAdminContinueMode && currentStep === 3) {
  setCurrentStep(4);
  return;
}

// handleBack 함수 수정
const handleBack = () => {
  if (currentStep > 1) {
    if (isAdminContinueMode) {
      if (currentStep > 4) {
        setCurrentStep((prev) => (prev - 1) as WizardStep);
      }
    } else {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  }
};
```

### Phase 3: 콘텐츠 삭제 기능 개선

```typescript
// useContentSelection.ts
const removeContent = useCallback(
  (index: number, type: "recommended" | "student" = "recommended") => {
    if (type === "recommended") {
      const newContents = [...data.recommended_contents];
      newContents.splice(index, 1);
      onUpdate({ recommended_contents: newContents });
    } else {
      const newContents = [...data.student_contents];
      newContents.splice(index, 1);
      onUpdate({ student_contents: newContents });
    }
  },
  [data.recommended_contents, data.student_contents, onUpdate]
);
```

### Phase 4: 학습 범위 수정 기능 확장

```typescript
// useRangeEditor.ts
const [editingContentType, setEditingContentType] = useState<"recommended" | "student">("recommended");

const startEditingRange = useCallback((index: number, type: "recommended" | "student" = "recommended") => {
  const contents = type === "recommended" 
    ? data.recommended_contents 
    : data.student_contents;
  const content = contents[index];
  if (!content) return;
  
  setEditingContentType(type);
  setEditingRangeIndex(index);
  setEditingRange({
    start: String(content.start_range || 1),
    end: String(content.end_range || 1),
  });
}, [data.recommended_contents, data.student_contents]);

const saveEditingRange = useCallback(() => {
  // ... 유효성 검사 ...
  
  if (editingContentType === "recommended") {
    const newContents = [...data.recommended_contents];
    newContents[editingRangeIndex] = {
      ...newContents[editingRangeIndex],
      start_range: startNum,
      end_range: endNum,
    };
    onUpdate({ recommended_contents: newContents });
  } else {
    const newContents = [...data.student_contents];
    newContents[editingRangeIndex] = {
      ...newContents[editingRangeIndex],
      start_range: startNum,
      end_range: endNum,
    };
    onUpdate({ student_contents: newContents });
  }
  // ...
}, [editingRangeIndex, editingContentType, editingRange, data.recommended_contents, data.student_contents, contentTotals, onUpdate]);
```

## 예상 개선 효과

| 단계 | 개선 내용 | 예상 효과 |
|------|----------|----------|
| Phase 1 | 시작 단계를 Step 4로 변경 | 콘텐츠 조율 단계부터 시작 |
| Phase 2 | 단계 이동 로직 수정 | 이전/다음 버튼 정상 작동 |
| Phase 3 | 콘텐츠 삭제 기능 개선 | 추천/학생 콘텐츠 모두 삭제 가능 |
| Phase 4 | 학습 범위 수정 기능 확장 | 추천/학생 콘텐츠 모두 범위 수정 가능 |

## 추가 수정 사항 (2025-02-02 후속)

### editable prop 수정
- **문제**: `editable={!isAdminContinueMode}`로 설정되어 관리자 모드에서 편집 불가
- **해결**: `editable={isAdminContinueMode || !isCampMode}`로 수정하여 관리자 모드에서 편집 가능하도록 변경

### 다음 버튼 동작 수정
- **문제**: `isAdminContinueMode`일 때 Step 4에서 `handleSubmit(false)` 호출 후 `setCurrentStep(5)`가 호출되지 않음
- **해결**: `continueCampStepsForAdmin` 성공 후 Step 4에서 `setCurrentStep(5)` 호출 추가

## 주의사항

1. **시작 단계 변경**: Step 4부터 시작하므로 Step 1-3은 건너뛰게 됨
2. **단계 이동 제한**: `isAdminContinueMode`일 때 Step 4 이하로는 이동하지 않도록 제한 필요
3. **콘텐츠 삭제**: 학생 콘텐츠 삭제 시 확인 다이얼로그 표시 (향후 추가 필요)
4. **학생 콘텐츠 제목 표시**: 학생 콘텐츠의 경우 `allRecommendedContents`가 비어있어 제목을 가져올 수 없으므로, 별도의 API 호출이 필요할 수 있음 (향후 개선 필요)

## 관련 파일

### 수정 파일

- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/AddedContentsList.tsx`

## 테스트 체크리스트

- [ ] 관리자 캠프 모드에서 '남은 단계 진행하기' 클릭 시 Step 4부터 시작하는지 확인
- [ ] Step 4에서 이전 버튼 클릭 시 Step 3으로 이동하지 않는지 확인
- [ ] Step 5에서 이전 버튼 클릭 시 Step 4로 이동하는지 확인
- [ ] Step 4에서 다음 버튼 클릭 시 Step 5로 이동하는지 확인
- [ ] 추천 콘텐츠 삭제 기능이 정상 작동하는지 확인
- [ ] 학생 콘텐츠 삭제 기능이 정상 작동하는지 확인
- [ ] 추천 콘텐츠 범위 수정 기능이 정상 작동하는지 확인
- [ ] 학생 콘텐츠 범위 수정 기능이 정상 작동하는지 확인

