# 추천 콘텐츠 자동 등록 기능 수정

**작업 일시**: 2025-01-30  
**관련 이슈**: 자동 등록으로 선택하고 추천을 받았지만 컨텐츠가 추가되지 않음

## 문제 분석

### 발견된 문제점

1. **클로저 문제**
   - `autoAssignContents` 함수에서 `data.recommended_contents`를 직접 참조하여 오래된 값을 사용할 수 있음
   - `useCallback`의 의존성 배열에 `data.recommended_contents`가 포함되어 있지만, 함수 실행 시점의 값이 아닌 클로저에 캡처된 값을 사용

2. **상태 업데이트 타이밍 이슈**
   - `onUpdate` 호출 후 상태가 즉시 반영되지 않아 중복 제거 로직이 잘못 동작할 수 있음
   - `updateWizardData`가 함수형 업데이트를 지원하지 않아 최신 상태를 보장할 수 없음

3. **자동 배정 후 목록 업데이트 충돌**
   - 자동 배정 후 `setRecommendedContents`를 직접 호출하여 `useEffect`와 타이밍 충돌 발생 가능

## 수정 내용

### 1. `PlanGroupWizard.tsx` - 함수형 업데이트 지원 추가

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

```typescript
// 수정 전
const updateWizardData = (updates: Partial<WizardData>) => {
  setWizardData((prev) => ({ ...prev, ...updates }));
  setValidationErrors([]);
  setValidationWarnings([]);
};

// 수정 후
const updateWizardData = (
  updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
) => {
  if (typeof updates === "function") {
    setWizardData((prev) => {
      const partialUpdates = updates(prev);
      return { ...prev, ...partialUpdates };
    });
  } else {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }
  setValidationErrors([]);
  setValidationWarnings([]);
};
```

**변경 사항**:
- `updates` 파라미터가 함수인 경우를 처리하도록 수정
- 함수형 업데이트를 통해 최신 상태를 보장

### 2. `useRecommendations.ts` - 함수형 업데이트 사용

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

#### 2.1. `autoAssignContents` 함수 수정

**주요 변경 사항**:
- `data.recommended_contents` 직접 참조 제거
- 함수형 업데이트를 사용하여 최신 상태 보장
- 의존성 배열에서 `data.student_contents`, `data.recommended_contents` 제거

```typescript
// 수정 전
const currentTotal =
  data.student_contents.length + data.recommended_contents.length;
const newRecommendedContents = [...data.recommended_contents, ...trimmed];
onUpdate({
  recommended_contents: newRecommendedContents,
});

// 수정 후
onUpdate((prev) => {
  const currentTotal =
    prev.student_contents.length + prev.recommended_contents.length;
  // ... 로직 ...
  const newRecommendedContents = [
    ...prev.recommended_contents,
    ...contentsToAutoAdd,
  ];
  return {
    recommended_contents: newRecommendedContents,
  };
});
```

#### 2.2. 의존성 배열 수정

```typescript
// 수정 전
[data.student_contents, data.recommended_contents, onUpdate]

// 수정 후
[onUpdate]
```

### 3. 자동 배정 후 상태 동기화 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

**변경 사항**:
- 자동 배정 후 목록 업데이트를 `setTimeout`으로 지연시켜 `useEffect`가 먼저 실행되도록 함
- 함수형 업데이트를 사용하여 최신 상태 보장

```typescript
// 수정 전
await autoAssignContents(filteredRecommendations);
const autoAssignedIds = new Set(
  filteredRecommendations.map((r) => r.id)
);
const remainingRecommendations = filteredRecommendations.filter(
  (r) => !autoAssignedIds.has(r.id)
);
setRecommendedContents(remainingRecommendations);

// 수정 후
await autoAssignContents(filteredRecommendations);
setTimeout(() => {
  const autoAssignedIds = new Set(
    filteredRecommendations.map((r) => r.id)
  );
  setRecommendedContents((prev) => {
    const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
    return filtered;
  });
}, 0);
```

## 테스트 시나리오

### 정상 동작 확인

1. **자동 등록 옵션 선택**
   - 추천 요청 폼에서 "콘텐츠 자동 배정" 체크박스 선택
   - 교과 선택 및 개수 설정
   - 추천 요청 버튼 클릭

2. **자동 등록 확인**
   - 추천 콘텐츠가 자동으로 `recommended_contents`에 추가되어야 함
   - "이미 추가된 추천 콘텐츠 목록"에 표시되어야 함
   - 추천 목록에서 자동으로 제거되어야 함

3. **최대 개수 제한 확인**
   - 현재 콘텐츠 + 추천 개수가 9개를 초과하는 경우
   - 최대 9개까지만 추가되고 나머지는 제외되어야 함
   - 적절한 알림 메시지 표시

## 예상 효과

- ✅ 자동 등록 옵션 선택 시 추천 콘텐츠가 정상적으로 추가됨
- ✅ 상태 업데이트가 즉시 반영됨
- ✅ 중복 제거 로직이 올바르게 동작함
- ✅ 클로저 문제 해결로 최신 상태 보장

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

## 참고 사항

- 함수형 업데이트 패턴은 React의 상태 업데이트 최적화를 위한 표준 패턴입니다
- `setTimeout`을 사용한 지연은 이벤트 루프의 다음 틱에서 실행되도록 하여 상태 업데이트 순서를 보장합니다

