# 관리자 계정 확인 방법

## 방법 1: Supabase SQL Editor에서 확인

Supabase Dashboard → SQL Editor에서 다음 쿼리를 실행하세요:

```sql
-- 모든 관리자 계정 조회
SELECT 
  au.id,
  au.role,
  au.created_at,
  u.email
FROM admin_users au
LEFT JOIN auth.users u ON au.id = u.id
ORDER BY au.created_at DESC;
```

또는 더 간단하게:

```sql
-- admin_users 테이블만 조회
SELECT * FROM admin_users ORDER BY created_at DESC;
```

## 방법 2: 이메일로 특정 사용자가 관리자인지 확인

```sql
-- 특정 이메일의 사용자가 관리자인지 확인
SELECT 
  au.id,
  au.role,
  au.created_at,
  u.email
FROM admin_users au
JOIN auth.users u ON au.id = u.id
WHERE u.email = 'your-email@example.com';
```

## 방법 3: 현재 로그인한 사용자가 관리자인지 확인

웹 애플리케이션에서 확인:

1. 로그인 후 `/admin/dashboard` 접근 시도
2. 관리자라면 접근 가능, 아니면 리다이렉트됨

또는 브라우저 콘솔에서:

```javascript
// 개발자 도구 콘솔에서 (실제로는 서버 사이드에서만 가능)
fetch('/api/check-admin')
```

## 방법 4: 관리자 계정 개수 확인

```sql
-- 관리자 계정 개수 확인
SELECT COUNT(*) as admin_count FROM admin_users;

-- 역할별 개수 확인
SELECT role, COUNT(*) as count 
FROM admin_users 
GROUP BY role;
```

## 방법 5: 관리자 계정이 없는 경우 확인

```sql
-- 관리자 계정이 있는지 확인
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '관리자 계정이 있습니다'
    ELSE '관리자 계정이 없습니다'
  END as status,
  COUNT(*) as admin_count
FROM admin_users;
```

## 첫 관리자 계정 생성 방법

관리자 계정이 없는 경우, 다음 중 하나의 방법으로 생성:

### 방법 A: SQL 함수 사용 (권장)

```sql
-- 1. 먼저 일반 사용자 계정이 있어야 함 (회원가입 또는 Supabase Dashboard에서 생성)
-- 2. 이메일로 관리자 계정 생성
SELECT create_admin_user('your-email@example.com', 'admin');
```

### 방법 B: 직접 INSERT

```sql
-- 1. 사용자 ID 확인
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- 2. 확인된 ID로 admin_users에 추가
INSERT INTO admin_users (id, role) 
VALUES ('user-uuid-here', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

## 주의사항

- `admin_users` 테이블은 `auth.users` 테이블의 `id`를 참조합니다
- 관리자 계정을 생성하려면 먼저 `auth.users`에 해당 사용자가 존재해야 합니다
- `role`은 `'admin'` 또는 `'consultant'`만 가능합니다

