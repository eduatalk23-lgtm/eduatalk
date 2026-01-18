# RLS 정책 위반 문제 분석 (회원가입 시점)

## 문제 개요

**발생 일자**: 2025-01-31  
**문제**: 회원가입 직후 `students` 테이블에 레코드 생성 시도 시 RLS 정책 위반 에러 발생

**에러 로그**:

```
[auth] 학생 레코드 생성 실패 {
  userId: '95446405-9dd3-48c7-b675-2bcc72f26625',
  tenantId: '84b71a5d-5681-4da3-88d2-91e75ef89015',
  error: 'new row violates row-level security policy for table "students"',
  code: '42501'
}
```

**추가 에러**:

```
[auth] getUser 실패 {
  message: 'User from sub claim in JWT does not exist',
  status: 403,
  code: 'user_not_found',
  name: 'AuthApiError'
}
```

---

## 문제 원인 분석

### 1. 회원가입 시점의 인증 상태

**현재 동작**:

1. `signUp()` 함수에서 `supabase.auth.signUp()` 호출
2. 회원가입 성공 후 즉시 `createStudentRecord()` 호출
3. `createStudentRecord()`에서 `createSupabaseServerClient()` 사용
4. `supabase.from("students").insert()` 시도
5. **RLS 정책 위반 에러 발생**

**원인**:

- `signUp()` 직후에는 사용자 세션이 완전히 설정되지 않음
- Supabase Auth의 `signUp()`은 이메일 인증이 완료되기 전까지는 완전한 세션을 생성하지 않음
- `auth.uid()`가 제대로 작동하지 않아 RLS 정책 `auth.uid() = id` 조건을 만족하지 못함

### 2. JWT 토큰 문제

**에러**: `User from sub claim in JWT does not exist`

**원인**:

- 회원가입 직후 생성된 JWT 토큰이 아직 완전히 유효하지 않음
- 사용자가 이메일 인증을 완료하기 전까지는 완전한 인증 상태가 아님

---

## 해결 방안

### 방안 1: 이메일 인증 후 레코드 생성 (권장)

**개념**:

- 회원가입 시점에는 레코드를 생성하지 않음
- 이메일 인증 완료 후 첫 로그인 시점에 레코드 생성
- 또는 `/settings` 페이지에서 정보 입력 시 레코드 생성

**장점**:

- RLS 정책이 정상 작동 (완전한 인증 상태)
- 사용자 경험 개선 (이메일 인증 후 자동 생성)
- 보안 강화 (인증된 사용자만 레코드 생성)

**단점**:

- Phase 1 fallback 로직이 여전히 필요할 수 있음

**구현 위치**:

- `app/actions/auth.ts::signIn()` 함수에서 레코드 존재 여부 확인 후 생성
- 또는 `app/(student)/settings/page.tsx`에서 정보 저장 시 생성

### 방안 2: Admin Client 사용 (비권장)

**개념**:

- `createStudentRecord()`에서 Admin Client 사용
- RLS 정책을 우회하여 레코드 생성

**단점**:

- 보안 위험 (Service Role Key 사용)
- RLS 정책의 의도와 맞지 않음
- 다른 보안 정책과의 일관성 저하

### 방안 3: RLS 정책 수정 (비권장)

**개념**:

- RLS 정책을 수정하여 회원가입 직후에도 레코드 생성 가능하도록 변경

**단점**:

- 보안 정책이 약해짐
- 인증되지 않은 사용자도 레코드 생성 가능할 수 있음

---

## 권장 해결 방법

### 구현: 첫 로그인 시 레코드 생성

**수정 위치**: `app/actions/auth.ts::signIn()`

**로직**:

1. 로그인 성공 후 사용자 역할 확인
2. `students` 또는 `parent_users` 테이블에 레코드 존재 여부 확인
3. 레코드가 없으면 생성 시도
4. 이 시점에는 완전한 인증 상태이므로 RLS 정책이 정상 작동

**코드 예시**:

```typescript
export async function signIn(formData: FormData) {
  // ... 기존 로그인 로직 ...

  if (data?.session && data.user) {
    // 로그인 성공 후 레코드 확인 및 생성
    const userRole = data.user.user_metadata?.signup_role;

    if (userRole === "student") {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!student) {
        // 레코드가 없으면 생성 시도
        await createStudentRecord(
          data.user.id,
          data.user.user_metadata?.tenant_id
        );
      }
    } else if (userRole === "parent") {
      // 동일한 로직
    }
  }
}
```

---

## 현재 상황

**Phase 1 fallback 로직**:

- 현재 `getCurrentUserRole()`에서 `signup_role`을 fallback으로 사용
- 레코드가 없어도 사이드바는 표시됨
- 하지만 레코드 자동 생성은 실패

**임시 해결책**:

- Phase 1 fallback 로직으로 사용자 경험은 유지
- `/settings`에서 정보 입력 시 레코드 생성 (기존 로직)

**장기 해결책**:

- 첫 로그인 시점에 레코드 자동 생성 구현
- RLS 정책이 정상 작동하는 시점에 생성

---

## 참고 자료

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md)
- [RLS 정책 분석 문서](./rls-policy-analysis.md)

---

**작성 일자**: 2025-01-31  
**상태**: 분석 완료, 해결 방안 제시
