# 학생 페이지 개정교육과정 드롭다운 표시 문제 해결

## 📋 문제 상황

학생 페이지의 마스터 콘텐츠 검색 필터에서 개정교육과정 드롭다운에 "전체"만 표시되고 실제 데이터(2015 개정, 2022 개정)가 보이지 않는 문제가 발생했습니다.

반면 관리자 페이지에서는 동일한 데이터가 정상적으로 표시되었습니다.

## 🔍 원인 분석

### 1. 캐시 문제
학생 페이지에서 `unstable_cache`를 사용하여 필터 옵션을 캐싱하고 있었는데, 이전에 빈 데이터가 캐시되어 있을 가능성이 있었습니다.

### 2. 함수 차이
- **관리자 페이지**: `lib/data/contentMetadata.ts`의 `getCurriculumRevisions()` 함수 사용
- **학생 페이지**: `lib/data/contentMasters.ts`의 `getCurriculumRevisions()` 함수 사용

두 함수가 다른 파일에 있었고, 관리자 페이지에서는 작동하지만 학생 페이지에서는 작동하지 않았습니다.

## ✅ 해결 방법

### 1. 캐시 제거
학생 페이지에서 필터 옵션 조회 시 캐시를 제거하고 직접 조회하도록 변경했습니다.

**변경 전:**
```typescript
async function getCachedFilterOptions() {
  const getCached = unstable_cache(
    async () => {
      const [curriculumRevisions, publishers] = await Promise.all([
        getCurriculumRevisions(),
        getPublishersForFilter(),
      ]);
      // ...
    },
    ["master-books-filter-options"],
    {
      revalidate: 3600, // 1시간 캐시
      tags: ["master-books-filter-options"],
    }
  );
  return getCached();
}
```

**변경 후:**
```typescript
// 필터 옵션 조회 (드롭다운용) - 캐시 없이 직접 조회
const [curriculumRevisions, publishers] = await Promise.all([
  getCurriculumRevisions(),
  getPublishersForFilter(),
]);
```

### 2. 통일된 함수 사용
학생 페이지도 관리자 페이지와 동일한 함수(`lib/data/contentMetadata.ts`)를 사용하도록 변경했습니다.

**변경 전:**
```typescript
import { getCurriculumRevisions } from "@/lib/data/contentMasters";
```

**변경 후:**
```typescript
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
```

### 3. 디버깅 로그 추가
데이터 조회 상태를 확인할 수 있도록 디버깅 로그를 추가했습니다.

```typescript
console.log("[student/master-books] 개정교육과정 조회 결과:", {
  count: curriculumRevisions.length,
  revisions: curriculumRevisions.map((r) => ({ id: r.id, name: r.name })),
});
```

## 📝 변경된 파일

### 1. `app/(student)/contents/master-books/page.tsx`
- 필터 옵션 조회에서 캐시 제거
- `lib/data/contentMetadata.ts`의 함수 사용
- 디버깅 로그 추가

### 2. `app/(student)/contents/master-lectures/page.tsx`
- 필터 옵션 조회에서 캐시 제거
- `lib/data/contentMetadata.ts`의 함수 사용

### 3. `lib/data/contentMasters.ts`
- `getCurriculumRevisions()` 함수에 디버깅 로그 추가

## 🎯 기대 효과

1. 학생 페이지에서도 개정교육과정 드롭다운에 실제 데이터가 표시됩니다.
2. 관리자 페이지와 학생 페이지가 동일한 함수를 사용하여 일관성이 향상됩니다.
3. 캐시 문제로 인한 데이터 불일치 문제가 해결됩니다.

## 📌 참고 사항

- 검색 결과는 여전히 캐싱을 사용합니다 (1분 캐시)
- 필터 옵션만 캐시 없이 직접 조회하도록 변경했습니다
- 관리자 페이지와 동일한 방식으로 동작합니다

---

**작성일**: 2025-02-04
**관련 이슈**: 학생 페이지 개정교육과정 드롭다운 표시 문제

