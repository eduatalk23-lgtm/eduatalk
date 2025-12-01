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

### 2. StudentContentsPanel 수정

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
1. `lib/types/content-selection.ts` - 타입 정의 확장
2. `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx` - custom 타입 처리 로직 수정

### 변경 라인 수
- 총 약 15줄 수정

### 호환성
- ✅ 기존 기능에 영향 없음
- ✅ 하위 호환성 유지
- ✅ `RangeSettingModal`은 이미 `"book" | "lecture"`만 허용하므로 추가 수정 불필요

## 관련 이슈

- 에러 위치: `RangeSettingModal.tsx:66:17`
- API 엔드포인트: `/api/student-content-details`
- 관련 문서: `docs/2025-01-30-custom-type-range-error-fix.md` (범위 편집 시 에러 수정)

## 결론

`custom` 타입 콘텐츠 선택 시 범위 설정 모달이 열리지 않도록 수정하고, 타입 정의를 확장하여 타입 안전성을 확보했습니다. 이제 `custom` 타입 콘텐츠는 범위 설정 없이 바로 추가되며, API 호출 에러가 발생하지 않습니다.

