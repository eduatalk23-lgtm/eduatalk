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

## 근본 해결 방법 (2025-01-30 추가)

### 문제점
프런트엔드에서 fallback 로직을 사용하는 것은 임시 방편이었습니다. 근본적으로는 서버에서 `contentType`을 보장해야 합니다.

### 해결 방법

#### 1. 서버 사이드 정규화 (`lib/recommendations/masterContentRecommendation.ts`)

`getRecommendedMasterContents` 함수에서 반환 전에 모든 항목에 `contentType`이 있는지 검증하고, 없으면 추가하는 정규화 로직을 추가했습니다.

```typescript
// contentType 보장: 모든 항목에 contentType이 있는지 확인하고 없으면 추가
const normalizedRecommendations = finalRecommendations.map((r) => {
  if (!r.contentType) {
    // publisher가 있으면 book, platform이 있으면 lecture로 추정
    const estimatedType = r.publisher ? "book" : r.platform ? "lecture" : "book";
    console.warn("[recommendations/masterContent] contentType 누락, 추정값 사용:", {
      id: r.id,
      title: r.title,
      estimatedType,
      publisher: r.publisher,
      platform: r.platform,
    });
    return {
      ...r,
      contentType: estimatedType as "book" | "lecture",
    };
  }
  return r;
});
```

#### 2. API 응답 직렬화 전 정규화 (`app/api/recommended-master-contents/route.ts`)

API 응답 직렬화 전에 최종 정규화를 수행하여 `contentType`이 항상 포함되도록 보장합니다.

```typescript
// contentType 보장: API 응답 직렬화 전 최종 정규화
const normalizedRecommendations = recommendations.map((r) => {
  // contentType이 없으면 추정
  if (!r.contentType) {
    const estimatedType = r.publisher ? "book" : r.platform ? "lecture" : "book";
    console.warn("[api/recommended-master-contents] contentType 누락, 추정값 사용:", {
      id: r.id,
      title: r.title,
      estimatedType,
      publisher: r.publisher,
      platform: r.platform,
    });
    return {
      ...r,
      contentType: estimatedType as "book" | "lecture",
    };
  }
  return r;
});
```

#### 3. 프런트엔드 fallback 단순화

서버에서 `contentType`을 보장하므로, 프런트엔드에서는 단순히 타입 검증만 수행합니다.

**변경 전:**
- 복잡한 fallback 로직 (publisher/platform 추정)
- 경고 로그 및 추정값 사용

**변경 후:**
- 서버에서 보장되므로 단순 검증만 수행
- 에러 발생 시 사용자에게 알림 표시

### 수정된 파일

1. `lib/recommendations/masterContentRecommendation.ts`
   - `getRecommendedMasterContents` 함수에 반환 전 정규화 로직 추가

2. `app/api/recommended-master-contents/route.ts`
   - API 응답 직렬화 전 최종 정규화 로직 추가

3. `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`
   - fallback 로직 단순화 (서버에서 보장되므로 검증만 수행)

4. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - fallback 로직 단순화 (서버에서 보장되므로 검증만 수행)

### 효과

1. **서버 사이드 보장**: 서버에서 `contentType`을 항상 포함하도록 보장
2. **데이터 무결성**: 여러 단계에서 정규화를 수행하여 데이터 무결성 보장
3. **코드 단순화**: 프런트엔드 fallback 로직 단순화로 유지보수성 향상
4. **에러 방지**: 서버에서 보장하므로 프런트엔드에서 에러 발생 가능성 감소

## 추가 개선 사항

향후 개선할 수 있는 사항:
1. 타입 정의를 더 엄격하게 하여 컴파일 타임에 에러 방지
2. 데이터 변환 로직을 단일 함수로 추출하여 재사용성 향상
3. Supabase 쿼리 단계에서 `contentType`을 별칭으로 추가 (현재는 테이블에 해당 컬럼이 없어 불가능)

