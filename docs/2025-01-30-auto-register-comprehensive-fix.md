# 추천 콘텐츠 자동 등록 기능 전체 점검 및 수정

**작업 일시**: 2025-01-30  
**이유**: 여러 번 개선을 요청했지만 문제가 해결되지 않음

## 문제 분석

### 발견된 문제점

1. **타입 불일치**
   - `onUpdate`의 타입이 함수형 업데이트를 지원하지 않음
   - `PlanGroupWizard.tsx`에서는 함수형 업데이트를 지원하지만, 타입 정의는 업데이트되지 않음

2. **상태 업데이트 타이밍 이슈**
   - 자동 배정 후 `setTimeout`을 사용한 지연 처리로 인한 타이밍 문제
   - `useEffect`와 자동 배정 후 목록 업데이트 간의 동기화 문제

3. **디버깅 정보 부족**
   - 자동 배정 과정에서 충분한 로그가 없어 문제 추적이 어려움

4. **중복 필터링 로직**
   - 자동 배정 후 추천 목록에서 제거하는 로직이 `useEffect`에만 의존
   - 즉시 반영이 필요한 경우 지연 발생

## 수정 내용

### 1. 타입 정의 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`

```typescript
// 수정 전
onUpdate: (updates: Partial<WizardData>) => void;

// 수정 후
onUpdate: (
  updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
) => void;
```

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// 수정 전
onUpdate: (updates: Partial<WizardData>) => void;

// 수정 후
onUpdate: (
  updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
) => void;
```

### 2. 자동 배정 함수 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

#### 2.1. 에러 처리 추가

```typescript
try {
  onUpdate((prev) => {
    // ... 자동 배정 로직 ...
  });
  console.log("[useRecommendations] onUpdate 호출 완료");
} catch (error) {
  console.error("[useRecommendations] 자동 배정 중 오류 발생:", error);
  alert("자동 배정 중 오류가 발생했습니다. 다시 시도해주세요.");
}
```

#### 2.2. 디버깅 로그 강화

- 자동 배정 시작 시점 로그 추가
- 함수형 업데이트 내부에서 상세 로그 추가
- 상태 업데이트 전후 비교 로그 추가

### 3. 자동 배정 후 상태 동기화 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

#### 3.1. 즉시 반영 로직 추가

```typescript
// 수정 전: setTimeout으로 지연
setTimeout(() => {
  setRecommendedContents((prev) => {
    const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
    return filtered;
  });
}, 0);

// 수정 후: 즉시 반영
const autoAssignedIds = new Set(
  filteredRecommendations.map((r) => r.id)
);

// recommendedContents에서 즉시 제거
setRecommendedContents((prev) => {
  const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
  console.log("[useRecommendations] 자동 배정 후 목록 업데이트 (즉시):", {
    before: prev.length,
    after: filtered.length,
    autoAssigned: autoAssignedIds.size,
  });
  return filtered;
});

// allRecommendedContents에서도 즉시 제거
setAllRecommendedContents((prev) => {
  const filtered = prev.filter((r) => !autoAssignedIds.has(r.id));
  return filtered;
});
```

#### 3.2. useEffect 로그 강화

```typescript
useEffect(() => {
  if (data.recommended_contents.length > 0) {
    const addedContentIds = new Set(
      data.recommended_contents.map((c) => c.content_id)
    );
    
    console.log("[useRecommendations] useEffect: 추가된 콘텐츠 감지:", {
      addedContentIds: Array.from(addedContentIds),
      currentRecommendedContentsCount: data.recommended_contents.length,
    });
    
    // ... 제거 로직 ...
  }
}, [recommendedContentIds]);
```

## 수정된 파일 목록

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
   - `Step4RecommendedContentsProps`의 `onUpdate` 타입 수정

2. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - `UseRecommendationsProps`의 `onUpdate` 타입 수정
   - `autoAssignContents` 함수에 에러 처리 및 로그 추가
   - 자동 배정 후 즉시 반영 로직 추가
   - `useEffect`에 디버깅 로그 추가

## 예상 효과

- ✅ 타입 안전성 향상 (함수형 업데이트 지원)
- ✅ 자동 배정 후 즉시 UI 반영
- ✅ 에러 발생 시 명확한 피드백 제공
- ✅ 디버깅 로그를 통한 문제 추적 용이
- ✅ 상태 동기화 개선으로 중복 제거 로직 안정화

## 테스트 시나리오

### 정상 동작 확인

1. **자동 등록 옵션 선택**
   - 추천 요청 폼에서 "콘텐츠 자동 배정" 체크박스 선택
   - 교과 선택 및 개수 설정
   - 추천 요청 버튼 클릭

2. **자동 등록 확인**
   - 콘솔 로그에서 자동 배정 과정 확인
   - 추천 콘텐츠가 자동으로 `recommended_contents`에 추가되는지 확인
   - "이미 추가된 추천 콘텐츠 목록"에 즉시 표시되는지 확인
   - 추천 목록에서 즉시 제거되는지 확인

3. **에러 처리 확인**
   - 네트워크 오류 등 발생 시 적절한 에러 메시지 표시 확인

## 디버깅 가이드

### 콘솔 로그 확인 포인트

1. **자동 배정 시작**
   ```
   [useRecommendations] 자동 배정 시작:
   [useRecommendations] 자동 배정 시작 - 함수형 업데이트 호출
   ```

2. **함수형 업데이트 내부**
   ```
   [useRecommendations] 자동 배정 실행 (함수형 업데이트 내부):
   ```

3. **상태 업데이트 완료**
   ```
   [useRecommendations] onUpdate 호출 완료
   ```

4. **목록 업데이트**
   ```
   [useRecommendations] 자동 배정 후 목록 업데이트 (즉시):
   [useRecommendations] useEffect: 추가된 콘텐츠 감지:
   ```

### 문제 발생 시 확인 사항

1. 콘솔에서 자동 배정 시작 로그가 있는지 확인
2. 함수형 업데이트 내부 로그에서 상태 값 확인
3. `onUpdate` 호출 완료 로그 확인
4. `useEffect`에서 추가된 콘텐츠 감지 로그 확인
5. 목록 업데이트 로그에서 제거된 콘텐츠 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` (이전 수정)

## 참고 사항

- 함수형 업데이트 패턴은 React의 상태 업데이트 최적화를 위한 표준 패턴입니다
- 즉시 반영 로직과 `useEffect`의 중복 제거 로직이 함께 작동하여 안정성을 높입니다
- 디버깅 로그는 개발 환경에서만 활성화되도록 설정할 수 있습니다

