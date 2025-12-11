# RLS 정책 개선 TODO

## 📋 문제 개요

**문제**: Phase 3 구현 후 회원가입 시 `students`/`parent_users` 테이블에 레코드 생성 시도 시 RLS 정책 위반 에러 발생

**에러 로그**:

```
[auth] 학생 레코드 생성 실패 {
  error: 'new row violates row-level security policy for table "students"',
  code: '42501'
}
```

**원인**:

- `students` 및 `parent_users` 테이블에 INSERT를 허용하는 RLS 정책이 없음
- 회원가입 시 새 사용자가 자신의 레코드를 생성할 권한이 없음

**현재 상황**:

- Phase 1 fallback 로직으로 사이드바는 표시됨 (임시 해결)
- Phase 3 레코드 자동 생성은 실패 (RLS 정책 위반)
- Admin Client로 우회 가능하지만 보안 위험 존재

---

## 🎯 해결 방법

### 권장 방법: RLS 정책 추가

**이유**:

1. **보안**: 사용자가 자신의 레코드만 생성 가능 (Admin Client 우회보다 안전)
2. **명확성**: RLS 정책으로 의도가 명확히 표현됨
3. **일관성**: 다른 RLS 정책과 패턴 일치
4. **유지보수**: Admin Client 우회 로직 불필요

### 대안: Admin Client 사용 (비권장)

**단점**:

- Service Role Key는 RLS를 완전히 우회하여 보안 위험
- 모든 테이블에 무제한 접근 가능
- 잘못 사용 시 보안 취약점 발생 가능

---

## 📝 Phase 1: RLS 정책 분석 및 설계

### 1.1 현재 RLS 정책 확인

#### 작업 내용

- [x] `students` 테이블의 현재 RLS 정책 확인
  - [x] SELECT 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] UPDATE 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] DELETE 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] INSERT 정책 존재 여부 확인 (**부재 확인**)
- [x] `parent_users` 테이블의 현재 RLS 정책 확인
  - [x] SELECT 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] UPDATE 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] DELETE 정책 확인 (마이그레이션 파일에 없음, 초기 스키마에 포함 가능성)
  - [x] INSERT 정책 존재 여부 확인 (**부재 확인**)
- [x] 관련 마이그레이션 파일 검토
  - [x] RLS 활성화 여부 확인 (연결 문제로 직접 확인 불가, 일반적으로 활성화됨)
  - [x] 기존 정책 정의 확인 (마이그레이션 파일에 없음)

#### 산출물

- [x] `docs/rls-policy-analysis.md` 작성
  - [x] 현재 정책 목록
  - [x] 정책 패턴 분석
  - [x] 누락된 정책 식별

### 1.2 INSERT 정책 설계

#### 작업 내용

- [x] `students` 테이블 INSERT 정책 설계
  - [x] 정책명: `students_insert_own`
  - [x] 조건: `auth.uid() = id` (자신의 레코드만 생성 가능)
  - [x] 보안 검토
- [x] `parent_users` 테이블 INSERT 정책 설계
  - [x] 정책명: `parent_users_insert_own`
  - [x] 조건: `auth.uid() = id` (자신의 레코드만 생성 가능)
  - [x] 보안 검토

#### 설계 원칙

1. **최소 권한 원칙**: 사용자는 자신의 레코드만 생성 가능
2. **명확한 조건**: `auth.uid() = id`로 명확히 제한
3. **일관성**: 기존 RLS 정책 패턴과 일치

#### 산출물

- [x] 정책 설계 문서 작성 ([rls-policy-analysis.md](./rls-policy-analysis.md) 참조)
- [x] 보안 검토 완료 ([rls-policy-analysis.md](./rls-policy-analysis.md) 4장 참조)

---

## 📝 Phase 2: 마이그레이션 파일 작성 및 테스트

### 2.1 마이그레이션 파일 작성

#### 작업 내용

- [x] 마이그레이션 파일 생성
  - [x] 파일명: `supabase/migrations/20250131000000_add_students_parents_insert_policy.sql`
  - [x] `students` 테이블 INSERT 정책 추가
  - [x] `parent_users` 테이블 INSERT 정책 추가
  - [x] 정책 설명 주석 추가

#### 마이그레이션 SQL

```sql
-- students 테이블 INSERT 정책 추가
CREATE POLICY "students_insert_own"
ON students
FOR INSERT
WITH CHECK (auth.uid() = id);

-- parent_users 테이블 INSERT 정책 추가
CREATE POLICY "parent_users_insert_own"
ON parent_users
FOR INSERT
WITH CHECK (auth.uid() = id);
```

