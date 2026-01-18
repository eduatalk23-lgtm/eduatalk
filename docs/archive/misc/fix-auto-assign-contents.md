# 추천 콘텐츠 자동 배정 수정

## 문제 상황

"추천 콘텐츠 자동 배정"을 선택한 후 추천을 받아도 선택 항목에 포함되지 않는 문제가 발생했습니다.

### 증상
- 자동 배정 옵션을 체크하고 추천 요청
- 추천 콘텐츠는 받아지지만 `recommended_contents`에 자동으로 추가되지 않음

## 원인 분석

1. **API 응답 형식 불일치**
   - `autoAssignContents` 함수에서 API 응답을 처리할 때 `result.details` 또는 `result.episodes`를 직접 참조
   - 실제 API 응답 형식은 `{ success: true, data: { details: [...] } }` 형식
   - 따라서 `result.data.details` 또는 `result.data.episodes`를 사용해야 함

2. **에러 처리 부족**
   - API 응답이 실패하거나 예상과 다른 형식일 때 적절한 처리 없음
   - 레거시 응답 형식 지원 부족

## 수정 내용

### `autoAssignContents` 함수 수정

API 응답 형식을 올바르게 처리하도록 수정:

```typescript
if (response.ok) {
  const result = await response.json();

  // API 응답 형식: { success: true, data: { details/episodes: [...] } }
  if (result.success && result.data) {
    if (r.contentType === "book") {
      const details = result.data.details || [];
      if (details.length > 0) {
        startRange = details[0].page_number || 1;
        endRange = details[details.length - 1].page_number || 100;
      }
    } else if (r.contentType === "lecture") {
      const episodes = result.data.episodes || [];
      if (episodes.length > 0) {
        startRange = episodes[0].episode_number || 1;
        endRange = episodes[episodes.length - 1].episode_number || 100;
      }
    }
  } else {
    // 레거시 응답 형식 지원 (하위 호환성)
    // ...
  }
}
```

## 테스트 방법

1. Step4RecommendedContents에서 "콘텐츠 자동 배정" 옵션 체크
2. 교과 선택 및 개수 설정
3. 추천 요청
4. 추천 콘텐츠가 자동으로 `recommended_contents`에 추가되는지 확인
5. "이미 추가된 추천 콘텐츠 목록"에 표시되는지 확인

## 예상 결과

- 자동 배정 옵션을 선택하면 추천 받은 콘텐츠가 자동으로 추가됨
- 범위는 전체 범위(첫 페이지/회차 ~ 마지막 페이지/회차)로 설정됨
- 최대 9개 제한 확인 및 처리
- API 응답 형식이 올바르게 처리됨

## 관련 파일

- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

