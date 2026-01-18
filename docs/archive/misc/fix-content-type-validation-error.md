# 콘텐츠 타입 검증 에러 수정

## 문제 상황

`/api/master-content-details` API 호출 시 "지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요." 에러가 발생했습니다.

### 에러 메시지
```
지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.
```

## 원인 분석

1. **타입 검증 부족**
   - `MasterContentsPanel`에서 `masterContent.content_type`을 그대로 `RangeSettingModal`에 전달
   - `RangeSettingModal`에서 `content.type`을 API에 전달하기 전 검증 없음
   - API 라우트에서 `contentType` 파라미터 검증은 있으나 에러 메시지가 불명확

2. **타입 불일치 가능성**
   - `ContentMaster` 타입은 `content_type: "book" | "lecture"`로 정의되어 있으나
   - 실제 데이터에서 다른 값이 올 수 있음

## 수정 내용

### 1. MasterContentsPanel 타입 검증 추가

`content_type`이 "book" 또는 "lecture"인지 확인하고, 그렇지 않으면 에러 처리:

```typescript
// content_type이 "book" 또는 "lecture"인지 확인
if (contentType !== "book" && contentType !== "lecture") {
  console.error("[MasterContentsPanel] 잘못된 content_type:", {
    id: masterContent.id,
    title: masterContent.title,
    content_type: contentType,
  });
  alert("지원하지 않는 콘텐츠 타입입니다.");
  return;
}
```

### 2. RangeSettingModal 타입 검증 추가

API 호출 전 `content.type` 검증:

```typescript
// content.type 검증
if (content.type !== "book" && content.type !== "lecture") {
  const errorMessage = `[RangeSettingModal] 잘못된 content.type: ${content.type}`;
  console.error(errorMessage, {
    contentType: content.type,
    contentId: content.id,
    title: content.title,
    expectedValues: ["book", "lecture"],
  });
  setError(`지원하지 않는 콘텐츠 타입입니다. (${content.type})`);
  setLoading(false);
  return;
}
```

### 3. API 라우트 에러 메시지 개선

더 명확한 에러 메시지와 로깅 추가:

```typescript
// contentType 검증
if (contentType !== "book" && contentType !== "lecture") {
  console.error("[api/master-content-details] 잘못된 contentType:", {
    contentType,
    contentId,
    receivedValue: contentType,
    expectedValues: ["book", "lecture"],
  });
  return apiBadRequest(
    `지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요. (받은 값: ${contentType})`
  );
}
```

## 테스트 방법

1. `MasterContentsPanel`에서 콘텐츠 선택 시도
2. 잘못된 `content_type`이 있는 경우 에러 메시지 확인
3. 콘솔에서 상세 로그 확인

## 예상 결과

- 잘못된 `content_type` 값이 전달되면 즉시 에러 처리
- 더 명확한 에러 메시지 제공
- 디버깅을 위한 상세한 로그 제공

## 관련 파일

- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/api/master-content-details/route.ts`

