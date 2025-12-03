# 출판사/플랫폼 필터 옵션을 실제 사용 데이터 기반으로 조회

## 📋 작업 개요

출판사/플랫폼 필터 옵션을 `publishers`/`platforms` 테이블 전체에서 조회하는 대신, `master_books`/`master_lectures` 테이블에서 실제로 사용된 ID를 기반으로 조회하도록 수정했습니다.

## 🔍 문제 상황

### 기존 방식의 문제점

1. **불필요한 옵션 표시**
   - `publishers` 테이블에 등록되어 있지만 `master_books`에서 사용되지 않은 출판사도 필터 옵션에 표시됨
   - `platforms` 테이블에 등록되어 있지만 `master_lectures`에서 사용되지 않은 플랫폼도 필터 옵션에 표시됨

2. **사용된 항목 누락 가능성**
   - `master_books`에 사용된 출판사가 `is_active = false`인 경우 필터 옵션에 나타나지 않음
   - `master_lectures`에 사용된 플랫폼이 `is_active = false`인 경우 필터 옵션에 나타나지 않음

3. **데이터 불일치**
   - 필터 옵션에는 있지만 실제 검색 결과가 없는 경우 발생 가능
   - 실제 검색 결과에는 있지만 필터 옵션에 없는 경우 발생 가능

## ✅ 해결 방법

### 변경 사항

1. **`getPublishersForFilter()` 함수 수정**
   - `master_books` 테이블에서 실제로 사용된 `publisher_id`를 DISTINCT로 조회
   - 해당 `publisher_id`로 `publishers` 테이블을 조회하여 이름 가져오기
   - `tenantId` 파라미터 추가하여 테넌트별 필터링 지원

2. **`getPlatformsForFilter()` 함수 수정**
   - `master_lectures` 테이블에서 실제로 사용된 `platform_id`를 DISTINCT로 조회
   - 해당 `platform_id`로 `platforms` 테이블을 조회하여 이름 가져오기
   - `tenantId` 파라미터 추가하여 테넌트별 필터링 지원

### 구현 세부사항

```typescript
// 출판사 조회 예시
export async function getPublishersForFilter(
  tenantId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  // 1. master_books에서 실제로 사용된 publisher_id 조회
  let publisherQuery = supabase
    .from("master_books")
    .select("publisher_id")
    .not("publisher_id", "is", null);

  // 2. tenantId 필터 적용
  if (tenantId) {
    publisherQuery = publisherQuery.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    publisherQuery = publisherQuery.is("tenant_id", null);
  }

  // 3. 사용된 publisher_id 추출 (중복 제거)
  const publisherIds = Array.from(new Set(...));

  // 4. publishers 테이블에서 해당 출판사 정보 조회
  const { data } = await supabase
    .from("publishers")
    .select("id, name")
    .in("id", publisherIds)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}
```

## 📝 수정된 파일

### 함수 수정
- `lib/data/contentMasters.ts`
  - `getPublishersForFilter()`: 실제 사용된 `publisher_id` 기반으로 조회
  - `getPlatformsForFilter()`: 실제 사용된 `platform_id` 기반으로 조회

### 호출부 수정
- `app/(admin)/admin/master-books/page.tsx`: `getPublishersForFilter(tenantId)` 호출
- `app/(admin)/admin/master-lectures/page.tsx`: `getPlatformsForFilter(tenantId)` 호출
- 학생 페이지들은 `tenantId` 없이 호출 (공개 콘텐츠만 조회)

## 🎯 결과

### 개선 사항

1. **정확한 필터 옵션**
   - 실제로 사용된 출판사/플랫폼만 필터 옵션에 표시
   - 필터 옵션과 검색 결과의 일관성 보장

2. **사용자 경험 향상**
   - 불필요한 옵션 제거로 필터 선택이 더 명확해짐
   - 선택한 필터로 항상 검색 결과가 나오도록 보장

3. **테넌트별 필터링 지원**
   - 관리자/컨설턴트는 자신의 테넌트 + 공개 콘텐츠의 출판사/플랫폼 조회
   - 학생은 공개 콘텐츠의 출판사/플랫폼만 조회

### 주의사항

- `is_active` 체크를 제거했으므로, `master_books`/`master_lectures`에 사용된 출판사/플랫폼은 `is_active = false`여도 필터 옵션에 표시됩니다.
- 이는 실제 사용 데이터를 기반으로 하므로 의도된 동작입니다.

## 📅 작업 일시

2025-02-03