#### 검증 항목

- [x] SQL 문법 오류 없음 확인
- [x] 정책명 중복 없음 확인
- [x] 조건식 정확성 확인

### 2.2 롤백 마이그레이션 작성

#### 작업 내용

- [x] 롤백 마이그레이션 파일 생성 (필요 시)
  - [x] 파일명: `supabase/migrations/20250131000001_revert_students_parents_insert_policy.sql`
  - [x] 정책 삭제 SQL 작성

#### 롤백 SQL

```sql
-- students 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "students_insert_own" ON students;

-- parent_users 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "parent_users_insert_own" ON parent_users;
```

### 2.3 개발 환경 테스트

#### 작업 내용

- [x] 개발 환경 마이그레이션 실행
  - [x] 마이그레이션 파일 작성 완료 (`supabase/migrations/20251213000000_add_students_parents_insert_policy.sql`)
  - [x] 마이그레이션 파일 검증 완료
  - [x] 마이그레이션 파일 적용 완료 (타임스탬프 수정 후 성공적으로 적용됨)
- [ ] 정책 동작 확인 (수동 테스트 필요)
  - [ ] 학생 회원가입 시 레코드 생성 성공 확인
  - [ ] 학부모 회원가입 시 레코드 생성 성공 확인
  - [ ] 다른 사용자 레코드 생성 시도 시 실패 확인 (보안 검증)

**참고**: 마이그레이션 파일은 타임스탬프 문제로 인해 재생성되었습니다. 원래 `20250131000000` 타임스탬프가 원격 데이터베이스의 마지막 마이그레이션(`20251212000002`)보다 이전이어서 `20251213000000`으로 변경하여 성공적으로 적용되었습니다. 자세한 내용은 [마이그레이션 타임스탬프 문제 해결](./migration-timestamp-issue-resolution.md) 문서를 참조하세요.

#### 테스트 시나리오

1. **학생 회원가입 테스트**

   - 회원가입 폼 작성 (학생 선택)
   - 회원가입 제출
   - `students` 테이블에 레코드 생성 확인
   - RLS 정책 위반 에러 없음 확인

2. **학부모 회원가입 테스트**

   - 회원가입 폼 작성 (학부모 선택)
   - 회원가입 제출
   - `parent_users` 테이블에 레코드 생성 확인
   - RLS 정책 위반 에러 없음 확인

3. **보안 테스트**
   - 다른 사용자 ID로 레코드 생성 시도
   - RLS 정책에 의해 차단되는지 확인

---

## 📝 Phase 3: 통합 테스트 및 검증

### 3.1 회원가입 플로우 통합 테스트

#### 작업 내용

- [ ] 학생 회원가입 플로우 전체 테스트
  - [ ] 회원가입 → 이메일 인증 → 로그인 → 대시보드 접근
  - [ ] 레코드 생성 성공 확인
  - [ ] 사이드바 즉시 표시 확인
  - [ ] Phase 1 fallback 로직 사용 안 함 확인
- [ ] 학부모 회원가입 플로우 전체 테스트
  - [ ] 회원가입 → 이메일 인증 → 로그인 → 대시보드 접근
  - [ ] 레코드 생성 성공 확인
  - [ ] 사이드바 즉시 표시 확인
  - [ ] Phase 1 fallback 로직 사용 안 함 확인

#### 검증 항목

- [ ] 회원가입 시 레코드 생성 성공
- [ ] RLS 정책 위반 에러 없음
- [ ] 사이드바 즉시 표시
- [ ] `getCurrentUserRole()` 정상 동작
- [ ] Phase 1 fallback 로직 사용 안 함

### 3.2 에러 케이스 테스트

#### 작업 내용

- [ ] 기본 tenant가 없는 경우 테스트
  - [ ] Default Tenant 삭제 후 회원가입 시도
  - [ ] 에러 처리 확인
- [ ] 이미 레코드가 있는 경우 테스트
  - [ ] 중복 레코드 생성 시도
  - [ ] UNIQUE constraint 처리 확인

### 3.3 성능 및 보안 검증

#### 작업 내용

- [ ] 성능 영향 확인
  - [ ] 정책 추가 후 쿼리 성능 확인
  - [ ] 인덱스 사용 확인
- [ ] 보안 검증
  - [ ] 다른 사용자 레코드 생성 시도 시 차단 확인
  - [ ] 정책 우회 시도 시 차단 확인

