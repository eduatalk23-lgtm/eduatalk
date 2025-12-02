# Super Admin 권한 인식 문제 디버깅

## 작업 일시
2025-02-02

## 문제점
Super Admin 계정을 생성했지만 "기관 관리" 메뉴 클릭 시 대시보드로 리다이렉트되는 문제

## 디버깅 로그 추가

### 1. `app/(admin)/admin/superadmin/tenants/page.tsx`
- userId, role 값 로깅
- 권한 체크 실패 시 로깅

### 2. `lib/auth/getCurrentUserRole.ts`
- admin_users 테이블에서 조회된 role 값 로깅
- superadmin 인식 여부 로깅

## 확인 사항

### 1. admin_users 테이블 확인
```sql
SELECT 
  au.id,
  au.role,
  au.tenant_id,
  u.email
FROM admin_users au
LEFT JOIN auth.users u ON u.id = au.id
WHERE au.id = '{USER_ID}';
```

### 2. role이 'superadmin'이 아닌 경우
```sql
UPDATE admin_users
SET role = 'superadmin', tenant_id = NULL
WHERE id = '{USER_ID}';
```

### 3. 서버 로그 확인
- 터미널에서 서버 로그 확인
- `[getCurrentUserRole]` 및 `[superadmin/tenants]` 로그 확인

## 예상 원인

1. **admin_users 테이블에 role이 'superadmin'으로 저장되지 않음**
   - 해결: UPDATE 쿼리 실행

2. **캐시 문제**
   - 해결: 서버 재시작 또는 세션 재로그인

3. **getCurrentUserRole()이 superadmin을 인식하지 못함**
   - 해결: 로그 확인 후 코드 수정

## 다음 단계

1. 서버 로그 확인
2. admin_users 테이블 확인
3. 필요 시 role 업데이트
4. 재로그인 후 테스트

