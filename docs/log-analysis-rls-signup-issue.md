# 로그 분석: RLS 정책 위반 문제

## 로그 분석 결과

### 발견된 문제

1. **RLS 정책 위반 에러** (주요 문제)

   ```
   [auth] 학생 레코드 생성 실패 {
     userId: '95446405-9dd3-48c7-b675-2bcc72f26625',
     tenantId: '84b71a5d-5681-4da3-88d2-91e75ef89015',
     error: 'new row violates row-level security policy for table "students"',
     code: '42501'
   }
   ```

2. **JWT 토큰 문제**

   ```
   [auth] getUser 실패 {
     message: 'User from sub claim in JWT does not exist',
     status: 403,
     code: 'user_not_found',
     name: 'AuthApiError'
   }
   ```

3. **Fallback 로직 작동**
   ```
   [auth] 테이블 레코드 없음, signup_role fallback 사용 {
     userId: '95446405-9dd3-48c7-b675-2bcc72f26625',
     signupRole: 'student',
     tenantIdFromMetadata: '84b71a5d-5681-4da3-88d2-91e75ef89015'
   }
   ```

---

## 문제 원인

### 1. 회원가입 시점의 인증 상태

**핵심 문제**: 회원가입 직후(`signUp()` 함수 내)에 레코드를 생성하려고 시도하는데, 이 시점에는 사용자 세션이 완전히 설정되지 않아 `auth.uid()`가 제대로 작동하지 않습니다.

**현재 코드 흐름**:

```typescript
// app/actions/auth.ts::signUp()
1. supabase.auth.signUp() 호출
2. 회원가입 성공 후 즉시 createStudentRecord() 호출
3. createStudentRecord()에서 supabase.from("students").insert() 시도
4. RLS 정책: auth.uid() = id 체크
5. ❌ auth.uid()가 제대로 작동하지 않아 실패
```

**왜 실패하는가?**:

- Supabase의 `signUp()`은 이메일 인증이 완료되기 전까지는 완전한 세션을 생성하지 않음
- 회원가입 직후의 JWT 토큰이 아직 완전히 유효하지 않음
- `auth.uid()`가 NULL이거나 예상과 다른 값을 반환할 수 있음

### 2. JWT 토큰 문제

**에러**: `User from sub claim in JWT does not exist`

**의미**:

- JWT 토큰의 `sub` 클레임에 있는 사용자 ID가 Supabase Auth에 존재하지 않음
- 회원가입 직후 생성된 토큰이 아직 완전히 유효하지 않음

---

## 해결 방안

### 권장 방법: 첫 로그인 시 레코드 생성

**개념**:

- 회원가입 시점에는 레코드를 생성하지 않음
- 이메일 인증 완료 후 첫 로그인 시점에 레코드 생성
- 이 시점에는 완전한 인증 상태이므로 RLS 정책이 정상 작동

**구현 위치**: `app/actions/auth.ts::signIn()`

**로직**:

1. 로그인 성공 후 사용자 정보 확인
2. `user_metadata.signup_role` 확인
3. `students` 또는 `parent_users` 테이블에 레코드 존재 여부 확인
4. 레코드가 없으면 생성 시도 (이 시점에는 완전한 인증 상태)

**코드 예시**:

```typescript
// app/actions/auth.ts::signIn() 수정
if (data?.session && data.user) {
  // 로그인 성공 후 레코드 확인 및 생성
  const signupRole = data.user.user_metadata?.signup_role;
  const tenantId = data.user.user_metadata?.tenant_id;

  if (signupRole === "student") {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!student) {
      // 레코드가 없으면 생성 시도 (완전한 인증 상태이므로 RLS 정책 작동)
      const result = await createStudentRecord(data.user.id, tenantId);
      if (!result.success) {
        console.error(
          "[auth] 첫 로그인 시 학생 레코드 생성 실패:",
          result.error
        );
      }
    }
  } else if (signupRole === "parent") {
    // 동일한 로직
  }
}
```

---

## 현재 상황

### Phase 1 Fallback 로직

**작동 상태**: ✅ 정상 작동

- `getCurrentUserRole()`에서 `signup_role`을 fallback으로 사용
- 레코드가 없어도 사이드바는 표시됨
- 사용자 경험은 유지됨

### Phase 2 마이그레이션

**상태**: ✅ 완료

- RLS 정책이 데이터베이스에 추가됨
- 하지만 회원가입 시점에는 여전히 작동하지 않음

### Phase 3 레코드 자동 생성

**상태**: ⚠️ 부분 실패

- 회원가입 시점에 레코드 생성 시도
- RLS 정책 위반으로 실패
- Fallback 로직으로 사용자 경험은 유지

---

## 다음 단계

1. **즉시 조치**: ✅ 완료 (Fallback 로직으로 사용자 경험 유지)
2. **개선 작업**: ✅ 완료 (첫 로그인 시 레코드 생성 로직 구현)
   - `ensureUserRecord()` 헬퍼 함수 구현 완료
   - `signIn()` 함수에 레코드 생성 로직 추가 완료
3. **테스트**: ⏳ 진행 중 (이메일 인증 후 첫 로그인 시 레코드 생성 확인)

## 구현 완료 사항

### ensureUserRecord() 함수 구현

**위치**: `app/actions/auth.ts`

**기능**:
- 첫 로그인 시 사용자 레코드 확인 및 생성
- 완전한 인증 상태에서 실행되므로 RLS 정책 정상 작동
- 레코드 생성 실패해도 로그인은 계속 진행

**로직**:
1. `user_metadata.signup_role` 확인
2. 역할별 테이블에서 레코드 존재 여부 확인
3. 레코드가 없으면 생성 시도
4. 에러 처리 (실패해도 예외 발생하지 않음)

### signIn() 함수 수정

**변경 사항**:
- 로그인 성공 후 `ensureUserRecord()` 호출 추가
- 완전한 인증 상태에서 실행되므로 RLS 정책 정상 작동
- 레코드 생성 실패해도 로그인은 계속 진행

---

## 참고 자료

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [RLS 정책 회원가입 시점 문제](./rls-policy-signup-timing-issue.md)
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md)

---

**작성 일자**: 2025-01-31  
**상태**: 분석 완료, 해결 방안 제시
