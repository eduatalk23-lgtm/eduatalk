# tenant_id nullable 변경 마이그레이션 계획

## 개요

이 문서는 `students` 테이블의 `tenant_id`를 nullable로 변경하는 마이그레이션 계획을 수립한 문서입니다.

**작성 일자**: 2025-01-XX  
**목적**: Phase 2 중기 개선을 위한 마이그레이션 계획 수립

---

## 1. 변경 필요성 검토

### 1.1 현재 상황

#### ERD 문서 기준
- `students.tenant_id`: `NOT NULL` 제약조건
- `parent_users.tenant_id`: nullable (변경 불필요)

#### 실제 코드 기준
- `students.tenant_id`: nullable로 처리됨
- `parent_users.tenant_id`: nullable (ERD와 일치)

#### 불일치 사항
- **ERD와 코드 간 불일치**: `students.tenant_id`가 ERD에서는 NOT NULL, 코드에서는 nullable
- **회원가입 플로우**: Phase 1 fallback 로직과 일치 (tenant_id 없을 수 있음)
- **기본 tenant 할당**: 코드에서 "Default Tenant" 조회하여 할당

### 1.2 변경 필요성

#### ✅ 변경 필요 (권장)

**이유**:
1. **코드와의 일치성**: 현재 코드가 nullable로 처리하고 있음
2. **Phase 1 fallback 로직**: signup_role fallback과 일관성 유지
3. **회원가입 플로우 개선**: Phase 3에서 회원가입 시 기본 레코드 생성 가능
4. **유연성**: tenant_id가 없는 경우도 처리 가능

#### ❌ 변경 불필요 (대안)

**이유**:
1. **데이터 무결성**: NOT NULL 제약조건으로 데이터 무결성 보장
2. **회원가입 시 기본 tenant 할당**: 항상 기본 tenant 할당 필수
3. **RLS 정책 단순화**: NULL 값 처리 로직 불필요

### 1.3 결정

**결정**: ✅ **변경 필요** (students 테이블만)

**이유**:
- 현재 코드 사용 패턴과 일치
- Phase 1 fallback 로직과 일관성
- 회원가입 플로우 개선 가능 (Phase 3)
- `parent_users` 테이블은 이미 nullable이므로 변경 불필요

---

## 2. 영향 범위 분석

### 2.1 데이터베이스 영향

#### 제약조건 변경
- `ALTER TABLE students ALTER COLUMN tenant_id DROP NOT NULL;`
- 기존 데이터에 영향 없음 (NULL 값 허용)

#### 외래키 제약조건
- `tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT`
- 외래키 제약조건 유지 (NULL 값 허용)

#### 인덱스
- `tenant_id` 기반 인덱스는 nullable 값도 처리 가능
- 부분 인덱스(`WHERE tenant_id IS NOT NULL`) 사용 가능

### 2.2 RLS 정책 영향

#### 영향 받는 RLS 정책

다음 마이그레이션 파일의 RLS 정책이 `students.tenant_id`를 사용:

1. **20251209000001_add_student_plan_rls_and_triggers.sql**
   - `student_plan` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

2. **20251209000002_create_plan_group_items.sql**
   - `plan_group_items` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

3. **20251209140747_create_master_custom_contents.sql**
   - `master_custom_contents` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

4. **20251208180000_create_attendance_qr_codes_table.sql**
   - `attendance_qr_codes` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

5. **20251212000000_create_attendance_tables.sql**
   - `attendance_records` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

6. **20251212000001_create_sms_logs_table.sql**
   - `sms_logs` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

7. **20251209212800_add_history_rls.sql**
   - `plan_history`, `reschedule_log` 테이블 RLS 정책
   - `students.tenant_id` 기반 필터링

#### RLS 정책 수정 필요성

**검토 결과**: 대부분의 RLS 정책은 `students.tenant_id`를 사용하지만, NULL 값 처리는 이미 포함되어 있을 가능성

**예시**:
```sql
-- NULL 값 처리 예시
WHERE students.tenant_id = some_table.tenant_id
-- 또는
WHERE (students.tenant_id IS NULL OR students.tenant_id = some_table.tenant_id)
```

**권장사항**: 
- 실제 RLS 정책 확인 필요
- NULL 값 처리 로직 추가 필요 여부 확인

### 2.3 코드 영향

#### 영향 받는 코드

1. **lib/data/students.ts**
   - `upsertStudent()` 함수: 기본 tenant 할당 로직
   - 변경 불필요 (이미 nullable 처리)

2. **lib/auth/getCurrentUserRole.ts**
   - Phase 1 fallback 로직
   - 변경 불필요 (이미 nullable 처리)

3. **lib/tenant/getTenantContext.ts**
   - tenant_id 조회 로직
   - 변경 불필요 (이미 nullable 처리)

#### 코드 변경 필요성

**결론**: 코드 변경 불필요

**이유**:
- 현재 코드가 이미 nullable로 처리하고 있음
- 마이그레이션 후에도 동일하게 동작

---

## 3. 마이그레이션 계획

### 3.1 마이그레이션 파일 작성

#### 파일명
`supabase/migrations/[timestamp]_make_students_tenant_id_nullable.sql`

#### 마이그레이션 내용

```sql
-- ============================================
-- Migration: students 테이블 tenant_id nullable 변경
-- Date: 2025-01-XX
-- Purpose: Phase 2 중기 개선 - 코드와 ERD 일치성 확보
-- ============================================

-- 1. students 테이블의 tenant_id를 nullable로 변경
ALTER TABLE students 
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. 변경 사항 설명
COMMENT ON COLUMN students.tenant_id IS 
  '테넌트 ID (nullable). 회원가입 시 tenant_id가 없을 수 있으며, /settings에서 정보 입력 후 할당됩니다.';

-- 3. 기존 데이터 확인 (NULL 값이 있는지 확인)
-- SELECT COUNT(*) FROM students WHERE tenant_id IS NULL;
```

