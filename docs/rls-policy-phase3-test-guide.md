# Phase 3: RLS 정책 통합 테스트 가이드

## 📋 개요

이 문서는 Phase 2에서 추가한 RLS INSERT 정책(`students_insert_own`, `parent_users_insert_own`)의 통합 테스트를 수행하기 위한 상세 가이드입니다.

**작성 일자**: 2025-12-13  
**관련 문서**: 
- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [RLS 정책 분석](./rls-policy-analysis.md)

---

## 🔧 테스트 환경 준비

### 1.1 Supabase 연결 확인

#### 마이그레이션 상태 확인

```bash
# Supabase CLI 사용 시
supabase migration list

# 또는 Supabase Dashboard에서 확인
# Settings → Database → Migrations
```

**확인 사항**:
- `20251213000000_add_students_parents_insert_policy.sql` 마이그레이션이 적용되었는지 확인
- 정책이 정상적으로 생성되었는지 확인

#### RLS 정책 확인 (SQL)

Supabase Dashboard SQL Editor 또는 MCP 도구를 사용하여 다음 쿼리 실행:

```sql
-- students 테이블의 INSERT 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'students' AND cmd = 'INSERT';

-- parent_users 테이블의 INSERT 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'parent_users' AND cmd = 'INSERT';
```

**예상 결과**:
- `students_insert_own`: `WITH CHECK (auth.uid() = id)`
- `parent_users_insert_own`: `WITH CHECK (auth.uid() = id)`

### 1.2 테스트 계정 준비

#### 테스트용 이메일 계정 준비

- **학생 테스트**: `test.student+{timestamp}@example.com`
- **학부모 테스트**: `test.parent+{timestamp}@example.com`

**참고**: Supabase는 이메일 인증을 사용하므로 실제 이메일 주소를 사용하거나, 개발 환경에서 이메일 인증을 비활성화해야 할 수 있습니다.

#### 테스트용 Tenant 확인

```sql
-- 기본 tenant 확인
SELECT id, name, type, status 
FROM tenants 
WHERE status = 'active' 
ORDER BY created_at ASC 
LIMIT 1;
```

**확인 사항**:
- 최소 1개의 활성 tenant가 존재해야 함
- 학생 회원가입 시 사용할 tenant ID 기록

### 1.3 개발 환경 설정

#### 브라우저 개발자 도구 준비

1. **콘솔 탭**: `[auth]` 로그 필터링 설정
2. **네트워크 탭**: Supabase API 요청 모니터링
3. **Application 탭**: 쿠키 및 로컬 스토리지 확인

---

## ✅ 정상 케이스 테스트

### 2.1 학생 회원가입 플로우 테스트

#### 테스트 시나리오

1. **회원가입 페이지 접근**
   - URL: `http://localhost:3000/signup`
   - 브라우저 콘솔 열기 (F12)

2. **회원가입 정보 입력**
   - 표시 이름: `테스트 학생`
   - 이메일: `test.student+{timestamp}@example.com`
   - 비밀번호: `test123456`
   - 기관 선택: 테스트용 tenant 선택
   - 회원 유형: **학생** 선택

3. **회원가입 제출**
   - "회원가입" 버튼 클릭
   - 브라우저 콘솔에서 다음 로그 확인:

   ```
   [auth] 학생 레코드 생성 성공 { userId: '...', tenantId: '...' }
   ```

4. **데이터베이스 확인**
   - Supabase Dashboard에서 `students` 테이블 조회:

   ```sql
   SELECT id, tenant_id, name, created_at 
   FROM students 
   WHERE name = '테스트 학생' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

   **검증 항목**:
   - ✅ 레코드가 생성되었는지 확인
   - ✅ `id`가 `auth.uid()`와 일치하는지 확인
   - ✅ `tenant_id`가 올바르게 설정되었는지 확인

5. **콘솔 로그 확인**
   - RLS 정책 위반 에러(`42501`) 없음 확인
   - 다음 에러가 **없어야 함**:

   ```
   ❌ 'new row violates row-level security policy for table "students"'
   ❌ error code: '42501'
   ```

6. **이메일 인증 완료**
   - Supabase Dashboard → Authentication → Users에서 이메일 인증 수동 완료
   - 또는 실제 이메일에서 인증 링크 클릭

7. **로그인 테스트**
   - URL: `http://localhost:3000/login`
   - 위에서 생성한 계정으로 로그인
   - 콘솔에서 다음 로그 확인:

   ```
   [auth] 첫 로그인 시 학생 레코드 생성 성공
   ```

   **참고**: 이미 레코드가 존재하므로 다음 로그가 나타날 수 있음:

   ```
   [auth] 학생 레코드가 이미 존재합니다.
   ```

8. **대시보드 접근 및 사이드바 확인**
   - 자동 리다이렉트로 `/dashboard` 접근
   - 사이드바가 **즉시 표시**되는지 확인
   - 콘솔에서 다음 로그 확인 (fallback 사용 안 함):

   ```
   [getCurrentUserRole] students 조회 결과: { id: '...', tenant_id: '...' }
   ```

   **fallback 사용 시 나타나는 로그** (이 경우 문제):

   ```
   ⚠️ [auth] 테이블 레코드 없음, signup_role fallback 사용
   ```

