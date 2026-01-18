# 중복 Key 에러 수정

**작업 일시**: 2025-01-29  
**작업자**: AI Assistant  
**이슈**: React에서 중복된 key 에러 발생

## 문제 상황

`RecommendedContentsPanel.tsx` 컴포넌트에서 다음과 같은 에러가 발생했습니다:

```
Encountered two children with the same key, `d5f50c8a-ca43-4d4f-aa07-4fcab75efc11`. 
Keys should be unique so that components maintain their identity across updates.
```

## 원인 분석

1. `selectedContents` 배열에 같은 `content_id`를 가진 항목이 여러 개 있을 수 있음
   - 같은 콘텐츠를 다른 범위로 여러 번 선택한 경우
   - 예: 같은 교재를 "1-50페이지"와 "51-100페이지"로 각각 선택

2. 기존 코드에서 `key={content.content_id}`만 사용하여 중복 발생
   - `content_id`만으로는 고유성을 보장할 수 없음

## 해결 방법

### 1. 고유한 Key 생성

`content_id`, `start_range`, `end_range`, `index`를 조합하여 고유한 key 생성:

```typescript
key={`${content.content_id}-${content.start_range}-${content.end_range}-${index}`}
```

### 2. 코드 구조 개선

- `renderSelectedContent` 함수를 제거하고 `map` 함수 내부에서 직접 JSX 반환
- 더 명확하고 유지보수하기 쉬운 구조로 변경

## 수정된 코드

**파일**: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`

### 변경 전

```typescript
const renderSelectedContent = useCallback(
  (content: SelectedContent) => {
    // ...
    return (
      <ContentCard
        key={content.content_id}  // ❌ 중복 가능
        // ...
      />
    );
  },
  [allRecommendedContents, handleRecommendedRemove, handleEditRange]
);

// 사용
{selectedContents.map(renderSelectedContent)}
```

### 변경 후

```typescript
{selectedContents.map((content, index) => {
  const originalContent = allRecommendedContents.find(
    (c) => c.id === content.content_id
  );

  return (
    <ContentCard
      key={`${content.content_id}-${content.start_range}-${content.end_range}-${index}`}  // ✅ 고유한 key
      // ...
    />
  );
})}
```

## 테스트 확인 사항

- [x] 린터 에러 없음
- [ ] 같은 콘텐츠를 다른 범위로 여러 번 선택해도 에러 없음
- [ ] 같은 콘텐츠를 같은 범위로 여러 번 선택해도 에러 없음 (index로 구분)
- [ ] 콘텐츠 삭제/수정 시 정상 동작

## 참고 사항

- React의 key는 형제 요소 간에 고유해야 함
- 배열의 인덱스만 사용하는 것은 권장되지 않지만, 다른 고유 식별자와 조합하여 사용하는 것은 안전함
- 이 경우 `content_id`, `start_range`, `end_range`로도 고유성을 보장할 수 있지만, 방어적으로 `index`도 포함

