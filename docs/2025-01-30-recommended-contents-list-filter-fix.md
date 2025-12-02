# 추천 콘텐츠 목록 필터링 개선

## 작업 일시
2025-01-30

## 문제점

**선택한 추천 콘텐츠가 추천 콘텐츠 목록에 여전히 남아있는 문제**

- 사용자가 추천 콘텐츠를 선택하여 추가한 후에도 추천 목록에서 제거되지 않음
- `recommendedContents` 상태만 업데이트되고 `allRecommendedContents`는 업데이트되지 않음
- `useEffect`의 의존성이 배열 참조로 되어 있어 정확한 변경 감지가 어려움

## 원인 분석

1. **`allRecommendedContents` 미업데이트**
   - `useEffect`에서 `recommendedContents`만 업데이트하고 `allRecommendedContents`는 업데이트하지 않음
   - `allRecommendedContents`는 다른 곳에서도 사용되므로 함께 업데이트해야 함

2. **의존성 배열 문제**
   - `useEffect`의 의존성이 `[data.recommended_contents]`로 되어 있어 배열 참조를 비교
   - React의 상태 업데이트가 비동기이므로 참조 비교가 정확하지 않을 수 있음
   - 콘텐츠 ID 배열을 문자열로 변환하여 비교하는 것이 더 정확함

## 해결 방법

### 1. `allRecommendedContents`도 함께 업데이트

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// allRecommendedContents에서도 제거
setAllRecommendedContents((prev) => {
  const filtered = prev.filter((c) => !addedContentIds.has(c.id));
  
  if (filtered.length !== prev.length) {
    console.log("[useRecommendations] 추가된 콘텐츠를 전체 추천 목록에서 제거:", {
      before: prev.length,
      after: filtered.length,
      removed: prev.length - filtered.length,
      removedIds: prev
        .filter((c) => addedContentIds.has(c.id))
        .map((c) => ({ id: c.id, title: c.title })),
    });
  }
  
  return filtered;
});
```

**효과**:
- `allRecommendedContents`도 함께 업데이트되어 다른 곳에서 사용할 때도 정확한 목록 표시
- 추가된 콘텐츠가 모든 추천 목록에서 제거됨

### 2. 의존성 배열 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// 의존성을 content_id 배열로 변경하여 정확한 변경 감지
const recommendedContentIds = useMemo(
  () => data.recommended_contents.map((c) => c.content_id).sort().join(","),
  [data.recommended_contents]
);

useEffect(() => {
  // ... 필터링 로직
}, [recommendedContentIds]);
```

**효과**:
- 콘텐츠 ID 배열을 문자열로 변환하여 정확한 변경 감지
- 배열 참조가 아닌 실제 콘텐츠 ID 변경을 감지
- `useMemo`로 불필요한 재계산 방지

### 3. 로깅 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
if (filtered.length !== prev.length) {
  console.log("[useRecommendations] 추가된 콘텐츠를 추천 목록에서 제거:", {
    before: prev.length,
    after: filtered.length,
    removed: prev.length - filtered.length,
    removedIds: prev
      .filter((c) => addedContentIds.has(c.id))
      .map((c) => ({ id: c.id, title: c.title })),
  });
}
```

**효과**:
- 디버깅을 위한 상세 로그
- 필터링이 제대로 작동하는지 확인 가능

## 변경된 파일

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - `allRecommendedContents`도 함께 업데이트
   - 의존성 배열을 `recommendedContentIds`로 변경
   - `useMemo` import 추가
   - 로깅 추가

## 테스트 시나리오

1. **추천 콘텐츠 추가 후 목록에서 제거 확인**
   - 추천 콘텐츠를 선택하여 추가
   - 추가된 콘텐츠가 추천 목록에서 사라지는지 확인
   - 콘솔 로그에서 필터링 과정 확인

2. **여러 콘텐츠 추가 테스트**
   - 여러 추천 콘텐츠를 선택하여 추가
   - 모든 추가된 콘텐츠가 추천 목록에서 제거되는지 확인
   - 목록이 정확하게 업데이트되는지 확인

3. **재추천 테스트**
   - 콘텐츠를 추가한 후 재추천 요청
   - 추가된 콘텐츠가 재추천 목록에도 포함되지 않는지 확인
   - `filterDuplicateContents`가 제대로 작동하는지 확인

## 참고사항

- `recommendedContents`는 추천 목록 표시에 사용됨
- `allRecommendedContents`는 전체 추천 콘텐츠 관리에 사용됨
- 두 상태 모두 동기화되어야 정확한 목록 표시 가능
- `useMemo`로 콘텐츠 ID 배열을 문자열로 변환하여 정확한 변경 감지

