# Step4 추천 콘텐츠 기능 개선

## 작업 일시
2025-01-30

## 문제점

1. **자동 배정이 작동하지 않음**
   - 자동 배정 옵션을 선택해도 콘텐츠가 자동으로 추가되지 않음
   - 상세 정보가 없을 때 총량 조회가 제대로 작동하지 않음

2. **범위 편집 시 직접 입력 제한**
   - 추가된 콘텐츠의 범위를 편집할 때 직접 입력이 제대로 작동하지 않음
   - `onRangeChange` 핸들러가 연결되지 않음

3. **추가된 콘텐츠가 추천 목록에 계속 남아있음**
   - 선택한 추천 콘텐츠를 추가한 후에도 추천 목록에서 제거되지 않음
   - `recommendedContents` 상태가 업데이트되지 않음

## 해결 방법

### 1. 추가된 콘텐츠를 추천 목록에서 자동 제거

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// data.recommended_contents가 업데이트되면 recommendedContents에서 제거
useEffect(() => {
  if (data.recommended_contents.length > 0) {
    const addedContentIds = new Set(
      data.recommended_contents.map((c) => c.content_id)
    );
    
    setRecommendedContents((prev) => {
      const filtered = prev.filter((c) => !addedContentIds.has(c.id));
      
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
      
      return filtered;
    });
  }
}, [data.recommended_contents]);
```

**효과**:
- `data.recommended_contents`가 업데이트될 때마다 `recommendedContents` 상태를 자동으로 필터링
- 추가된 콘텐츠가 추천 목록에서 즉시 제거됨

### 2. 범위 편집 시 직접 입력 기능 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

```typescript
const saveEditingRange = useCallback(() => {
  if (editingRangeIndex === null || !editingRange) return;

  const startNum = Number(editingRange.start);
  const endNum = Number(editingRange.end);

  // 유효성 검사
  if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
    alert("유효한 숫자 범위를 입력해주세요.");
    return;
  }

  if (startNum > endNum) {
    alert("시작 범위는 종료 범위보다 클 수 없습니다.");
    return;
  }

  // 총 페이지수/회차 확인
  const content = data.recommended_contents[editingRangeIndex];
  const total = contentTotals.get(editingRangeIndex);
  if (total && (startNum > total || endNum > total)) {
    alert(
      `범위는 최대 ${total}${content.content_type === "book" ? "페이지" : "회차"}까지 입력할 수 있습니다.`
    );
    return;
  }

  const newContents = [...data.recommended_contents];
  newContents[editingRangeIndex] = {
    ...newContents[editingRangeIndex],
    start_range: startNum,
    end_range: endNum,
  };
  onUpdate({ recommended_contents: newContents });
  setEditingRangeIndex(null);
  setEditingRange(null);
}, [editingRangeIndex, editingRange, data.recommended_contents, contentTotals, onUpdate]);
```

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/Step4RecommendedContentsRefactored.tsx`

```typescript
<AddedContentsList
  contents={data.recommended_contents}
  allRecommendedContents={allRecommendedContents}
  editingRangeIndex={editingRangeIndex}
  editingRange={editingRange}
  contentDetails={contentDetails}
  onRangeChange={(start, end) => {
    setEditingRange({ start, end });
  }}
  // ... 기타 props
/>
```

**효과**:
- 범위 편집 시 직접 입력 값이 실시간으로 업데이트됨
- 유효성 검사가 강화되어 잘못된 범위 입력 방지
- 총 페이지수/회차를 초과하는 범위 입력 방지

### 3. 자동 배정 로직 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// 상세 정보 조회
let detailsResult: any = null;
let hasDetails = false;

const detailsResponse = await fetch(
  `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
);

if (detailsResponse.ok) {
  detailsResult = await detailsResponse.json();
  // ... 상세 정보 처리
}

// 상세 정보가 없거나 기본값일 때 총량 조회 (전체 범위 설정)
if (!hasDetails || (startRange === 1 && endRange === 100)) {
  try {
    const infoResponse = await fetch(
      `/api/master-content-info?content_type=${r.contentType}&content_id=${r.id}`
    );

    if (infoResponse.ok) {
      const infoResult = await infoResponse.json();
      if (infoResult.success && infoResult.data) {
        if (r.contentType === "book" && infoResult.data.total_pages) {
          endRange = infoResult.data.total_pages;
          console.log(`[useRecommendations] 자동 배정: ${r.title} 총 페이지수 ${endRange}로 설정`);
        } else if (r.contentType === "lecture" && infoResult.data.total_episodes) {
          endRange = infoResult.data.total_episodes;
          console.log(`[useRecommendations] 자동 배정: ${r.title} 총 회차 ${endRange}로 설정`);
        }
      }
    }
  } catch (infoError) {
    // 총량 조회 실패는 무시 (기본값 100 사용)
  }
}
```

**효과**:
- 상세 정보가 없을 때도 총량을 조회하여 전체 범위로 자동 설정
- 자동 배정 과정이 로그로 추적 가능
- 상세 정보가 있어도 기본값(1-100)일 때 총량 조회 수행

## 변경된 파일

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - 추가된 콘텐츠를 추천 목록에서 자동 제거하는 `useEffect` 추가
   - 자동 배정 시 상세 정보가 없을 때 총량 조회 로직 개선

2. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
   - 범위 저장 시 유효성 검사 강화
   - 총 페이지수/회차 초과 방지

3. `app/(student)/plan/new-group/_components/Step4RecommendedContents/Step4RecommendedContentsRefactored.tsx`
   - `AddedContentsList`에 `onRangeChange` 핸들러 연결

## 테스트 시나리오

1. **추천 콘텐츠 추가 후 목록에서 제거 확인**
   - 추천 콘텐츠를 선택하여 추가
   - 추가된 콘텐츠가 추천 목록에서 사라지는지 확인

2. **범위 편집 직접 입력 테스트**
   - 추가된 콘텐츠의 범위 편집 버튼 클릭
   - 직접 입력 필드에 숫자 입력
   - 입력 값이 실시간으로 반영되는지 확인
   - 저장 시 유효성 검사가 작동하는지 확인

3. **자동 배정 테스트**
   - 자동 배정 옵션 선택
   - 추천 요청
   - 콘텐츠가 자동으로 추가되는지 확인
   - 상세 정보가 없는 콘텐츠도 총량을 조회하여 전체 범위로 설정되는지 확인

## 참고사항

- `recommendedContents` 상태는 `data.recommended_contents`와 동기화되어야 함
- 범위 편집 시 직접 입력은 상세 정보가 없을 때만 표시됨
- 자동 배정은 최대 9개 제한을 고려하여 작동함

