# Step4 추천 콘텐츠 범위 자동 설정 기능 구현

## 작업 일시

2025-01-30

## 목표

추천 콘텐츠의 상세정보(목차/회차)가 없는 경우, 총 페이지수(교재) 또는 총 회차(강의)를 바탕으로 학습 범위를 자동 설정하고, 사용자가 필요시 수정할 수 있도록 개선했습니다.

## 현재 상황 (이전)

1. 추천 콘텐츠 추가 시 `start_range: 1`, `end_range: 100`으로 하드코딩
2. 범위 편집 시 상세정보가 없으면 경고만 로깅하고 사용자가 직접 입력해야 함
3. `/api/master-content-info` API로 총 페이지수/회차 조회 가능하지만 미사용

## 구현 내용

### 1. useContentSelection Hook 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`

#### 변경 사항

- `fetchContentTotal` 함수 추가: 총 페이지수/회차 조회
- `addSelectedContents` 함수를 async 함수로 변경
- 추천 콘텐츠 추가 시 각 콘텐츠의 총 페이지수/회차를 `/api/master-content-info` API로 조회
- 조회된 값이 있으면 `end_range`를 해당 값으로 설정
- 조회 실패하거나 값이 없으면 기본값 100 사용
- `start_range`는 항상 1

```typescript
// 추가된 fetchContentTotal 함수
const fetchContentTotal = useCallback(async (
  contentType: "book" | "lecture",
  contentId: string
): Promise<number | null> => {
  try {
    const response = await fetch(
      `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`
    );
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        if (contentType === "book") {
          return result.data.total_pages ?? null;
        } else {
          return result.data.total_episodes ?? null;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("[useContentSelection] 총 페이지수/회차 조회 실패:", {
      contentType,
      contentId,
      error,
    });
    return null;
  }
}, []);

// addSelectedContents에서 사용
const total = await fetchContentTotal(content.contentType, content.id);
const endRange = total && total > 0 ? total : 100;
```

### 2. useRangeEditor Hook 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

#### 변경 사항

- `contentTotals` 상태 추가 (Map<number, number>): 총 페이지수/회차 정보 저장
- `cachedTotalsRef` 추가: 총 페이지수/회차 정보 캐싱
- `fetchContentTotal` 함수 추가: 총 페이지수/회차 조회
- 상세정보 조회 시 총 페이지수/회차도 동시에 조회
- 상세정보가 없고 총 페이지수/회차가 있는 경우, `editingRange`를 `{ start: "1", end: "{total}" }`로 자동 설정

```typescript
// 상태 추가
const [contentTotals, setContentTotals] = useState<Map<number, number>>(new Map());
const cachedTotalsRef = useRef<Map<string, number>>(new Map());

// 총 페이지수/회차 조회 및 범위 자동 설정
if (detailData.details.length === 0) {
  // 상세정보가 없고 총 페이지수/회차가 있는 경우, 전체 범위로 자동 설정
  if (total && total > 0) {
    setEditingRange({
      start: "1",
      end: String(total),
    });
  }
}
```

### 3. AddedContentsList 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/AddedContentsList.tsx`

#### 변경 사항

- `contentTotals` props 추가
- `onRangeChange` props 추가
- 상세정보가 없는 경우의 UI 개선:
  - 총 페이지수/회차 정보 표시
  - 숫자 입력 필드로 범위 직접 입력 가능
  - 기본값은 전체 범위 (1 ~ 총 페이지수/회차)

```typescript
// 총 페이지수/회차 정보 표시
{total && (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
    <span className="font-medium">
      {content.content_type === "book" ? "총 페이지수" : "총 회차"}: {total}
      {content.content_type === "book" ? "페이지" : "회차"}
    </span>
  </div>
)}

// 범위 직접 입력 필드
<input
  type="number"
  min="1"
  max={contentTotals.get(editingRangeIndex!) || undefined}
  value={editingRange?.start || "1"}
  onChange={(e) => {
    const newStart = e.target.value;
    const currentEnd = editingRange?.end || "1";
    if (onRangeChange) {
      onRangeChange(newStart, currentEnd);
    }
  }}
  // ...
/>
```

### 4. 타입 정의 업데이트

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`

#### 변경 사항

- `UseContentSelectionReturn` 타입: `addSelectedContents`를 `() => Promise<void>`로 변경
- `UseRangeEditorReturn` 타입: `contentTotals: Map<number, number>` 추가

### 5. Step4RecommendedContents 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

#### 변경 사항

- `useRangeEditor`에서 `contentTotals` 추출
- `AddedContentsList`에 `contentTotals`와 `onRangeChange` 전달

## API 호출 로직

### `/api/master-content-info` API 사용

- **엔드포인트**: `/api/master-content-info?content_type={book|lecture}&content_id={id}`
- **응답 형식**:
  ```typescript
  {
    success: true,
    data: {
      total_pages: number | null,      // 교재인 경우
      total_episodes: number | null     // 강의인 경우
    }
  }
  ```
- **사용 규칙**:
  - 교재: `total_pages` 사용
  - 강의: `total_episodes` 사용

### 에러 처리

- API 호출 실패 시 기본값(100) 사용
- 총 페이지수/회차가 null인 경우 기본값(100) 사용
- 로깅은 유지하여 디버깅 가능하도록

## 사용자 경험 개선

### 이전 동작

1. 추천 콘텐츠 추가 시 항상 `1 ~ 100` 범위로 설정
2. 상세정보가 없으면 "상세 정보가 없습니다. 범위를 직접 입력해주세요." 메시지만 표시
3. 사용자가 범위를 수정하려면 범위 편집 모드 진입 후 직접 입력 필요

### 개선된 동작

1. 추천 콘텐츠 추가 시 총 페이지수/회차가 있으면 `1 ~ {total}` 범위로 자동 설정
2. 상세정보가 없어도 총 페이지수/회차 정보가 표시됨
3. 범위 편집 시 총 페이지수/회차가 있으면 자동으로 전체 범위 설정
4. 숫자 입력 필드로 쉽게 범위 수정 가능

## 테스트 시나리오

1. ✅ 상세정보가 없는 교재 추가 시 총 페이지수로 범위 자동 설정 확인
2. ✅ 상세정보가 없는 강의 추가 시 총 회차로 범위 자동 설정 확인
3. ✅ 범위 편집 시 상세정보가 없어도 총 페이지수/회차 기반으로 편집 가능 확인
4. ✅ API 호출 실패 시 기본값(100) 사용 확인
5. ✅ 총 페이지수/회차가 null인 경우 기본값(100) 사용 확인

## 영향받는 파일 목록

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`
2. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
3. `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/AddedContentsList.tsx`
4. `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
5. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
6. `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/RecommendedContentsList.tsx`

## 참고사항

- API 호출은 비동기로 처리되므로 사용자 경험에 영향을 최소화
- 캐싱을 통해 같은 콘텐츠의 총 페이지수/회차 정보를 반복 조회하지 않도록 최적화
- 상세정보가 있는 경우 기존 동작 유지 (목차/회차 선택 UI 사용)