#### 검증 체크리스트

- [ ] `students` 테이블에 레코드 생성 확인
- [ ] RLS 정책 위반 에러(`42501`) 없음
- [ ] 회원가입 성공 메시지 표시
- [ ] 이메일 인증 완료 후 로그인 성공
- [ ] `/dashboard` 접근 시 사이드바 즉시 표시
- [ ] `getCurrentUserRole()`이 `student` 반환 (fallback 미사용)
- [ ] 콘솔에서 Phase 1 fallback 로직 사용 안 함 확인

### 2.2 학부모 회원가입 플로우 테스트

#### 테스트 시나리오

1. **회원가입 페이지 접근**
   - URL: `http://localhost:3000/signup`
   - 브라우저 콘솔 열기

2. **회원가입 정보 입력**
   - 표시 이름: `테스트 학부모`
   - 이메일: `test.parent+{timestamp}@example.com`
   - 비밀번호: `test123456`
   - 기관 선택: 테스트용 tenant 선택
   - 회원 유형: **학부모** 선택

3. **회원가입 제출**
   - "회원가입" 버튼 클릭
   - 브라우저 콘솔에서 다음 로그 확인:

   ```
   [auth] 학부모 레코드 생성 성공 { userId: '...', tenantId: '...' }
   ```

4. **데이터베이스 확인**
   - Supabase Dashboard에서 `parent_users` 테이블 조회:

   ```sql
   SELECT id, tenant_id, created_at 
   FROM parent_users 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

   **검증 항목**:
   - ✅ 레코드가 생성되었는지 확인
   - ✅ `id`가 `auth.uid()`와 일치하는지 확인

5. **콘솔 로그 확인**
   - RLS 정책 위반 에러(`42501`) 없음 확인

6. **이메일 인증 완료 및 로그인**
   - 이메일 인증 완료
   - 로그인 수행

7. **대시보드 접근 및 사이드바 확인**
   - `/parent/dashboard` 접근
   - 사이드바가 **즉시 표시**되는지 확인
   - 콘솔에서 fallback 사용 안 함 확인

#### 검증 체크리스트

- [ ] `parent_users` 테이블에 레코드 생성 확인
- [ ] RLS 정책 위반 에러 없음
- [ ] 회원가입 성공 메시지 표시
- [ ] 이메일 인증 완료 후 로그인 성공
- [ ] `/parent/dashboard` 접근 시 사이드바 즉시 표시
- [ ] `getCurrentUserRole()`이 `parent` 반환 (fallback 미사용)

---

## ❌ 에러 케이스 테스트

### 3.1 중복 레코드 생성 테스트

#### 시나리오

이미 존재하는 사용자 ID로 레코드를 다시 생성 시도

#### 테스트 방법

1. 위에서 생성한 학생 계정의 `id` 확인
2. 브라우저 콘솔에서 다음 코드 실행:

```javascript
// 이미 로그인한 상태에서
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: { user } } = await supabase.auth.getUser();
console.log('Current user ID:', user.id);

// 이미 존재하는 ID로 레코드 생성 시도
const { error } = await supabase.from('students').insert({
  id: user.id,  // 이미 존재하는 ID
  tenant_id: 'YOUR_TENANT_ID',
  name: '중복 테스트'
});

if (error) {
  console.log('에러 발생:', error);
  // 예상: UNIQUE constraint violation (23505)
} else {
  console.log('레코드 생성 성공 (이상함 - 이미 존재해야 함)');
}
```

#### 검증 항목

- [ ] UNIQUE constraint 에러(`23505`) 발생
- [ ] 에러 메시지가 적절하게 표시되는지 확인
- [ ] 기존 레코드가 손상되지 않았는지 확인

#### 참고

`app/actions/auth.ts`의 `createStudentRecord` 함수는 이미 UNIQUE constraint 에러를 처리합니다:

```typescript
if (error.code === "23505") {
  console.log("[auth] 학생 레코드가 이미 존재합니다.", { userId });
  return { success: true };
}
```

### 3.2 기본 Tenant 부재 테스트

#### 시나리오

Default Tenant가 없는 경우 회원가입 시도

#### 테스트 방법

**주의**: 이 테스트는 데이터베이스 상태를 변경하므로, 테스트 후 복구해야 합니다.

1. **Default Tenant 확인**

```sql
-- 기본 tenant 확인
SELECT id, name, type, status 
FROM tenants 
WHERE status = 'active' 
ORDER BY created_at ASC 
LIMIT 1;
```

2. **임시로 Default Tenant 비활성화** (또는 삭제 - 주의!)

```sql
-- 비활성화 (안전)
UPDATE tenants 
SET status = 'inactive' 
WHERE id = 'DEFAULT_TENANT_ID';

