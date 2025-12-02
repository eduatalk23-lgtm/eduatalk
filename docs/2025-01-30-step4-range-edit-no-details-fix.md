# Step4 범위 편집 - 상세 정보 없을 때 직접 입력 수정

## 작업 일시
2025-01-30

## 문제점

**상세 정보가 없을 때 시작, 종료 범위 수정이 안되는 문제**

- 상세 정보(목차/회차)가 없는 콘텐츠의 범위를 편집할 때 직접 입력 UI가 표시되지 않음
- API 호출 실패 시에도 직접 입력 UI가 표시되지 않음
- 상세 정보 조회 중 에러 발생 시 `contentDetails`에 빈 배열이 저장되지 않아 직접 입력 UI가 표시되지 않음

## 원인 분석

1. **API 호출 실패 시 빈 배열 미저장**
   - `detailsResponse.ok`가 `false`일 때 `contentDetails`에 빈 배열을 저장하지 않음
   - 이로 인해 `contentInfo`가 `undefined`가 되어 직접 입력 UI가 표시되지 않음

2. **에러 발생 시 처리 누락**
   - `catch` 블록에서 에러만 로깅하고 `contentDetails`에 빈 배열을 저장하지 않음
   - 총 페이지수/회차 조회도 시도하지 않음

3. **상세 정보가 없을 때 범위 초기화 문제**
   - 상세 정보가 없을 때 `editingRange`가 제대로 초기화되지 않을 수 있음
   - 총량이 없을 때 현재 범위로 초기화하지 않음

## 해결 방법

### 1. API 호출 실패 시 빈 배열 저장

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

```typescript
} else {
  // API 호출 실패 시에도 빈 배열로 저장하여 직접 입력 UI 표시
  const emptyDetailData: ContentDetail =
    content.content_type === "book"
      ? { details: [], type: "book" as const }
      : { details: [], type: "lecture" as const };
  
  cachedDetailsRef.current.set(content.content_id, emptyDetailData);
  setContentDetails(new Map([[editingRangeIndex, emptyDetailData]]));
  
  // 총 페이지수/회차가 있으면 범위 자동 설정
  if (total && total > 0) {
    setEditingRange({
      start: "1",
      end: String(total),
    });
  } else {
    // 총량도 없으면 현재 범위 유지
    setEditingRange({
      start: String(content.start_range),
      end: String(content.end_range),
    });
  }
}
```

**효과**:
- API 호출 실패 시에도 `contentDetails`에 빈 배열을 저장하여 직접 입력 UI가 표시됨
- 총 페이지수/회차가 있으면 전체 범위로 자동 설정
- 총량이 없으면 현재 범위로 초기화

### 2. 에러 발생 시 처리 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

```typescript
} catch (error) {
  const planGroupError = toPlanGroupError(
    error,
    PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
  );
  console.error(
    "[useRangeEditor] 상세정보 조회 실패 (에러):",
    {
      type: "API_ERROR",
      error: planGroupError,
      contentType: content.content_type,
      contentId: content.content_id,
      title: content.title,
      reason: "API 호출 실패 또는 네트워크 에러",
    }
  );
  
  // 에러 발생 시에도 빈 배열로 저장하여 직접 입력 UI 표시
  const emptyDetailData: ContentDetail =
    content.content_type === "book"
      ? { details: [], type: "book" as const }
      : { details: [], type: "lecture" as const };
  
  cachedDetailsRef.current.set(content.content_id, emptyDetailData);
  setContentDetails(new Map([[editingRangeIndex, emptyDetailData]]));
  
  // 총 페이지수/회차 조회 시도
  try {
    const total = await fetchContentTotal(content.content_type, content.content_id);
    if (total) {
      setContentTotals(new Map([[editingRangeIndex, total]]));
      setEditingRange({
        start: "1",
        end: String(total),
      });
    } else {
      // 총량도 없으면 현재 범위 유지
      setEditingRange({
        start: String(content.start_range),
        end: String(content.end_range),
      });
    }
  } catch (totalError) {
    // 총량 조회 실패 시 현재 범위 유지
    setEditingRange({
      start: String(content.start_range),
      end: String(content.end_range),
    });
  }
}
```

**효과**:
- 에러 발생 시에도 `contentDetails`에 빈 배열을 저장하여 직접 입력 UI가 표시됨
- 총 페이지수/회차 조회를 시도하여 가능하면 전체 범위로 설정
- 모든 조회가 실패해도 현재 범위로 초기화하여 사용자가 수정할 수 있도록 함

### 3. 상세 정보가 없을 때 범위 초기화 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

```typescript
// 상세정보가 없고 총 페이지수/회차가 있는 경우, 전체 범위로 자동 설정
// 단, 이미 편집 중인 범위가 있으면 유지
if (total && total > 0) {
  setEditingRange((prev) => {
    // 이미 편집 중인 범위가 있으면 유지, 없으면 전체 범위로 설정
    if (prev) {
      return prev;
    }
    return {
      start: "1",
      end: String(total),
    };
  });
} else {
  // 총량도 없으면 현재 범위로 초기화 (없으면 기본값)
  setEditingRange((prev) => {
    if (prev) {
      return prev;
    }
    return {
      start: String(content.start_range || 1),
      end: String(content.end_range || 100),
    };
  });
}
```

**효과**:
- 이미 편집 중인 범위가 있으면 유지하여 사용자 입력이 사라지지 않음
- 총량이 없어도 현재 범위로 초기화하여 사용자가 수정할 수 있도록 함

## 변경된 파일

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
   - API 호출 실패 시 빈 배열 저장
   - 에러 발생 시 빈 배열 저장 및 총량 조회 시도
   - 상세 정보가 없을 때 범위 초기화 개선

## 테스트 시나리오

1. **상세 정보가 없는 콘텐츠 범위 편집**
   - 상세 정보가 없는 콘텐츠의 범위 편집 버튼 클릭
   - 직접 입력 UI가 표시되는지 확인
   - 시작/종료 범위를 수정하고 저장
   - 수정된 범위가 반영되는지 확인

2. **API 호출 실패 시 직접 입력 UI 표시**
   - 네트워크 오류 상황에서 범위 편집 시도
   - 직접 입력 UI가 표시되는지 확인
   - 범위를 수정하고 저장할 수 있는지 확인

3. **에러 발생 시 처리**
   - 상세 정보 조회 중 에러 발생
   - 직접 입력 UI가 표시되는지 확인
   - 총 페이지수/회차가 있으면 전체 범위로 자동 설정되는지 확인
   - 총량이 없어도 현재 범위로 초기화되어 수정할 수 있는지 확인

## 참고사항

- `AddedContentsList.tsx`의 조건 `contentInfo && contentInfo.details.length > 0`는 올바르게 작동함
- `contentInfo`가 `undefined`이거나 `contentInfo.details.length === 0`일 때 직접 입력 UI가 표시됨
- `onRangeChange` 핸들러가 연결되어 있어 직접 입력 값이 실시간으로 반영됨

