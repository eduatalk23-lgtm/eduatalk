# 마스터 콘텐츠 검색 필터 개정교육과정 드롭다운 수정

## 문제 상황

마스터 콘텐츠 검색 필터에서 계층형으로 개정교육과정부터 선택하는데, 드롭다운에서 '전체' 말고는 2015 개정, 2022 개정 값이 보이지 않았습니다.

### 증상
- 개정교육과정 드롭다운에 '전체'만 표시됨
- 데이터베이스에는 2015 개정, 2022 개정 데이터가 존재함

## 원인 분석

`is_active = true` 필터로 인해 `is_active`가 `false`이거나 `null`인 데이터가 제외되고 있었습니다.

### 문제가 있던 위치

1. **`app/(student)/contents/master-books/page.tsx`**
   - `getCachedFilterOptions()` 함수에서 `is_active = true` 필터 사용

2. **`app/(student)/contents/master-lectures/page.tsx`**
   - `getCachedFilterOptions()` 함수에서 `is_active = true` 필터 사용

3. **`lib/data/contentMasters.ts`**
   - `getCurriculumRevisions()` 함수에서 `is_active = true` 필터 사용

## 해결 방법

모든 위치에서 `is_active` 필터를 제거하여 모든 개정교육과정 데이터를 조회하도록 수정했습니다.

### 변경 사항

#### 1. 교재 검색 페이지

**파일**: `app/(student)/contents/master-books/page.tsx`

```typescript
// 변경 전
const { data } = await supabase
  .from("curriculum_revisions")
  .select("id, name")
  .eq("is_active", true)  // ❌ 제거
  .order("name", { ascending: true });

// 변경 후
const { data } = await supabase
  .from("curriculum_revisions")
  .select("id, name")
  .order("name", { ascending: true });
```

#### 2. 강의 검색 페이지

**파일**: `app/(student)/contents/master-lectures/page.tsx`

동일한 방식으로 `is_active` 필터 제거

#### 3. 데이터 페칭 함수

**파일**: `lib/data/contentMasters.ts`

`getCurriculumRevisions()` 함수에서 `is_active` 필터 제거

## 영향 범위

- ✅ 교재 검색 페이지 (`/contents/master-books`)
- ✅ 강의 검색 페이지 (`/contents/master-lectures`)
- ✅ 마스터 콘텐츠 검색 API (`/api/curriculum-revisions`)

## 추가 확인 사항

### RLS 정책 확인

`curriculum_revisions` 테이블에 RLS 정책이 설정되어 있다면, 공개적으로 읽을 수 있도록 정책이 설정되어 있어야 합니다.

```sql
-- curriculum_revisions 테이블의 RLS 정책 예시
CREATE POLICY "개정교육과정 공개 읽기"
ON curriculum_revisions
FOR SELECT
TO anon, authenticated
USING (true);
```

### 데이터 확인 방법

데이터베이스에서 직접 데이터 확인:

```sql
SELECT id, name, is_active, year, created_at 
FROM curriculum_revisions 
ORDER BY name;
```

### 캐시 무효화

Next.js의 `unstable_cache`를 사용하고 있으므로, 변경사항 반영을 위해:

1. 개발 서버 재시작
2. 또는 캐시 태그를 사용한 재검증:
   - `master-books-filter-options`
   - `master-lectures-filter-options`

## 테스트 체크리스트

- [ ] 교재 검색 페이지에서 개정교육과정 드롭다운에 모든 옵션이 표시되는지 확인
- [ ] 강의 검색 페이지에서 개정교육과정 드롭다운에 모든 옵션이 표시되는지 확인
- [ ] '전체' 선택 시 모든 교재/강의가 조회되는지 확인
- [ ] 특정 개정교육과정 선택 시 해당 데이터만 필터링되는지 확인
- [ ] 계층형 필터(개정교육과정 → 교과 → 과목)가 정상 작동하는지 확인

## 참고 사항

### 다른 위치에서의 `is_active` 사용

다른 곳에서는 `is_active` 필터를 유지해야 할 수도 있습니다:

- 관리자 페이지에서 활성화된 항목만 표시하는 경우
- 특정 비즈니스 로직에서 활성화된 항목만 사용하는 경우

하지만 검색 필터에서는 사용자가 모든 옵션을 볼 수 있어야 하므로 필터를 제거했습니다.

## 날짜

2025-02-04

