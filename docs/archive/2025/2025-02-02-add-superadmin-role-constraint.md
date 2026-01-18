# admin_users 테이블 role 컬럼에 superadmin 추가

## 작업 일시
2025-02-02

## 문제점
Super Admin 계정을 생성하려고 할 때 다음 에러가 발생했습니다:

```
ERROR: 23514: new row for relation "admin_users" violates check constraint "admin_users_role_check"
DETAIL: Failing row contains (04a30e04-2bd7-4d2f-9f09-8adc69f58f80, superadmin, 2025-12-02 06:37:24.146987+00, null).
```

### 원인 분석
`admin_users` 테이블의 `role` 컬럼에 CHECK 제약조건이 `'admin'`과 `'consultant'`만 허용하도록 설정되어 있어서 `'superadmin'` 값을 삽입할 수 없었습니다.

## 해결 방법

### 마이그레이션 파일 생성
**파일**: `supabase/migrations/20250202153937_add_superadmin_to_admin_users_role.sql`

**변경 사항**:
1. 기존 CHECK 제약조건 삭제
2. `superadmin`을 포함한 새로운 CHECK 제약조건 추가
3. 컬럼 코멘트 업데이트

```sql
-- 기존 CHECK 제약조건 삭제
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- superadmin을 포함한 새로운 CHECK 제약조건 추가
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('admin', 'consultant', 'superadmin'));

-- 컬럼 코멘트 업데이트
COMMENT ON COLUMN admin_users.role IS '관리자 역할: admin(기관 관리자), consultant(컨설턴트), superadmin(시스템 관리자)';
```

## 적용 방법

### Supabase CLI 사용
```bash
supabase migration up
```

### Supabase 대시보드 사용
1. Supabase 대시보드 → Database → Migrations
2. 마이그레이션 파일 내용을 SQL Editor에서 실행

## Super Admin 계정 생성

마이그레이션 적용 후 다음 SQL로 Super Admin 계정을 생성할 수 있습니다:

```sql
INSERT INTO admin_users (id, role, tenant_id)
VALUES (
  '{USER_ID}',  -- Supabase Auth의 사용자 UUID
  'superadmin',
  NULL  -- superadmin은 tenant_id가 NULL
)
ON CONFLICT (id) DO UPDATE 
SET role = 'superadmin', tenant_id = NULL;
```

## 관련 파일

### 수정된 파일
- `supabase/migrations/20250202153937_add_superadmin_to_admin_users_role.sql` (신규)

### 참고 파일
- `lib/auth/getCurrentUserRole.ts` - superadmin 역할 체크 로직
- `app/(admin)/admin/superadmin/tenants/page.tsx` - Super Admin 전용 페이지

## 테스트 체크리스트

- [ ] 마이그레이션 파일 적용 확인
- [ ] CHECK 제약조건이 `('admin', 'consultant', 'superadmin')`을 허용하는지 확인
- [ ] Super Admin 계정 생성 성공 확인
- [ ] Super Admin으로 로그인하여 "기관 관리" 페이지 접근 확인

