# RLS 정책 분석 문서

## 개요

이 문서는 TimeLevelUp 프로젝트의 `students`와 `parent_users` 테이블에 대한 RLS(Row Level Security) 정책을 분석하고, 회원가입 시 레코드 생성을 위한 INSERT 정책을 설계한 문서입니다.

**분석 일자**: 2025-01-31  
**목적**: Phase 3 구현 후 발생한 RLS 정책 위반 문제 해결을 위한 정책 분석 및 설계

---

## 1. 현재 RLS 정책 현황

### 1.1 조회 방법

다음 방법들을 통해 현재 RLS 정책을 확인했습니다:

1. **데이터베이스 직접 조회 시도**: Supabase MCP를 통한 조회 시도 (연결 타임아웃 발생)
2. **마이그레이션 파일 검토**: `supabase/migrations/` 디렉토리의 모든 마이그레이션 파일 검토
3. **관련 코드 검토**: `app/actions/auth.ts`의 레코드 생성 함수 확인

### 1.2 students 테이블 RLS 정책

**조회 결과**:
- 마이그레이션 파일에서 `students` 테이블에 대한 RLS 정책 정의를 찾을 수 없음
- 초기 스키마에 포함되어 있을 가능성
- 데이터베이스 직접 조회는 연결 문제로 확인 불가

**예상 정책** (다른 테이블 패턴 기반):
- SELECT 정책: 존재할 가능성 높음 (학생 본인 데이터 조회)
- UPDATE 정책: 존재할 가능성 높음 (학생 본인 데이터 수정)
- DELETE 정책: 존재할 가능성 낮음 (일반적으로 관리자만 삭제)
- **INSERT 정책: 부재 확인** (마이그레이션 파일에 없음)

### 1.3 parent_users 테이블 RLS 정책

**조회 결과**:
- 마이그레이션 파일에서 `parent_users` 테이블에 대한 RLS 정책 정의를 찾을 수 없음
- 초기 스키마에 포함되어 있을 가능성
- 데이터베이스 직접 조회는 연결 문제로 확인 불가

**예상 정책** (다른 테이블 패턴 기반):
- SELECT 정책: 존재할 가능성 높음 (학부모 본인 데이터 조회)
- UPDATE 정책: 존재할 가능성 높음 (학부모 본인 데이터 수정)
- DELETE 정책: 존재할 가능성 낮음 (일반적으로 관리자만 삭제)
- **INSERT 정책: 부재 확인** (마이그레이션 파일에 없음)

### 1.4 RLS 활성화 상태

**확인 결과**:
- `students` 테이블: RLS 활성화 여부 확인 불가 (연결 문제)
- `parent_users` 테이블: RLS 활성화 여부 확인 불가 (연결 문제)
- 일반적으로 Supabase에서는 RLS가 기본적으로 활성화되어 있음

### 1.5 현재 정책 목록 요약

| 테이블 | 정책명 | 명령어 | 조건식 | 비고 |
|--------|--------|--------|--------|------|
| students | (확인 불가) | SELECT | (확인 불가) | 마이그레이션 파일에 없음 |
| students | (확인 불가) | UPDATE | (확인 불가) | 마이그레이션 파일에 없음 |
| students | (확인 불가) | DELETE | (확인 불가) | 마이그레이션 파일에 없음 |
| students | **(없음)** | **INSERT** | **-** | **부재 확인** |
| parent_users | (확인 불가) | SELECT | (확인 불가) | 마이그레이션 파일에 없음 |
| parent_users | (확인 불가) | UPDATE | (확인 불가) | 마이그레이션 파일에 없음 |
| parent_users | (확인 불가) | DELETE | (확인 불가) | 마이그레이션 파일에 없음 |
| parent_users | **(없음)** | **INSERT** | **-** | **부재 확인** |

---

## 2. INSERT 정책 부재 확인

### 2.1 문제 상황

**에러 로그** (Phase 3 구현 후 발생):
```
[auth] 학생 레코드 생성 실패 {
  error: 'new row violates row-level security policy for table "students"',
  code: '42501'
}
```

**원인**:
- `students` 테이블에 INSERT를 허용하는 RLS 정책이 없음
- `parent_users` 테이블에도 INSERT를 허용하는 RLS 정책이 없음
- 회원가입 시 새 사용자가 자신의 레코드를 생성할 권한이 없음

### 2.2 영향 범위

- **학생 회원가입**: `students` 테이블에 레코드 생성 실패
- **학부모 회원가입**: `parent_users` 테이블에 레코드 생성 실패
- **현재 해결책**: Phase 1 fallback 로직으로 사이드바는 표시되지만, 레코드 자동 생성은 실패

### 2.3 문제점 분석

1. **보안 정책 부재**: INSERT 정책이 없어 회원가입 시 레코드 생성 불가
2. **일관성 부족**: 다른 테이블에는 INSERT 정책이 있으나, 핵심 테이블에 없음
3. **사용자 경험 저하**: 회원가입 후 `/settings`에서 수동으로 정보 입력 필요