-- 또는 삭제 (위험 - 테스트 후 복구 필요)
-- DELETE FROM tenants WHERE id = 'DEFAULT_TENANT_ID';
```

3. **회원가입 시도**
   - `/signup`에서 tenant를 선택하지 않고 회원가입 시도
   - 또는 tenant 선택 드롭다운이 비어있는 경우 테스트

4. **에러 확인**
   - 콘솔에서 다음 에러 확인:

   ```
   [auth] Default Tenant가 존재하지 않습니다. 학생 레코드 생성 실패
   ```

5. **복구**

```sql
-- tenant 상태 복구
UPDATE tenants 
SET status = 'active' 
WHERE id = 'DEFAULT_TENANT_ID';
```

#### 검증 항목

- [ ] 기본 tenant 부재 시 적절한 에러 처리
- [ ] 사용자에게 적절한 에러 메시지 표시

### 3.3 보안 검증 (다른 사용자 레코드 생성 시도)

#### 시나리오

다른 사용자의 ID로 레코드를 생성 시도 (RLS 정책 위반)

#### 테스트 방법

1. **두 개의 계정 준비**
   - 계정 A: 학생 계정 (이미 존재)
   - 계정 B: 테스트 계정 (로그인할 계정)

2. **계정 A의 ID 확인**

```sql
SELECT id, email FROM auth.users WHERE email = 'student@example.com';
```

3. **계정 B로 로그인 후 계정 A의 ID로 레코드 생성 시도**

브라우저 콘솔에서:

```javascript
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: { user } } = await supabase.auth.getUser();
console.log('Current user ID (계정 B):', user.id);

// 다른 사용자 ID (계정 A)로 레코드 생성 시도
const otherUserId = 'ACCOUNT_A_USER_ID';
const { error } = await supabase.from('students').insert({
  id: otherUserId,  // 다른 사용자 ID
  tenant_id: 'YOUR_TENANT_ID',
  name: '보안 테스트'
});

if (error) {
  console.log('RLS 정책 위반 에러:', error);
  // 예상: error.code === '42501'
  // 예상: error.message.includes('row-level security policy')
} else {
  console.error('⚠️ 보안 문제: 다른 사용자 레코드 생성 성공 (이상함!)');
}
```

#### 검증 항목

- [ ] RLS 정책에 의해 차단되는지 확인
- [ ] 에러 코드 `42501` (RLS 정책 위반) 확인
- [ ] 에러 메시지에 "row-level security policy" 포함 확인
- [ ] 레코드가 생성되지 않았는지 확인 (데이터베이스 조회)

#### 예상 결과

```javascript
{
  code: '42501',
  message: 'new row violates row-level security policy for table "students"',
  details: null,
  hint: null
}
```

---

## ⚡ 성능 및 보안 검증

### 4.1 성능 확인

#### INSERT 쿼리 실행 시간 측정

Supabase Dashboard SQL Editor에서:

```sql
-- EXPLAIN ANALYZE로 쿼리 실행 계획 확인
EXPLAIN ANALYZE
INSERT INTO students (id, tenant_id, name)
VALUES (gen_random_uuid(), 'YOUR_TENANT_ID', '성능 테스트');
```

**확인 사항**:
- 쿼리 실행 시간 (Execution Time)
- 인덱스 사용 여부
- RLS 정책 조건식 평가 시간

#### RLS 정책 조건식 검증

```sql
-- auth.uid() 함수가 올바르게 작동하는지 확인
SELECT 
  auth.uid() as current_user_id,
  (auth.uid() = 'YOUR_USER_ID') as policy_check;
```

### 4.2 보안 검증 요약

이전 섹션(3.3)에서 수행한 보안 검증 결과를 확인합니다.

---

## 📊 로그 및 모니터링 검증

### 5.1 콘솔 로그 확인 가이드

#### 성공 케이스 로그 패턴

**회원가입 시**:
```
[auth] 학생 레코드 생성 성공 { userId: '...', tenantId: '...' }
```

**첫 로그인 시**:
```
[auth] 첫 로그인 시 학생 레코드 생성 성공 { userId: '...', tenantId: '...' }
```

**역할 조회 시 (fallback 미사용)**:
```
[getCurrentUserRole] students 조회 결과: { id: '...', tenant_id: '...' }
```

#### 실패 케이스 로그 패턴 (이런 로그가 있으면 문제)

**RLS 정책 위반**:
```
❌ [auth] 학생 레코드 생성 실패 {
  error: 'new row violates row-level security policy for table "students"',
  code: '42501'
}
```

**Fallback 사용 (레코드가 없는 경우)**:
```
⚠️ [auth] 테이블 레코드 없음, signup_role fallback 사용
```

### 5.2 에러 로그 확인

**확인해야 할 항목**:
- [ ] RLS 정책 위반 에러(`42501`) 없음
- [ ] 예상치 못한 데이터베이스 에러 없음
- [ ] 네트워크 에러 없음

---

## 📝 테스트 결과 기록

테스트 완료 후 [테스트 결과 문서](./rls-policy-phase3-test-results.md)에 결과를 기록하세요.

---

## 🔗 관련 문서

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [RLS 정책 분석](./rls-policy-analysis.md)
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md)

---

**작성 일자**: 2025-12-13  
**최종 수정**: 2025-12-13

