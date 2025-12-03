# Contents 페이지 필터 contentType 수정

## 📋 작업 개요

`/contents` 페이지에서 출판사/플랫폼, 난이도 필터가 표시되지 않는 문제를 해결했습니다.

## 🔍 문제 원인

`app/(student)/contents/page.tsx`에서 `UnifiedContentFilter` 컴포넌트에 `contentType` prop을 전달할 때:
- **전달하는 값**: `activeTab` ("books" 또는 "lectures")
- **기대하는 값**: "book" 또는 "lecture" (단수형)

`UnifiedContentFilter` 컴포넌트는 다음과 같은 조건으로 필터를 표시합니다:
- 출판사: `contentType === "book" && filterOptions.publishers && filterOptions.publishers.length > 0`
- 플랫폼: `contentType === "lecture" && filterOptions.platforms && filterOptions.platforms.length > 0`
- 난이도: `showDifficulty && filterOptions.difficulties && filterOptions.difficulties.length > 0`

따라서 `contentType`이 "books" 또는 "lectures"로 전달되면 조건이 false가 되어 필터가 표시되지 않았습니다.

## ✅ 해결 방법

`activeTab` 값을 단수형으로 변환하여 전달하도록 수정했습니다:

```typescript
// 수정 전
contentType={activeTab}

// 수정 후
contentType={activeTab === "books" ? "book" : "lecture"}
```

## 📝 수정된 파일

- `app/(student)/contents/page.tsx`
  - `StudentContentFilterWrapper` 함수 내 `UnifiedContentFilter`의 `contentType` prop 수정

## 🔍 확인된 다른 페이지들

다음 페이지들은 이미 올바르게 설정되어 있었습니다:
- `app/(admin)/admin/master-books/page.tsx` - `contentType="book"` ✅
- `app/(admin)/admin/master-lectures/page.tsx` - `contentType="lecture"` ✅
- `app/(student)/contents/master-books/page.tsx` - `contentType="book"` ✅
- `app/(student)/contents/master-lectures/page.tsx` - `contentType="lecture"` ✅

## 🎯 결과

이제 `/contents` 페이지에서:
- "교재" 탭 선택 시: 출판사 필터와 난이도 필터가 표시됩니다.
- "강의" 탭 선택 시: 플랫폼 필터와 난이도 필터가 표시됩니다.

## 📅 작업 일시

2025-02-03

