# 학부모 회원가입 성공 후 다음 단계

**작성 일자**: 2025-01-31  
**현재 상태**: 학부모 회원가입 및 첫 로그인 시 레코드 생성 성공 확인 ✅

---

## ✅ 완료된 작업

### Phase 1: 단기 해결 (완료)
- [x] `getCurrentUserRole()` fallback 로직 구현
- [x] 사이드바 즉시 표시 문제 해결

### Phase 2: RLS 정책 추가 (완료)
- [x] `students_insert_own` 정책 추가
- [x] `parent_users_insert_own` 정책 추가
- [x] 마이그레이션 적용 완료

### Phase 3: 레코드 자동 생성 (부분 완료)
- [x] `createParentRecord()` 함수 구현
- [x] `createStudentRecord()` 함수 구현
- [x] `ensureUserRecord()` 함수 구현
- [x] `signUp()` 함수 수정
- [x] `signIn()` 함수 수정
- [x] **학부모 회원가입 성공 확인** ✅

---

## 📋 다음 단계: Phase 3 통합 테스트 및 검증

### 1. 학생 회원가입 테스트 (우선순위: 높음)

#### 테스트 시나리오

1. **신규 학생 회원가입**
   - 회원가입 폼 작성 (학생 선택)
   - 회원가입 제출
   - **검증**: `students` 테이블에 레코드 생성 확인
   - **검증**: RLS 정책 위반 에러 없음 확인
   - 이메일 인증 완료
   - 로그인
   - `/dashboard` 접근
   - **검증**: 사이드바 즉시 표시 확인
   - **검증**: Phase 1 fallback 로직 사용 안 함 확인 (콘솔 로그 확인)

#### 확인 사항

- [ ] 회원가입 시 `students` 테이블에 레코드 생성 성공
- [ ] `name` 필드가 올바르게 저장됨
- [ ] `tenant_id`가 올바르게 할당됨
- [ ] RLS 정책 위반 에러 없음
- [ ] 첫 로그인 시 레코드 중복 생성 방지 (이미 존재하는 경우 성공으로 처리)

### 2. 학부모 회원가입 추가 검증 (우선순위: 중간)

#### 추가 확인 사항

- [ ] 여러 학부모 계정으로 회원가입 테스트
- [ ] 다른 tenant로 회원가입 테스트 (tenant 선택 기능이 있는 경우)
- [ ] `name` 필드가 빈 문자열로 저장되는 경우 확인 (displayName이 없는 경우)

### 3. 에러 케이스 테스트 (우선순위: 중간)

#### 테스트 시나리오

1. **기본 tenant가 없는 경우**
   - Default Tenant 삭제 후 회원가입 시도
   - **검증**: 학생은 에러 처리 확인 (tenant_id 필수)
   - **검증**: 학부모는 nullable이므로 계속 진행 확인

2. **이미 레코드가 있는 경우**
   - 회원가입 후 다시 로그인
   - **검증**: UNIQUE constraint violation 처리 확인 (성공으로 처리)

3. **이메일 인증 전 로그인 시도**
   - 회원가입 후 이메일 인증 전에 로그인 시도
   - **검증**: 적절한 에러 메시지 표시 확인

### 4. 보안 검증 (우선순위: 높음)

#### 테스트 시나리오

1. **RLS 정책 검증**
   - 다른 사용자 ID로 레코드 생성 시도
   - **검증**: RLS 정책에 의해 차단되는지 확인
   - **검증**: 에러 메시지 확인

2. **정책 우회 시도**
   - Admin Client를 사용하지 않고 일반 클라이언트로만 테스트
   - **검증**: 모든 레코드 생성이 RLS 정책을 통과하는지 확인

### 5. 성능 검증 (우선순위: 낮음)

#### 확인 사항

- [ ] 정책 추가 후 쿼리 성능 확인
- [ ] 인덱스 사용 확인
- [ ] 회원가입 플로우 응답 시간 확인

---

## 🔍 검증 체크리스트

### 학생 회원가입

- [ ] 회원가입 시 `students` 레코드 생성 성공
- [ ] RLS 정책 위반 에러 없음
- [ ] 사이드바 즉시 표시
- [ ] `getCurrentUserRole()` 정상 동작
- [ ] Phase 1 fallback 로직 사용 안 함 (콘솔 로그 확인)

### 학부모 회원가입

- [x] 회원가입 시 `parent_users` 레코드 생성 성공 ✅
- [x] RLS 정책 위반 에러 없음 ✅
- [x] 사이드바 즉시 표시 ✅
- [x] `getCurrentUserRole()` 정상 동작 ✅
- [ ] Phase 1 fallback 로직 사용 안 함 확인 (콘솔 로그 확인)

### 공통

- [ ] 첫 로그인 시 레코드 중복 생성 방지
- [ ] 에러 처리 정상 동작
- [ ] 기존 사용자에게 영향 없음

---

## 📊 진행 상황

### Phase 3: 통합 테스트 및 검증

- [x] 학부모 회원가입 성공 확인 ✅
- [ ] 학생 회원가입 테스트
- [ ] 에러 케이스 테스트
- [ ] 보안 검증
- [ ] 성능 검증

---

## 🎯 우선순위별 작업 순서

### 즉시 수행 (오늘)

1. **학생 회원가입 테스트**
   - 가장 중요한 검증 항목
   - 학부모와 동일한 플로우이므로 빠르게 확인 가능

2. **Phase 1 fallback 로직 사용 여부 확인**
   - 콘솔 로그에서 `[auth] 테이블 레코드 없음, signup_role fallback 사용` 메시지 확인
   - 이 메시지가 나타나지 않으면 Phase 3가 정상 작동하는 것

### 이번 주 내

3. **에러 케이스 테스트**
   - 기본 tenant 없는 경우
   - 중복 레코드 생성 시도

4. **보안 검증**
   - RLS 정책 동작 확인

### 다음 단계 (선택사항)

5. **Phase 1 fallback 로직 제거 검토**
   - 모든 사용자가 테이블에 레코드를 가지는지 확인 후
   - fallback 로직 제거 여부 결정

---

## 📚 참고 문서

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) - Phase 3 상세 계획
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md) - 전체 구현 계획
- [parent_users name 컬럼 문제 해결](./parent-users-name-column-fix.md) - 최근 해결한 문제
- [JWT 인증 에러 처리](./jwt-user-not-found-error-fix.md) - 관련 에러 처리

---

## 💡 팁

### 콘솔 로그 확인 방법

1. **정상 작동 시** (Phase 3 성공):
   ```
   [auth] 학부모 레코드 생성 성공
   [auth] 첫 로그인 시 학부모 레코드 생성 성공
   ```

2. **Fallback 사용 시** (Phase 1):
   ```
   [auth] 테이블 레코드 없음, signup_role fallback 사용
   ```

3. **에러 발생 시**:
   ```
   [auth] 학부모 레코드 생성 실패
   ```

### 데이터베이스 확인 방법

```sql
-- parent_users 레코드 확인
SELECT id, tenant_id, name, created_at 
FROM parent_users 
ORDER BY created_at DESC 
LIMIT 10;

-- students 레코드 확인
SELECT id, tenant_id, name, created_at 
FROM students 
ORDER BY created_at DESC 
LIMIT 10;
```

---

**마지막 업데이트**: 2025-01-31

