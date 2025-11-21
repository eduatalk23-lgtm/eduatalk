# 관리자 계정 등록 방법 가이드

## 📋 개요

관리자 계정을 등록하는 방법은 두 가지가 있습니다:
1. **SQL로 직접 생성** (첫 관리자 계정 생성 시 필수)
2. **웹 UI로 생성** (이미 관리자 계정이 있는 경우)

---

## 방법 1: SQL로 관리자 계정 생성 (첫 관리자 계정)

처음에는 관리자 계정이 없으므로 SQL로 첫 관리자 계정을 생성해야 합니다.

### Step 1: 일반 사용자 계정 생성

먼저 관리자로 만들 사용자 계정이 있어야 합니다.

**옵션 A: 웹에서 회원가입**
1. `http://localhost:3000/signup` 접속
2. 이메일과 비밀번호로 회원가입

**옵션 B: Supabase Dashboard에서 생성**
1. Supabase Dashboard → Authentication → Users
2. "Add user" 클릭하여 사용자 생성

### Step 2: SQL로 관리자 권한 부여

Supabase Dashboard → SQL Editor에서 다음 중 하나를 실행:

#### 방법 A: 함수 사용 (권장)

```sql
-- 이메일로 관리자 계정 생성
SELECT create_admin_user('your-email@example.com', 'admin');
```

**예시:**
```sql
SELECT create_admin_user('admin@example.com', 'admin');
```

#### 방법 B: 직접 INSERT

```sql
-- 1단계: 사용자 ID 확인
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- 2단계: 확인된 ID로 admin_users에 추가
-- (위에서 확인한 id 값을 사용)
INSERT INTO admin_users (id, role) 
VALUES ('user-uuid-here', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

**예시:**
```sql
-- 사용자 ID 확인
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
-- 결과: id = '123e4567-e89b-12d3-a456-426614174000'

-- 관리자로 추가
INSERT INTO admin_users (id, role) 
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### Step 3: 확인

```sql
-- 관리자 계정이 생성되었는지 확인
SELECT 
  au.id,
  au.role,
  au.created_at,
  u.email
FROM admin_users au
JOIN auth.users u ON au.id = u.id
WHERE u.email = 'your-email@example.com';
```

---

## 방법 2: 웹 UI로 관리자 계정 생성

이미 관리자 계정이 있는 경우, 웹 UI를 통해 추가 관리자 계정을 생성할 수 있습니다.

### Step 1: 관리자 계정으로 로그인

1. 관리자 계정으로 로그인
2. `/admin/dashboard` 접속 확인

### Step 2: 관리자 계정 관리 페이지 접근

**방법 A: 직접 URL 접근**
```
http://localhost:3000/admin/admin-users
```

**방법 B: 네비게이션 메뉴**
1. 왼쪽 사이드바에서 "설정" 카테고리 클릭
2. "관리자 계정" 메뉴 클릭

### Step 3: 관리자 계정 생성

1. **사용자 이메일 입력**
   - 관리자로 승격할 사용자의 이메일 입력
   - 해당 이메일로 가입한 사용자가 있어야 함

2. **역할 선택**
   - **관리자 (Admin)**: 모든 권한
   - **컨설턴트 (Consultant)**: 상담 및 조회 권한

3. **"관리자 계정 생성" 버튼 클릭**

### Step 4: 확인

생성 후 관리자 목록에 표시됩니다.

---

## 역할 설명

### Admin (관리자)
- 모든 관리 기능 접근 가능
- 서비스 마스터 콘텐츠 관리
- 학생 관리
- 관리자 계정 생성/삭제
- 기관 설정 관리

### Consultant (컨설턴트)
- 학생 조회 및 상담 노트 작성
- 리포트 조회
- 비교 분석 조회
- 관리자 계정 생성/삭제 불가

---

## 문제 해결

### 문제 1: "사용자를 찾을 수 없습니다"
**원인**: 입력한 이메일로 가입한 사용자가 없음
**해결**: 먼저 해당 이메일로 회원가입을 진행하세요

### 문제 2: "이미 관리자로 등록된 사용자입니다"
**원인**: 해당 사용자가 이미 관리자임
**해결**: 다른 사용자를 선택하거나, 기존 관리자 목록에서 확인

### 문제 3: "관리자 권한이 필요합니다"
**원인**: 관리자가 아닌 계정으로 접근 시도
**해결**: 관리자 계정으로 로그인하거나, SQL로 먼저 관리자 계정 생성

### 문제 4: 웹 UI에서 사용자 목록이 보이지 않음
**원인**: `supabase.auth.admin.listUsers()` 권한 문제
**해결**: 
- Supabase 서비스 키가 설정되어 있는지 확인
- 환경 변수에 `SUPABASE_SERVICE_ROLE_KEY` 추가 필요

---

## 빠른 시작 체크리스트

- [ ] 일반 사용자 계정 생성 (회원가입)
- [ ] Supabase SQL Editor 열기
- [ ] `SELECT create_admin_user('your-email@example.com', 'admin');` 실행
- [ ] 관리자 계정으로 로그인 확인
- [ ] `/admin/admin-users` 접근 확인
- [ ] 웹 UI로 추가 관리자 계정 생성 가능

---

## 참고

- 첫 관리자 계정은 반드시 SQL로 생성해야 합니다
- 이후에는 웹 UI로 추가 관리자 계정을 생성할 수 있습니다
- 자신의 관리자 권한은 제거할 수 없습니다 (안전장치)

