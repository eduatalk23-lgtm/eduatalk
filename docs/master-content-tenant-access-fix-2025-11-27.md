# 마스터 콘텐츠 조회 권한 문제 해결 (2025-11-27)

## 문제 분석

### 발견된 문제
관리자 페이지에서 교재 정보와 교재 상세 정보를 제대로 조회하지 못하는 문제가 있었습니다. 원인은 **tenantId를 전달하지 않아서** 자신의 테넌트에 속한 교재를 조회하지 못하는 것이었습니다.

### 근본 원인
1. **관리자 페이지에서 tenantId 미전달**
   - `app/(admin)/admin/master-books/page.tsx`에서 `searchMasterBooks`를 호출할 때 `tenantId`를 전달하지 않음
   - `searchMasterBooks` 함수는 `tenantId`가 없으면 기본적으로 `tenant_id`가 null인 공개 콘텐츠만 조회
   - 관리자가 자신의 테넌트에 속한 교재를 조회하려면 `tenantId`를 전달해야 함

2. **필터 옵션 조회에서도 tenantId 미고려**
   - 필터 옵션(과목, 학년/학기, 개정교육과정) 조회 시에도 `tenantId`를 고려하지 않음
   - 결과적으로 필터 옵션에 자신의 테넌트 교재가 포함되지 않음

3. **강의 페이지도 동일한 문제**
   - `app/(admin)/admin/master-lectures/page.tsx`에서도 동일한 문제 발생

## 해결 방법

### 1. 교재 목록 페이지 수정

**파일**: `app/(admin)/admin/master-books/page.tsx`

**변경 사항**:
- `getTenantContext()`를 사용하여 `tenantId` 가져오기
- `searchMasterBooks`에 `tenantId` 전달
- 필터 옵션 조회 시 `tenantId` 고려

```typescript
const tenantContext = await getTenantContext();
const tenantId = tenantContext?.tenantId || undefined;

const filters: MasterBookFilters = {
  // ... 기존 필터
  tenantId, // 테넌트 ID 추가
  limit: 50,
};
```

### 2. 강의 목록 페이지 수정

**파일**: `app/(admin)/admin/master-lectures/page.tsx`

**변경 사항**:
- 교재 페이지와 동일하게 `tenantId` 전달
- 필터 옵션 조회 시 `tenantId` 고려

### 3. 동작 방식

#### Super Admin
- `tenantId`가 `null`이므로 모든 교재/강의 조회 가능 (공개 + 모든 테넌트)

#### Admin/Consultant
- 자신의 `tenantId`를 전달하여 다음을 조회:
  - 공개 콘텐츠 (`tenant_id`가 null)
  - 자신의 테넌트 콘텐츠 (`tenant_id`가 자신의 테넌트 ID)

#### 필터 옵션
- 필터 옵션도 동일한 로직으로 조회:
  ```typescript
  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is("tenant_id", null);
  }
  ```

## 관련 파일

### 수정된 파일
- `app/(admin)/admin/master-books/page.tsx`: 교재 목록 페이지
- `app/(admin)/admin/master-lectures/page.tsx`: 강의 목록 페이지

### 관련 함수
- `lib/data/contentMasters.ts`:
  - `searchMasterBooks()`: 이미 `tenantId` 지원 (수정 불필요)
  - `searchMasterLectures()`: 이미 `tenantId` 지원 (수정 불필요)
  - `getMasterBookById()`: RLS 정책에 따라 접근 제어 (수정 불필요)

### 유틸리티
- `lib/tenant/getTenantContext.ts`: 테넌트 컨텍스트 조회

## 테스트 체크리스트

### 교재 목록 페이지
- [ ] Super Admin이 모든 교재를 조회할 수 있는지 확인
- [ ] Admin이 공개 교재 + 자신의 테넌트 교재를 조회할 수 있는지 확인
- [ ] Consultant가 공개 교재 + 자신의 테넌트 교재를 조회할 수 있는지 확인
- [ ] 필터 옵션(과목, 학년/학기, 개정교육과정)이 올바르게 표시되는지 확인

### 강의 목록 페이지
- [ ] Super Admin이 모든 강의를 조회할 수 있는지 확인
- [ ] Admin이 공개 강의 + 자신의 테넌트 강의를 조회할 수 있는지 확인
- [ ] Consultant가 공개 강의 + 자신의 테넌트 강의를 조회할 수 있는지 확인
- [ ] 필터 옵션이 올바르게 표시되는지 확인

### 교재/강의 상세 페이지
- [ ] `getMasterBookById()`가 RLS 정책에 따라 올바르게 동작하는지 확인
- [ ] 권한이 없는 교재/강의에 접근할 때 적절한 에러가 발생하는지 확인

## 참고 사항

### RLS 정책
- `master_books`와 `master_lectures` 테이블의 RLS 정책은 데이터베이스 레벨에서 관리됩니다.
- `createSupabaseServerClient()`를 사용하면 RLS 정책이 적용됩니다.
- Super Admin이나 특정 권한이 필요한 경우 `createSupabaseAdminClient()`를 사용할 수 있습니다.

### tenantId 처리 로직
```typescript
// searchMasterBooks/searchMasterLectures 내부
if (filters.tenantId) {
  query = query.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
} else {
  query = query.is("tenant_id", null); // 기본적으로 공개 콘텐츠만
}
```

이 로직에 따라:
- `tenantId`가 있으면: 공개 콘텐츠 + 해당 테넌트 콘텐츠 조회
- `tenantId`가 없으면: 공개 콘텐츠만 조회

## 향후 개선 사항

1. **에러 처리 개선**: 권한이 없는 콘텐츠에 접근할 때 사용자에게 명확한 메시지 제공
2. **캐싱 최적화**: 테넌트별로 캐싱하여 성능 개선
3. **권한 확인 강화**: 상세 페이지에서도 테넌트 권한 확인 추가