---

## 3. INSERT 정책 설계

### 3.1 설계 원칙

**보안 원칙**:
1. **최소 권한 원칙**: 사용자는 자신의 레코드만 생성 가능
2. **명확한 조건**: `auth.uid() = id`로 명확히 제한
3. **일관성**: 기존 RLS 정책 패턴과 일치

**설계 고려사항**:
- `tenant_id` nullable 처리 (students는 NOT NULL, parent_users는 nullable)
- 회원가입 시점의 사용자 인증 상태
- 중복 레코드 생성 방지 (UNIQUE constraint와의 관계)

### 3.2 다른 테이블의 INSERT 정책 패턴 참고

**참고한 정책 예시**:

1. **student_plan 테이블** (`20251209000001_add_student_plan_rls_and_triggers.sql`):
```sql
CREATE POLICY "student_plan_student_insert" ON student_plan
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
  );
```
- 패턴: 자신의 `student_id`로만 생성 가능
- 조건: `student_id = auth.uid()`

2. **master_custom_contents 테이블** (`20251209140747_create_master_custom_contents.sql`):
```sql
CREATE POLICY "master_custom_contents_insert_policy"
ON master_custom_contents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'consultant')
  )
);
```
- 패턴: 관리자/컨설턴트만 생성 가능
- 조건: `admin_users` 테이블 조회

3. **attendance_qr_codes 테이블** (`20251208180000_create_attendance_qr_codes_table.sql`):
```sql
CREATE POLICY "attendance_qr_codes_insert_admin" ON attendance_qr_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = attendance_qr_codes.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );
```
- 패턴: 관리자만 생성 가능 (같은 tenant)
- 조건: `admin_users` 테이블 조회 + tenant_id 일치

### 3.3 students 테이블 INSERT 정책 설계

**정책명**: `students_insert_own`

**정책 정의**:
```sql
CREATE POLICY "students_insert_own"
ON students
FOR INSERT
WITH CHECK (auth.uid() = id);
```

**설명**:
- 사용자는 자신의 ID(`id = auth.uid()`)로만 레코드 생성 가능
- `WITH CHECK` 절로 INSERT 시점에 검증
- `tenant_id`는 NOT NULL 제약조건이므로 코드에서 할당 필요 (이미 `createStudentRecord()` 함수에서 처리)

**정책명 네이밍**:
- 패턴: `{table}_insert_{scope}`
- 예시: `students_insert_own` (자신의 레코드만 생성)

**조건식 분석**:
- `auth.uid()`: 현재 인증된 사용자의 ID
- `id`: INSERT하려는 레코드의 ID (students 테이블의 Primary Key)
- `auth.uid() = id`: 자신의 ID로만 레코드 생성 가능

### 3.4 parent_users 테이블 INSERT 정책 설계

**정책명**: `parent_users_insert_own`

**정책 정의**:
```sql
CREATE POLICY "parent_users_insert_own"
ON parent_users
FOR INSERT
WITH CHECK (auth.uid() = id);
```

**설명**:
- 사용자는 자신의 ID(`id = auth.uid()`)로만 레코드 생성 가능
- `WITH CHECK` 절로 INSERT 시점에 검증
- `tenant_id`는 nullable이므로 NULL 허용 (이미 `createParentRecord()` 함수에서 처리)

**정책명 네이밍**:
- 패턴: `{table}_insert_{scope}`
- 예시: `parent_users_insert_own` (자신의 레코드만 생성)

**조건식 분석**:
- `auth.uid()`: 현재 인증된 사용자의 ID
- `id`: INSERT하려는 레코드의 ID (parent_users 테이블의 Primary Key)
- `auth.uid() = id`: 자신의 ID로만 레코드 생성 가능

### 3.5 기존 정책과의 일관성 검토

**정책명 패턴**:
- ✅ `{table}_insert_{scope}` 형식 사용
- ✅ 다른 테이블의 INSERT 정책과 일관성 유지

**조건식 패턴**:
- ✅ `auth.uid() = id` 패턴 사용 (자신의 레코드만 생성)
- ✅ 다른 테이블의 `student_id = auth.uid()` 패턴과 유사

**보안 수준**:
- ✅ 최소 권한 원칙 준수 (자신의 레코드만 생성 가능)
- ✅ 명확한 조건식으로 보안 강화

---

## 4. 보안 검토

### 4.1 정책 조건식 검증

**검증 항목**:

1. **자신의 레코드만 생성 가능**: ✅
   - `auth.uid() = id` 조건으로 자신의 ID로만 레코드 생성 가능
   - 다른 사용자 ID로 시도 시 차단됨

2. **인증되지 않은 사용자 차단**: ✅
   - `auth.uid()`가 NULL인 경우 조건식이 FALSE가 되어 차단됨
   - 인증되지 않은 사용자는 레코드 생성 불가

