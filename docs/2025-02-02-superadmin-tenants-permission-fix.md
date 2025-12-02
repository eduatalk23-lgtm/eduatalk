# Super Admin 기관 관리 페이지 권한 체크 개선

## 작업 일시
2025-02-02

## 문제점
Super Admin 페이지의 "기관 관리" 메뉴를 클릭하면 대시보드로 리다이렉트되는 문제가 발생했습니다.

### 원인 분석
1. `app/(admin)/admin/superadmin/tenants/page.tsx`에서 `getTenantContext()`를 사용하고 있었음
2. 다른 admin 페이지들은 `getCurrentUserRole()`을 사용하여 일관성이 없었음
3. 권한 체크 로직이 `tenantContext?.role !== "superadmin"`로 되어 있어 null 체크가 불완전했음

## 해결 방법

### 1. 페이지 권한 체크 로직 개선
**파일**: `app/(admin)/admin/superadmin/tenants/page.tsx`

**변경 사항**:
- `getTenantContext()` → `getCurrentUserRole()`로 변경
- 권한 체크를 `!userId || role !== "superadmin"`로 명확화

```typescript
// 변경 전
const tenantContext = await getTenantContext();
if (tenantContext?.role !== "superadmin") {
  redirect("/admin/dashboard");
}

// 변경 후
const { userId, role } = await getCurrentUserRole();
if (!userId || role !== "superadmin") {
  redirect("/admin/dashboard");
}
```

### 2. API 라우트 권한 체크 일관성 확보
**파일**: 
- `app/api/tenants/route.ts` (POST)
- `app/api/tenants/[id]/route.ts` (PUT, DELETE)

**변경 사항**:
- 모든 API 라우트에서 `getTenantContext()` → `getCurrentUserRole()`로 변경
- 일관된 권한 체크 로직 적용

```typescript
// 변경 전
const tenantContext = await getTenantContext();
if (tenantContext?.role !== "superadmin") {
  return apiForbidden("Super Admin만 기관을 생성할 수 있습니다.");
}

// 변경 후
const { userId, role } = await getCurrentUserRole();
if (!userId || role !== "superadmin") {
  return apiForbidden("Super Admin만 기관을 생성할 수 있습니다.");
}
```

## 개선 효과

1. **일관성**: 모든 admin 페이지와 API 라우트에서 동일한 권한 체크 함수 사용
2. **안정성**: `getCurrentUserRole()`은 더 안정적인 권한 체크 로직을 제공
3. **명확성**: `userId`와 `role`을 명시적으로 체크하여 권한 검증이 더 명확해짐

## 관련 파일

### 수정된 파일
- `app/(admin)/admin/superadmin/tenants/page.tsx`
- `app/api/tenants/route.ts`
- `app/api/tenants/[id]/route.ts`

### 참고 파일
- `lib/auth/getCurrentUserRole.ts` - 권한 체크 함수
- `lib/tenant/getTenantContext.ts` - 기존 사용하던 함수 (다른 곳에서 여전히 사용 중)

## 테스트 체크리스트

- [ ] Super Admin 계정으로 로그인 시 "기관 관리" 메뉴 접근 가능
- [ ] 일반 Admin 계정으로 로그인 시 "기관 관리" 메뉴 클릭 시 대시보드로 리다이렉트
- [ ] Super Admin으로 기관 생성 (POST /api/tenants) 정상 작동
- [ ] Super Admin으로 기관 수정 (PUT /api/tenants/[id]) 정상 작동
- [ ] Super Admin으로 기관 삭제 (DELETE /api/tenants/[id]) 정상 작동
- [ ] 일반 Admin으로 API 호출 시 403 Forbidden 응답

## 추가 개선 사항

향후 개선 가능한 부분:
1. 에러 처리 개선: `alert()` 대신 Toast 알림 사용
2. UI/UX 개선: 디자인 시스템 컴포넌트 적용
3. 기능 추가: 기관 검색/필터링, 통계 표시 등

