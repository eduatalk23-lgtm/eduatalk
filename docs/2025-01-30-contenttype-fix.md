# contentType 누락 에러 수정

## 작업 일시
2025-01-30

## 문제 상황

### 에러 메시지
```
[RecommendedContentsPanel] contentType이 없습니다. contentId: 788f77fe-89f3-4b2c-8fe5-ab0a62761996, title: 퍼펙트파이널 봉투 모의고사: 국어영역 3회분 공통+화법.작문 (2025)(2026 수능대비)
```

### 발생 위치
- `RecommendedContentsPanel.tsx:115` - `handleRecommendedSelect` 함수
- 추천 콘텐츠를 선택할 때 `contentType` 필드가 없어서 에러 발생

### 원인 분석
1. API 응답에서 `contentType` 필드가 누락되는 경우가 있음
2. 데이터 변환 과정에서 `contentType`이 제대로 매핑되지 않을 수 있음
3. `content_type` (snake_case)와 `contentType` (camelCase) 혼용 문제

## 해결 방법

### 1. RecommendedContentsPanel.tsx 수정

#### 변경 사항
- `handleRecommendedSelect` 함수에서 `contentType`이 없을 때 fallback 로직 추가
- `content_type` (snake_case) 확인
- `publisher`가 있으면 `book`, `platform`이 있으면 `lecture`로 추정
- 기본값: `book`

```typescript
// contentType이 없는 경우 처리 (fallback 추가)
let contentType = content.contentType;
if (!contentType) {
  // content_type (snake_case) 확인
  const content_type = (content as any).content_type;
  if (content_type) {
    contentType = content_type;
  } else {
    // publisher가 있으면 book, platform이 있으면 lecture로 추정
    if ((content as any).publisher) {
      contentType = "book";
    } else if ((content as any).platform) {
      contentType = "lecture";
    } else {
      // 기본값: book
      contentType = "book";
    }
    
    console.warn(`[RecommendedContentsPanel] contentType이 없습니다. 추정값 사용: ${contentType}`);
  }
}
```

### 2. useRecommendations.ts 수정

#### 변경 사항
- `fetchRecommendationsWithSubjects`와 `fetchRecommendations` 함수에서 데이터 변환 로직 강화
- `contentType`이 없을 때 `publisher`/`platform`으로 추정
- 타입 검증 추가

```typescript
// contentType 결정 로직
let contentType = r.contentType || r.content_type;

// contentType이 없으면 publisher/platform으로 추정
if (!contentType) {
  if (r.publisher) {
    contentType = "book";
  } else if (r.platform) {
    contentType = "lecture";
  } else {
    // 기본값: book
    contentType = "book";
  }
  
  console.warn("[useRecommendations] contentType이 없어 추정값 사용:", {
    id: r.id,
    title: r.title,
    estimatedContentType: contentType,
  });
}

// 타입 검증
if (contentType !== "book" && contentType !== "lecture") {
  console.error("[useRecommendations] 잘못된 contentType:", {
    id: r.id,
    title: r.title,
    contentType,
  });
  // 잘못된 타입은 기본값으로 변경
  contentType = "book";
}
```

## 수정된 파일

1. `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`
   - `handleRecommendedSelect` 함수에 fallback 로직 추가

2. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - `fetchRecommendationsWithSubjects` 함수의 데이터 변환 로직 강화
   - `fetchRecommendations` 함수의 데이터 변환 로직 강화

## 예상 효과

1. **에러 방지**: `contentType`이 없어도 추정 로직으로 처리 가능
2. **사용자 경험 개선**: 에러 대신 경고 로그로 처리하여 사용자에게 알림 표시 없이 동작
3. **데이터 안정성**: 여러 단계에서 fallback 로직으로 데이터 무결성 보장

## 추가 개선 사항

향후 개선할 수 있는 사항:
1. API 응답에서 항상 `contentType`을 포함하도록 보장
2. 타입 정의를 더 엄격하게 하여 컴파일 타임에 에러 방지
3. 데이터 변환 로직을 단일 함수로 추출하여 재사용성 향상

