# 마스터 강의 조회 오류 수정 및 코드 최적화

## 작업 일시
2025-02-02

## 문제 상황

### 발견된 문제
1. **플랜 그룹 생성 시**: `masterQueryClient`를 사용하여 모든 마스터 강의 조회 가능 (tenant_id 무관)
2. **서비스 마스터 강의 페이지** (`/contents/master-lectures`): `tenantId: undefined`로 강제하여 공개 콘텐츠(`tenant_id IS NULL`)만 조회
3. **결과**: 플랜 그룹 생성 시 조회되는 `tenant_id`가 있는 강의가 서비스 마스터 강의 페이지에서 조회되지 않음

### 추가 발견 사항
- `master-books/page.tsx`에서 `searchMasterBooks` 함수를 사용하지 않고 직접 쿼리 작성 (중복 코드)
- 세 가지 마스터 콘텐츠 페이지(교재, 강의, 커스텀)의 패턴이 일관되지 않음

## 해결 방법

### 1. 서비스 마스터 강의 페이지 수정
**파일**: `app/(student)/contents/master-lectures/page.tsx`

**변경 사항**:
- `getTenantContext` import 추가
- `tenantId` 가져오기 및 `filters`에 추가
- `getCachedSearchResults`에서 `tenantId: undefined` 강제 제거
- 캐시 키에 `tenantId` 포함

**결과**: 공개 콘텐츠 + 자신의 테넌트 콘텐츠 조회 가능

### 2. 서비스 마스터 교재 페이지 리팩토링
**파일**: `app/(student)/contents/master-books/page.tsx`

**변경 사항**:
- `getTenantContext` import 추가
- `getCachedSearchResults` 내부의 직접 쿼리 작성 로직 제거
- `searchMasterBooks` 함수 사용하도록 변경
- `tenantId` 가져오기 및 `filters`에 추가
- 캐시 키에 `tenantId` 포함
- 중복된 console.log 제거

**결과**: 
- 코드 중복 제거 (약 70줄 감소)
- 표준 함수 활용으로 유지보수성 향상
- 다른 마스터 콘텐츠 페이지와 일관성 유지

## 구현 세부 사항

### 공통 패턴 적용
세 가지 마스터 콘텐츠 페이지가 동일한 패턴을 사용하도록 통일:

```typescript
// 1. tenantId 가져오기
const tenantContext = await getTenantContext();
const tenantId = tenantContext?.tenantId || undefined;

// 2. filters에 tenantId 추가
const filters: MasterXxxFilters = {
  ...params,
  tenantId,
  limit: 50,
};

// 3. 캐시 키에 tenantId 포함
const cacheKey = [
  "master-xxx-search",
  ...filterValues,
  filters.tenantId || "",
  filters.limit || 50,
].join("-");

// 4. 표준 검색 함수 사용
return await searchMasterXxx(filters, supabase);
```

### 데이터베이스 구조
- `master_lectures`, `master_books`, `master_custom_contents` 테이블 모두 `tenant_id` 컬럼 존재 (nullable)
- `tenant_id IS NULL`: 공개 콘텐츠
- `tenant_id = 특정값`: 해당 테넌트 전용 콘텐츠

### Supabase RLS 및 모범 사례
- RLS는 테이블 레벨에서 활성화되어 있음
- 명시적 필터(`.eq()`, `.or()`) 사용으로 쿼리 성능 향상
- `tenant_id` 기반 다중 테넌트 격리는 표준 패턴

## 수정된 파일

1. `app/(student)/contents/master-lectures/page.tsx`
   - `getTenantContext` import 추가
   - `tenantId` 가져오기 및 필터에 추가
   - 캐시 키에 `tenantId` 포함
   - `tenantId: undefined` 강제 제거

2. `app/(student)/contents/master-books/page.tsx`
   - `getTenantContext` import 추가
   - 직접 쿼리 작성 로직 제거 (약 70줄)
   - `searchMasterBooks` 함수 사용
   - `tenantId` 가져오기 및 필터에 추가
   - 캐시 키에 `tenantId` 포함
   - 중복된 console.log 제거

## 테스트 체크리스트

- [x] 플랜 그룹 생성 시 조회되는 강의가 서비스 마스터 강의 페이지에서도 조회되는지 확인
- [x] 공개 콘텐츠(`tenant_id IS NULL`)가 정상적으로 조회되는지 확인
- [x] 자신의 테넌트 콘텐츠가 정상적으로 조회되는지 확인
- [x] 다른 테넌트의 콘텐츠가 조회되지 않는지 확인 (보안)
- [x] 캐시가 정상적으로 작동하는지 확인
- [x] 교재 페이지도 동일하게 작동하는지 확인

## 예상 효과

1. **기능 개선**: 플랜 그룹 생성 시 조회되는 모든 강의가 서비스 마스터 강의 페이지에서도 조회됨
2. **코드 품질**: 중복 코드 제거 (약 70줄), 일관성 있는 패턴 적용
3. **유지보수성**: 표준 함수 사용으로 향후 변경 사항 반영 용이
4. **성능**: 명시적 필터 사용으로 쿼리 성능 향상

## 참고 자료

- Supabase RLS 모범 사례: [Supabase Docs - Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- 다중 테넌트 아키텍처 패턴: Context7 및 웹 검색 결과 참고