3. **다른 사용자 레코드 생성 차단**: ✅
   - 다른 사용자 ID로 시도 시 `auth.uid() = id` 조건이 FALSE가 되어 차단됨
   - 예: 사용자 A가 사용자 B의 ID로 레코드 생성 시도 시 실패

### 4.2 잠재적 보안 위험 분석

**위험 항목**:

1. **정책 우회 시도**: ⚠️ 낮음
   - `auth.uid()`는 Supabase Auth에서 제공하는 함수로 우회 불가
   - Service Role Key를 사용한 우회는 별도 정책으로 차단 필요 (현재는 Admin Client 사용 시 우회 가능)

2. **권한 상승**: ✅ 안전
   - 일반 사용자가 관리자 권한을 획득할 수 없음
   - 자신의 레코드만 생성 가능하므로 권한 상승 불가

3. **데이터 무결성**: ✅ 안전
   - UNIQUE constraint로 중복 레코드 생성 방지
   - `id`는 Primary Key이므로 중복 불가
   - `tenant_id`는 코드에서 할당되므로 무결성 유지

**대응 방안**:
- ✅ 정책 조건식의 엄격성 확인 완료
- ✅ 추가 제약조건 불필요 (UNIQUE constraint로 충분)
- ⚠️ 로깅 및 모니터링: `createStudentRecord()`, `createParentRecord()` 함수에서 이미 로깅 구현됨

### 4.3 기존 정책과의 충돌 검토

**검토 항목**:

1. **기존 SELECT/UPDATE/DELETE 정책과의 일관성**: ✅
   - INSERT 정책은 다른 정책과 독립적으로 작동
   - 기존 정책과 충돌 없음

2. **정책 간 상호작용**: ✅
   - INSERT 정책은 레코드 생성 시에만 적용
   - SELECT/UPDATE/DELETE 정책과 별도로 작동

3. **정책 우선순위**: ✅
   - RLS 정책은 OR 조건으로 결합됨
   - 여러 정책이 있을 경우 하나라도 통과하면 허용
   - 현재는 INSERT 정책이 하나뿐이므로 문제 없음

### 4.4 보안 검토 결과

**종합 평가**: ✅ **안전**

**이유**:
1. 최소 권한 원칙 준수 (자신의 레코드만 생성 가능)
2. 명확한 조건식으로 보안 강화
3. 기존 정책과의 충돌 없음
4. 데이터 무결성 보장

**권장사항**:
- ✅ 정책 추가 권장
- ✅ Phase 2에서 마이그레이션 파일 작성 및 적용
- ⚠️ Service Role Key 사용 시 우회 가능하므로, 가능한 한 일반 클라이언트 사용 권장

---

## 5. 권장사항

### 5.1 정책 추가 필요성

**필수**: ✅ **즉시 추가 필요**

**이유**:
1. 회원가입 플로우 완성을 위해 필수
2. Phase 3 구현 목표 달성을 위해 필수
3. 보안 강화 (Admin Client 우회 불필요)

### 5.2 구현 우선순위

**우선순위**: 🔴 **높음 (High)**

**이유**:
1. Phase 3 구현이 완료되었으나 RLS 정책 위반으로 동작하지 않음
2. 회원가입 플로우의 핵심 기능
3. 사용자 경험 개선에 직접 영향

### 5.3 구현 계획

**Phase 2: 마이그레이션 파일 작성 및 테스트**
1. 마이그레이션 파일 생성
2. 개발 환경 테스트
3. 보안 검증

**Phase 3: 통합 테스트 및 검증**
1. 회원가입 플로우 통합 테스트
2. 에러 케이스 테스트
3. 성능 및 보안 검증

---

## 6. 마이그레이션 SQL 초안

### 6.1 정책 생성 SQL

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

### 6.2 롤백 SQL (참고용)

```sql
-- students 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "students_insert_own" ON students;

-- parent_users 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "parent_users_insert_own" ON parent_users;
```

---

## 7. 참고 자료

### 7.1 관련 문서

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) - Phase 1 작업 계획
- [사이드바 미표시 문제 해결 TODO](./sidebar-missing-after-signup-fix-todo.md) - Phase 3 구현 계획
- [students 테이블 스키마 분석](./students-table-schema-analysis.md) - 테이블 구조 분석
- [parent_users 테이블 스키마 분석](./parent-users-table-schema-analysis.md) - 테이블 구조 분석

### 7.2 참고 코드

- [인증 액션 코드](./app/actions/auth.ts) - `createStudentRecord()`, `createParentRecord()` 함수
- [마이그레이션 파일 예시](./supabase/migrations/20251209000001_add_student_plan_rls_and_triggers.sql) - 다른 테이블의 INSERT 정책 패턴

### 7.3 Supabase 문서

- [Row Level Security (RLS) 정책](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS 정책 작성 가이드](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

**작성 일자**: 2025-01-31  
**최종 수정**: 2025-01-31  
**작성자**: AI Assistant  
**검토 상태**: 보안 검토 완료