### 3.2 롤백 마이그레이션

#### 파일명
`supabase/migrations/[timestamp]_revert_students_tenant_id_not_null.sql` (필요 시)

#### 롤백 내용

```sql
-- ============================================
-- Rollback: students 테이블 tenant_id NOT NULL 복원
-- Date: 2025-01-XX
-- Warning: NULL 값이 있으면 실패합니다.
-- ============================================

-- 1. NULL 값 확인
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot revert: NULL values exist in students.tenant_id. Please assign tenant_id to all students first.';
  END IF;
END $$;

-- 2. students 테이블의 tenant_id를 NOT NULL로 복원
ALTER TABLE students 
  ALTER COLUMN tenant_id SET NOT NULL;

-- 3. 주석 복원
COMMENT ON COLUMN students.tenant_id IS 
  '테넌트 ID (NOT NULL). 모든 학생은 테넌트에 소속되어야 합니다.';
```

### 3.3 RLS 정책 검토 및 수정 (필요 시)

#### 검토 항목

1. **NULL 값 처리 로직 확인**
   - 각 RLS 정책에서 NULL 값 처리 여부 확인
   - NULL 값 처리 로직 추가 필요 여부 확인

2. **성능 영향 확인**
   - NULL 값이 많을 경우 인덱스 성능 확인
   - 부분 인덱스 사용 검토

#### 수정 필요 시

별도 마이그레이션 파일 작성:
`supabase/migrations/[timestamp]_update_rls_for_nullable_tenant_id.sql`

---

## 4. 테스트 계획

### 4.1 개발 환경 테스트

#### 테스트 시나리오

1. **마이그레이션 실행**
   - 마이그레이션 파일 적용
   - 에러 없이 완료 확인

2. **기존 데이터 확인**
   - 기존 데이터 정합성 확인
   - NULL 값 존재 여부 확인

3. **RLS 정책 테스트**
   - 각 RLS 정책에서 NULL 값 처리 확인
   - 접근 권한 테스트

4. **코드 동작 확인**
   - `getCurrentUserRole()` 함수 동작 확인
   - `upsertStudent()` 함수 동작 확인
   - 레이아웃 파일 동작 확인

### 4.2 스테이징 환경 테스트

#### 테스트 시나리오

1. **통합 테스트**
   - 전체 플로우 테스트
   - 회원가입 플로우 테스트
   - 대시보드 접근 테스트

2. **성능 테스트**
   - 쿼리 성능 확인
   - 인덱스 사용 확인

3. **롤백 테스트**
   - 롤백 마이그레이션 실행
   - 데이터 정합성 확인

### 4.3 프로덕션 환경 배포 계획

#### 배포 전 체크리스트

- [ ] 개발 환경 테스트 완료
- [ ] 스테이징 환경 테스트 완료
- [ ] 롤백 계획 수립 완료
- [ ] 모니터링 계획 수립 완료
- [ ] 백업 완료

#### 배포 절차

1. **백업 수행**
   - 데이터베이스 백업
   - 마이그레이션 전 상태 저장

2. **마이그레이션 실행**
   - 마이그레이션 파일 적용
   - 에러 확인 및 처리

3. **검증**
   - 데이터 정합성 확인
   - 기능 동작 확인

4. **모니터링**
   - 에러 로그 모니터링
   - 성능 모니터링

---

## 5. 위험도 평가

### 5.1 위험도: 낮음

#### 이유

1. **기존 데이터 영향 없음**
   - NOT NULL → nullable 변경은 기존 데이터에 영향 없음
   - NULL 값 허용만 추가

2. **코드 변경 불필요**
   - 현재 코드가 이미 nullable로 처리
   - 마이그레이션 후에도 동일하게 동작

3. **롤백 가능**
   - 롤백 마이그레이션 준비
   - NULL 값이 없으면 롤백 가능

### 5.2 잠재적 위험

1. **RLS 정책 문제**
   - NULL 값 처리 로직 부족 시 접근 권한 문제
   - **대응**: RLS 정책 검토 및 수정

2. **성능 영향**
   - NULL 값이 많을 경우 인덱스 성능 저하
   - **대응**: 부분 인덱스 사용 검토

---

## 6. 결론 및 권장사항

### 6.1 권장사항

**✅ 마이그레이션 실행 권장**

**이유**:
1. 코드와 ERD 일치성 확보
2. Phase 1 fallback 로직과 일관성
3. 회원가입 플로우 개선 가능 (Phase 3)
4. 위험도 낮음

### 6.2 실행 순서

1. **현재 데이터베이스 상태 확인** (선행 작업)
2. **마이그레이션 파일 작성**
3. **RLS 정책 검토 및 수정** (필요 시)
4. **개발 환경 테스트**
5. **스테이징 환경 테스트**
6. **프로덕션 환경 배포**

### 6.3 주의사항

1. **NULL 값 처리**
   - RLS 정책에서 NULL 값 처리 확인
   - 코드에서 NULL 값 처리 확인

2. **롤백 준비**
   - 롤백 마이그레이션 준비
   - NULL 값이 있으면 롤백 불가

3. **모니터링**
   - 마이그레이션 후 모니터링 필수
   - 에러 로그 확인

---

## 7. 참고 파일

- [students 테이블 분석](students-table-schema-analysis.md)
- [parent_users 테이블 분석](parent-users-table-schema-analysis.md)
- [마이그레이션 검토 요약](migration-review-summary.md)
- [ERD 문서](timetable/erd-cloud/01_core_tables.sql)

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX








