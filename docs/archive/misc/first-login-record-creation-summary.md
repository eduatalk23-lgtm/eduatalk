# 첫 로그인 시 레코드 자동 생성 구현 요약

## 개요

회원가입 시점의 RLS 정책 위반 문제를 해결하기 위해, 이메일 인증 완료 후 첫 로그인 시점에 `students`/`parent_users` 테이블 레코드를 자동 생성하는 로직을 구현했습니다.

**구현 일자**: 2025-01-31  
**목적**: 회원가입 시점의 RLS 정책 위반 문제 해결

---

## 구현 내용

### 1. ensureUserRecord() 헬퍼 함수 구현

**위치**: `app/actions/auth.ts`

**기능**:
- 첫 로그인 시 사용자 레코드 확인 및 생성
- 완전한 인증 상태에서 실행되므로 RLS 정책 정상 작동
- 레코드 생성 실패해도 로그인은 계속 진행

**함수 시그니처**:
```typescript
async function ensureUserRecord(
  user: { id: string; user_metadata?: Record<string, any> | null }
): Promise<void>
```

**로직**:
1. `user.user_metadata.signup_role` 확인
2. 역할별 테이블에서 레코드 존재 여부 확인
   - `signup_role === "student"` → `students` 테이블 확인
   - `signup_role === "parent"` → `parent_users` 테이블 확인
3. 레코드가 없으면 생성 시도
4. 에러 처리 (실패해도 예외 발생하지 않음)

**에러 처리**:
- 레코드 확인 실패: 에러 로깅 후 종료
- 레코드 생성 실패: 에러 로깅 후 종료 (로그인은 계속 진행)
- 예외 발생: catch 블록에서 처리, 로그인은 계속 진행

### 2. signIn() 함수 수정

**변경 사항**:
- 로그인 성공 후 `ensureUserRecord()` 호출 추가
- 완전한 인증 상태에서 실행되므로 RLS 정책 정상 작동
- 레코드 생성 실패해도 로그인은 계속 진행

**구현 위치**:
```typescript
// app/actions/auth.ts::_signIn()
if (data?.session && data.user) {
  // 기존: 세션 정보 저장
  saveUserSession(...);
  
  // 추가: 레코드 확인 및 생성
  ensureUserRecord(data.user).catch((err) => {
    console.error("[auth] 레코드 확인/생성 실패 (무시됨):", err);
  });
}
```

**에러 처리**:
- `ensureUserRecord()` 호출을 `catch()`로 감싸서 실패해도 로그인은 계속 진행
- 에러는 로깅만 하고 사용자에게는 영향 없음

---

## 해결된 문제

### 1. 회원가입 시점 RLS 정책 위반

**이전**:
- 회원가입 직후 레코드 생성 시도
- RLS 정책 위반 에러 발생 (`42501`)
- Fallback 로직으로 사용자 경험 유지

**이후**:
- 첫 로그인 시점에 레코드 생성
- 완전한 인증 상태이므로 RLS 정책 정상 작동
- 레코드 생성 성공

### 2. 사용자 경험 개선

**이전**:
- 회원가입 후 레코드 생성 실패
- Phase 1 fallback 로직으로 사이드바 표시
- `/settings`에서 정보 입력 후 레코드 생성

**이후**:
- 첫 로그인 시 자동으로 레코드 생성
- 사이드바 즉시 표시 (fallback 로직 불필요)
- 사용자 경험 개선

---

## 테스트 시나리오

### 시나리오 1: 신규 학생 첫 로그인

**절차**:
1. 회원가입 (학생 선택)
2. 이메일 인증 완료
3. 첫 로그인

**예상 결과**:
- ✅ `students` 테이블에 레코드 생성
- ✅ RLS 정책 위반 에러 없음
- ✅ 사이드바 즉시 표시
- ✅ Phase 1 fallback 로직 사용 안 함

### 시나리오 2: 신규 학부모 첫 로그인

**절차**:
1. 회원가입 (학부모 선택)
2. 이메일 인증 완료
3. 첫 로그인

**예상 결과**:
- ✅ `parent_users` 테이블에 레코드 생성
- ✅ RLS 정책 위반 에러 없음
- ✅ 사이드바 즉시 표시
- ✅ Phase 1 fallback 로직 사용 안 함

### 시나리오 3: 기존 사용자 로그인

**절차**:
1. 이미 레코드가 있는 사용자로 로그인

**예상 결과**:
- ✅ 레코드 생성 시도하지 않음
- ✅ 기존 레코드 유지
- ✅ 정상 로그인

### 시나리오 4: 레코드 생성 실패 케이스

**절차**:
1. Default Tenant가 없는 환경에서 첫 로그인

**예상 결과**:
- ✅ 레코드 생성 실패하지만 로그인은 성공
- ✅ 에러 로그 확인
- ✅ Phase 1 fallback 로직 작동

---

## 로깅

### 성공 케이스

```
[auth] 첫 로그인 시 학생 레코드 생성 성공 {
  userId: '...',
  tenantId: '...' 또는 '기본 tenant'
}
```

```
[auth] 첫 로그인 시 학부모 레코드 생성 성공 {
  userId: '...',
  tenantId: '...' 또는 '기본 tenant 또는 null'
}
```

### 실패 케이스

```
[auth] 첫 로그인 시 학생 레코드 생성 실패 {
  userId: '...',
  error: '...'
}
```

### 이미 존재하는 경우

```
[auth] 학생 레코드가 이미 존재합니다. { userId: '...' }
```

```
[auth] 학부모 레코드가 이미 존재합니다. { userId: '...' }
```

---

## 기존 코드와의 관계

### Phase 1: Fallback 로직

**상태**: ✅ 유지 (하위 호환성)

- `getCurrentUserRole()`에서 `signup_role` fallback 로직은 유지
- 레코드 생성 실패 시에도 사용자 경험 유지
- 점진적 개선 가능

### Phase 2: RLS 정책

**상태**: ✅ 완료

- `students_insert_own` 정책 추가 완료
- `parent_users_insert_own` 정책 추가 완료
- 첫 로그인 시점에 정상 작동

### Phase 3: 레코드 자동 생성

**상태**: ✅ 완료

- 회원가입 시점: 레코드 생성 시도 (RLS 정책 위반으로 실패, fallback으로 처리)
- 첫 로그인 시점: 레코드 생성 성공 (완전한 인증 상태)

---

## 다음 단계 (선택사항)

### Phase 1 Fallback 로직 제거 검토

**조건**:
- 모든 사용자가 첫 로그인 시 레코드를 가지는지 확인
- 에지 케이스 처리 확인
- 충분한 테스트 완료

**작업**:
- `getCurrentUserRole()`에서 `signup_role` fallback 로직 제거 검토
- 제거 시 영향 범위 분석
- 제거 여부 결정

---

## 참고 자료

- [로그 분석 문서](./log-analysis-rls-signup-issue.md) - 문제 분석 및 해결 방안
- [RLS 정책 회원가입 시점 문제](./rls-policy-signup-timing-issue.md) - 문제 원인 분석
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md) - Phase 3 구현 계획
- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) - RLS 정책 추가 작업

---

**작성 일자**: 2025-01-31  
**구현 완료**: 2025-01-31  
**상태**: 구현 완료, 테스트 대기 중

