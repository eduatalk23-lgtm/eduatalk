# Super Admin 리다이렉트 루프 문제 해결

## 작업 일시
2025-02-02

## 문제점
Super Admin 계정으로 로그인 후 로그인 화면과 대시보드를 계속 반복하는 리다이렉트 루프 발생

### 원인 분석
1. **로그인 페이지** (`app/login/page.tsx`): superadmin을 `/admin/dashboard`로 리다이렉트 ✅ (이미 수정됨)
2. **대시보드 페이지** (`app/(admin)/admin/dashboard/page.tsx`): superadmin이 `admin` 또는 `consultant`가 아니므로 `/login`으로 리다이렉트 ❌
3. **무한 루프 발생**:
   - 로그인 → `/admin/dashboard`로 리다이렉트
   - `/admin/dashboard` → superadmin이 admin/consultant가 아니므로 `/login`으로 리다이렉트
   - `/login` → 이미 로그인되어 있으므로 `/admin/dashboard`로 리다이렉트
   - 무한 반복!

## 해결 방법

### 1. 유틸리티 함수 생성
**파일**: `lib/auth/isAdminRole.ts` (신규)

```typescript
/**
 * 관리자 역할인지 확인하는 유틸리티 함수
 * admin, consultant, superadmin을 모두 관리자로 인식
 */
export function isAdminRole(role: string | null): boolean {
  return role === "admin" || role === "consultant" || role === "superadmin";
}

/**
 * Super Admin인지 확인하는 유틸리티 함수
 */
export function isSuperAdmin(role: string | null): boolean {
  return role === "superadmin";
}
```

### 2. 주요 페이지 수정
다음 페이지들에서 `role !== "admin" && role !== "consultant"` 체크를 `!isAdminRole(role)`로 변경:

- ✅ `app/(admin)/admin/dashboard/page.tsx`
- ✅ `app/(admin)/admin/settings/page.tsx`
- ✅ `app/(admin)/admin/consulting/page.tsx`
- ✅ `app/(admin)/admin/reports/page.tsx`
- ✅ `app/(admin)/admin/compare/page.tsx`
- ✅ `app/(admin)/admin/students/page.tsx`
- ✅ `app/(admin)/admin/students/[id]/page.tsx`
- ✅ `app/(admin)/admin/tools/page.tsx`

### 변경 예시

**변경 전**:
```typescript
if (!userId || (role !== "admin" && role !== "consultant")) {
  redirect("/login");
}
```

**변경 후**:
```typescript
import { isAdminRole } from "@/lib/auth/isAdminRole";

if (!userId || !isAdminRole(role)) {
  redirect("/login");
}
```

## 추가 수정 필요 사항

다음 파일들도 동일한 패턴이 있지만, 우선순위가 낮은 페이지들입니다. 필요 시 추가 수정:

- `app/(admin)/admin/master-books/**`
- `app/(admin)/admin/master-lectures/**`
- `app/(admin)/admin/camp-templates/**`
- `app/(admin)/admin/time-management/**`
- `app/(admin)/admin/plan-groups/**`
- `app/(admin)/actions/**`

## 개선 효과

1. **일관성**: 모든 관리자 페이지에서 동일한 권한 체크 로직 사용
2. **유지보수성**: 유틸리티 함수로 중앙 관리
3. **확장성**: 새로운 관리자 역할 추가 시 한 곳만 수정
4. **안정성**: 리다이렉트 루프 문제 해결

## 테스트 체크리스트

- [ ] Super Admin으로 로그인 시 대시보드 정상 접근
- [ ] Super Admin으로 설정 페이지 접근 가능
- [ ] Super Admin으로 상담 노트 페이지 접근 가능
- [ ] Super Admin으로 리포트 페이지 접근 가능
- [ ] Super Admin으로 비교 분석 페이지 접근 가능
- [ ] Super Admin으로 학생 관리 페이지 접근 가능
- [ ] Super Admin으로 도구 페이지 접근 가능
- [ ] 리다이렉트 루프 발생하지 않음

## 관련 파일

### 신규 파일
- `lib/auth/isAdminRole.ts`

### 수정된 파일
- `app/(admin)/admin/dashboard/page.tsx`
- `app/(admin)/admin/settings/page.tsx`
- `app/(admin)/admin/consulting/page.tsx`
- `app/(admin)/admin/reports/page.tsx`
- `app/(admin)/admin/compare/page.tsx`
- `app/(admin)/admin/students/page.tsx`
- `app/(admin)/admin/students/[id]/page.tsx`
- `app/(admin)/admin/tools/page.tsx`

