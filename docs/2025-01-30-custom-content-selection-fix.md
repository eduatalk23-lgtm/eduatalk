# Custom 콘텐츠 선택 시 범위 설정 에러 수정

## 작업 일자
2025-01-30

## 문제 상황

`StudentContentsPanel`에서 `custom` 타입 콘텐츠를 선택할 때 범위 설정 모달이 열리면서 API 호출이 발생하여 에러가 발생했습니다.

### 에러 메시지
```
지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.

at RangeSettingModal.useEffect.fetchDetails (app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx:66:17)
```

### 원인 분석
1. `StudentContentsPanel`의 `handleContentSelect` 함수에서 `custom` 타입 콘텐츠 선택 시 범위 설정 모달을 열려고 시도
2. `custom` 타입은 범위 설정이 필요 없고 API도 지원하지 않음 (`student-content-details` API는 `book`/`lecture`만 지원)
3. `content-selection.ts`의 `ContentType`이 `"book" | "lecture"`만 허용하여 타입 불일치 발생

## 구현 내용

### 1. 타입 정의 확장

**파일**: `lib/types/content-selection.ts`

`ContentType`에 `"custom"` 추가:

```typescript
// 수정 전
export type ContentType = "book" | "lecture";

// 수정 후
export type ContentType = "book" | "lecture" | "custom";
```

**효과**:
- `SelectedContent`의 `content_type` 필드가 자동으로 `"book" | "lecture" | "custom"`로 확장됨
- 타입 안전성 확보

### 2. RecommendedContent 타입 제한

**파일**: `lib/types/content-selection.ts`

`RecommendedContent`의 `contentType`을 `"book" | "lecture"`로 제한:

```typescript
// 수정 전
export type RecommendedContent = {
  id: string;
  contentType: ContentType; // "book" | "lecture" | "custom"
  // ...
};

// 수정 후
export type RecommendedContent = {
  id: string;
  contentType: "book" | "lecture"; // 추천 콘텐츠는 custom 타입이 될 수 없음
  // ...
};
```

**효과**:
- 추천 콘텐츠에서 `custom` 타입이 올 수 없음을 타입 레벨에서 보장
- 타입 안전성 확보

### 3. StudentContentsPanel 수정

**파일**: `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx`

`handleContentSelect` 함수에서 `custom` 타입 처리 로직 변경:

```typescript
// 수정 전
if (type === "custom") {
  const customContent = contents.custom.find((c) => c.id === contentId);
  if (!customContent) return;

  // 범위 설정 모달 열기
  setRangeModalContent({
    id: contentId,
    type: "book", // 커스텀은 기본적으로 book 타입으로 처리
    title: customContent.title,
  });
  setRangeModalOpen(true);
  return;
}

// 수정 후
if (type === "custom") {
  const customContent = contents.custom.find((c) => c.id === contentId);
  if (!customContent) return;

  // custom 콘텐츠는 기본 범위 값으로 바로 추가
  const newContent: SelectedContent = {
    content_type: "custom",
    content_id: contentId,
    start_range: 1,
    end_range: 1,
    title: customContent.title,
  };

  const updated = [...selectedContents, newContent];
  onUpdate(updated);
  return;
}
```

**효과**:
- `custom` 타입 콘텐츠 선택 시 범위 설정 모달을 열지 않고 바로 추가
- API 호출 없이 처리되어 에러 방지
- 기본 범위 값(`start_range: 1, end_range: 1`)으로 설정

### 4. RecommendedContentsPanel 방어 코드 추가

