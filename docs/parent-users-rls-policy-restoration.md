# 학부모 첫 로그인 RLS 정책 복원 완료

## 문제 상황

### 발견된 문제
- **학생**: 첫 로그인 시 레코드 생성 성공 ✅
- **학부모**: 첫 로그인 시 레코드 생성 실패 ❌
  - 에러: `new row violates row-level security policy for table "parent_users"`
  - 코드: `42501`

### 원인
롤백 마이그레이션(`20251213000001_revert_students_parents_insert_policy.sql`)이 실행되어 `parent_users_insert_own` 정책이 삭제됨

## 해결 과정

### 1. 롤백 마이그레이션 파일 삭제
- `supabase/migrations/20251213000001_revert_students_parents_insert_policy.sql` 삭제
- 마이그레이션 이력 수정: `npx supabase migration repair --status reverted 20251213000001`

### 2. 새 마이그레이션 파일 생성
- `supabase/migrations/20251213000002_restore_students_parents_insert_policy.sql` 생성
- `DROP POLICY IF EXISTS` 후 `CREATE POLICY`로 정책 복원

### 3. 마이그레이션 적용
- `npx supabase db push` 실행
- 정책 생성 완료

## 적용된 정책

### students_insert_own
```sql
CREATE POLICY "students_insert_own"
ON students
FOR INSERT
WITH CHECK (auth.uid() = id);
```

### parent_users_insert_own
```sql
CREATE POLICY "parent_users_insert_own"
ON parent_users
FOR INSERT
WITH CHECK (auth.uid() = id);
```

## 정책 확인 방법

Supabase 대시보드의 SQL Editor에서 다음 쿼리 실행:

```sql
-- parent_users 테이블의 모든 RLS 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'parent_users'
ORDER BY cmd, policyname;

-- parent_users_insert_own 정책 존재 여부 확인
SELECT * FROM pg_policies 
WHERE tablename = 'parent_users' 
AND policyname = 'parent_users_insert_own';

-- students_insert_own 정책 존재 여부 확인
SELECT * FROM pg_policies 
WHERE tablename = 'students' 
AND policyname = 'students_insert_own';
```

## 예상 결과

정책 복원 후:
- ✅ 학부모 첫 로그인 시 레코드 생성 성공
- ✅ RLS 정책 위반 에러 해결
- ✅ 학생과 동일하게 정상 작동
- ✅ 사이드바 즉시 표시 (fallback 로직 불필요)

## 테스트 시나리오

### 1. 신규 학부모 회원가입 및 첫 로그인
1. 회원가입 (학부모 선택)
2. 이메일 인증 완료
3. 첫 로그인
4. **검증**: `parent_users` 테이블에 레코드 생성 확인
5. **검증**: RLS 정책 위반 에러 없음 확인
6. **검증**: 사이드바 즉시 표시 확인

### 2. 기존 학부모 로그인
1. 이미 레코드가 있는 학부모로 로그인
2. **검증**: 레코드 생성 시도하지 않음
3. **검증**: 정상 로그인

### 3. 학생 회원가입 및 첫 로그인 (비교용)
1. 학생도 여전히 정상 작동하는지 확인
2. **검증**: `students` 테이블에 레코드 생성 확인

## 관련 파일

- `supabase/migrations/20251213000000_add_students_parents_insert_policy.sql` - INSERT 정책 추가 마이그레이션
- `supabase/migrations/20251213000002_restore_students_parents_insert_policy.sql` - 정책 복원 마이그레이션
- `app/actions/auth.ts` - `ensureUserRecord()`, `createParentRecord()` 함수
- `docs/first-login-name-field-fix.md` - name 필드 수정 문서
- `docs/log-analysis-rls-signup-issue.md` - 로그 분석 문서

---

**작성 일자**: 2025-01-31  
**구현 완료**: 2025-01-31  
**상태**: 마이그레이션 적용 완료, 테스트 대기 중