---

## 📝 Phase 4: 프로덕션 배포 (선택사항)

### 4.1 스테이징 환경 테스트

#### 작업 내용

- [ ] 스테이징 환경 마이그레이션 실행
  - [ ] 마이그레이션 파일 적용
  - [ ] 통합 테스트
  - [ ] 성능 테스트
- [ ] 롤백 테스트
  - [ ] 롤백 마이그레이션 실행
  - [ ] 데이터 정합성 확인

### 4.2 프로덕션 배포 계획

#### 작업 내용

- [ ] 배포 전 체크리스트
  - [ ] 개발 환경 테스트 완료
  - [ ] 스테이징 환경 테스트 완료
  - [ ] 롤백 계획 수립
  - [ ] 모니터링 계획 수립
- [ ] 배포 절차
  - [ ] 백업 수행
  - [ ] 마이그레이션 실행
  - [ ] 검증
  - [ ] 모니터링

---

## 📊 진행 상황 추적

### Phase 1: RLS 정책 분석 및 설계

- [x] 작업 시작
- [x] 현재 RLS 정책 확인 완료
- [x] INSERT 정책 설계 완료
- [x] 보안 검토 완료
- [x] 분석 문서 작성 완료 ([rls-policy-analysis.md](./rls-policy-analysis.md))

### Phase 2: 마이그레이션 파일 작성 및 테스트

- [x] 작업 시작
- [x] 마이그레이션 파일 작성 완료 (`supabase/migrations/20251213000000_add_students_parents_insert_policy.sql`)
- [x] 롤백 마이그레이션 작성 완료 (`supabase/migrations/20251213000001_revert_students_parents_insert_policy.sql`)
- [x] 마이그레이션 파일 검증 완료
- [x] 개발 환경 마이그레이션 적용 완료 (타임스탬프 수정 후 성공)
- [ ] 개발 환경 테스트 완료 (수동 테스트 필요)

### Phase 3: 통합 테스트 및 검증

- [ ] 작업 시작
- [ ] 회원가입 플로우 통합 테스트 완료
- [ ] 에러 케이스 테스트 완료
- [ ] 성능 및 보안 검증 완료

### Phase 4: 프로덕션 배포

- [ ] 작업 시작
- [ ] 스테이징 환경 테스트 완료
- [ ] 프로덕션 배포 완료

---

## 🔍 검증 및 테스트

### 통합 테스트 시나리오

#### 시나리오 1: 학생 회원가입 (정상 케이스)

1. 회원가입 폼 작성 (학생 선택)
2. 회원가입 제출
3. **검증**: `students` 테이블에 레코드 생성 확인
4. **검증**: RLS 정책 위반 에러 없음 확인
5. 이메일 인증 완료
6. 로그인
7. `/dashboard` 접근
8. **검증**: 사이드바 즉시 표시 확인
9. **검증**: Phase 1 fallback 로직 사용 안 함 확인

#### 시나리오 2: 학부모 회원가입 (정상 케이스)

1. 회원가입 폼 작성 (학부모 선택)
2. 회원가입 제출
3. **검증**: `parent_users` 테이블에 레코드 생성 확인
4. **검증**: RLS 정책 위반 에러 없음 확인
5. 이메일 인증 완료
6. 로그인
7. `/parent/dashboard` 접근
8. **검증**: 사이드바 즉시 표시 확인
9. **검증**: Phase 1 fallback 로직 사용 안 함 확인

#### 시나리오 3: 보안 검증 (에러 케이스)

1. 다른 사용자 ID로 레코드 생성 시도
2. **검증**: RLS 정책에 의해 차단되는지 확인
3. **검증**: 에러 메시지 확인

---

## 📚 참고 문서

- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md)
- [Phase 3 구현 요약](./phase3-implementation-summary.md)
- [students 테이블 스키마 분석](./students-table-schema-analysis.md)
- [parent_users 테이블 스키마 분석](./parent-users-table-schema-analysis.md)
- [RLS 정책 위반 교재 복사 문제 해결](./rls-policy-violation-fix.md)

---

## ⚠️ 주의사항

1. **보안 검토 필수**: RLS 정책 추가 전 보안 검토 필요
2. **테스트 충분히 수행**: 개발 환경에서 충분한 테스트 후 배포
3. **롤백 계획 준비**: 문제 발생 시 롤백 가능하도록 준비
4. **모니터링**: 배포 후 모니터링 필수

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX  
**관련 이슈**: Phase 3 RLS 정책 위반 문제
