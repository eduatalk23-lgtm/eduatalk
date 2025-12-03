# UnifiedContentFilter 필터 항목 항상 표시 수정

## 📋 작업 개요

`UnifiedContentFilter` 컴포넌트에서 출판사/플랫폼/난이도 필터가 데이터 유무와 상관없이 항상 표시되도록 수정했습니다.

## 🔍 문제 상황

기존에는 필터 옵션에 데이터가 있을 때만 필터 항목이 표시되었습니다:
- 출판사: `contentType === "book" && filterOptions.publishers && filterOptions.publishers.length > 0`
- 플랫폼: `contentType === "lecture" && filterOptions.platforms && filterOptions.platforms.length > 0`
- 난이도: `showDifficulty && filterOptions.difficulties && filterOptions.difficulties.length > 0`

데이터가 없으면 필터 항목 자체가 숨겨져서 사용자가 필터 기능의 존재를 알 수 없었습니다.

## ✅ 해결 방법

데이터 유무와 상관없이 필터 항목을 항상 표시하도록 조건을 변경했습니다:

### 변경 사항

1. **출판사 필터**
   - 변경 전: `contentType === "book" && filterOptions.publishers && filterOptions.publishers.length > 0`
   - 변경 후: `contentType === "book"`
   - 옵션 렌더링: `filterOptions.publishers.map` → `filterOptions.publishers?.map`

2. **플랫폼 필터**
   - 변경 전: `contentType === "lecture" && filterOptions.platforms && filterOptions.platforms.length > 0`
   - 변경 후: `contentType === "lecture"`
   - 옵션 렌더링: `filterOptions.platforms.map` → `filterOptions.platforms?.map`

3. **난이도 필터**
   - 변경 전: `showDifficulty && filterOptions.difficulties && filterOptions.difficulties.length > 0`
   - 변경 후: `showDifficulty`
   - 옵션 렌더링: `filterOptions.difficulties.map` → `filterOptions.difficulties?.map`

### 동작 방식

- 데이터가 있는 경우: "전체" 옵션과 함께 모든 옵션이 표시됩니다.
- 데이터가 없는 경우: "전체" 옵션만 표시됩니다 (빈 드롭다운).

## 📝 수정된 파일

- `components/filters/UnifiedContentFilter.tsx`
  - 출판사 필터 조건 제거 및 옵셔널 체이닝 추가
  - 플랫폼 필터 조건 제거 및 옵셔널 체이닝 추가
  - 난이도 필터 조건 제거 및 옵셔널 체이닝 추가

## 🎯 결과

이제 모든 페이지에서:
- **교재 탭**: 출판사 필터와 난이도 필터가 항상 표시됩니다.
- **강의 탭**: 플랫폼 필터와 난이도 필터가 항상 표시됩니다.
- 데이터가 없어도 필터 UI는 표시되며, "전체" 옵션만 선택 가능합니다.

## 📅 작업 일시

2025-02-03