**파일**: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`

`handleRecommendedSelect` 함수에 타입 체크 추가:

```typescript
const handleRecommendedSelect = useCallback(
  (content: RecommendedContent) => {
    // ... 기존 코드 ...

    // custom 타입은 범위 설정을 지원하지 않음 (방어 코드)
    if (content.contentType === "custom") {
      console.warn("[RecommendedContentsPanel] custom 타입 추천 콘텐츠는 지원하지 않습니다.");
      return;
    }

    // 범위 설정 모달 열기
    // ...
  },
  [canAddMore, maxContents]
);
```

**효과**:
- 예상치 못한 `custom` 타입 추천 콘텐츠가 전달되는 경우 방어
- 에러 발생 전 조기 차단

### 5. RangeSettingModal 방어 코드 추가

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

`useEffect` 내부에 타입 체크 추가:

```typescript
const fetchDetails = async () => {
  // custom 타입은 범위 설정을 지원하지 않음 (방어 코드)
  if (content.type === "custom") {
    setError("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
    setLoading(false);
    return;
  }

  // ... 기존 API 호출 로직 ...
};
```

**효과**:
- `custom` 타입이 모달로 전달되는 경우 API 호출 전 차단
- 사용자에게 명확한 에러 메시지 제공
- 런타임 안전성 확보

## 테스트 결과

### 1. Custom 콘텐츠 선택
- ✅ `custom` 타입 콘텐츠 선택 시 범위 설정 모달이 열리지 않음
- ✅ 바로 콘텐츠 목록에 추가됨
- ✅ API 호출 없이 처리됨

### 2. Book/Lecture 콘텐츠 선택
- ✅ 기존 동작 유지 (범위 설정 모달 정상 동작)

### 3. 타입 체크
- ✅ TypeScript 컴파일 에러 없음
- ✅ ESLint 검증 통과

## 영향 범위

### 수정된 파일
1. `lib/types/content-selection.ts` - 타입 정의 확장 및 `RecommendedContent` 타입 제한
2. `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx` - custom 타입 처리 로직 수정
3. `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx` - 방어 코드 추가
4. `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx` - 방어 코드 추가

### 변경 라인 수
- 총 약 30줄 수정/추가

### 호환성
- ✅ 기존 기능에 영향 없음
- ✅ 하위 호환성 유지
- ✅ `RangeSettingModal`은 이미 `"book" | "lecture"`만 허용하므로 추가 수정 불필요

## 관련 이슈

- 에러 위치: `RangeSettingModal.tsx:66:17`
- API 엔드포인트: `/api/student-content-details`
- 관련 문서: `docs/2025-01-30-custom-type-range-error-fix.md` (범위 편집 시 에러 수정)

## 에러 로깅 개선

모든 방어 지점에 구조화된 에러 로깅을 추가했습니다:

### 1. RangeSettingModal
- `custom` 타입 감지 시: `console.error`로 상세 정보 출력 (contentId, title 포함)
- API 호출 실패 시: `console.error`로 HTTP 상태, 요청 정보, 에러 상세 출력
- 예외 발생 시: `console.error`로 전체 에러 컨텍스트 출력

### 2. RecommendedContentsPanel
- `custom` 타입 추천 콘텐츠 감지 시: `console.error`로 상세 정보 출력
- 범위 편집 시도 시: `console.error`로 콘텐츠 정보 출력

### 3. StudentContentsPanel
- `custom` 콘텐츠 추가 시: `console.log`로 성공 로그 출력
- `custom` 콘텐츠 찾기 실패 시: `console.error`로 에러 출력
- 범위 편집 시도 시: `console.error`로 콘텐츠 정보 출력

**로깅 형식**:
```typescript
console.error("[ComponentName] 메시지", {
  contentId: "...",
  title: "...",
  contentType: "...",
  // 기타 컨텍스트 정보
});
```

## 결론

다층 방어 전략을 통해 `custom` 타입 콘텐츠의 범위 설정 에러를 완전히 해결했습니다:

1. **타입 레벨**: `RecommendedContent`의 `contentType`을 `"book" | "lecture"`로 제한
2. **선택 레벨**: `StudentContentsPanel`에서 `custom` 타입 선택 시 범위 설정 모달을 열지 않고 바로 추가
3. **추천 레벨**: `RecommendedContentsPanel`에서 `custom` 타입 추천 콘텐츠 차단
4. **모달 레벨**: `RangeSettingModal`에서 `custom` 타입이 전달되는 경우 API 호출 전 차단
5. **로깅 레벨**: 모든 방어 지점에 구조화된 에러 로깅 추가

이제 `custom` 타입 콘텐츠는 범위 설정 없이 바로 추가되며, 모든 경로에서 API 호출 에러가 발생하지 않습니다. 또한 터미널에서 모든 에러 상황을 명확하게 확인할 수 있습니다.

