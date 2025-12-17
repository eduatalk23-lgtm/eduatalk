# 마이그레이션 파일 검토 요약

## 개요

이 문서는 `students` 및 `parent_users` 테이블 관련 마이그레이션 파일을 검토한 요약 문서입니다.

**검토 일자**: 2025-01-XX  
**목적**: Phase 2 중기 개선을 위한 제약조건 변경 이력 확인

---

## 1. 검토 범위

### 1.1 검토 대상

- `supabase/migrations/` 디렉토리의 모든 마이그레이션 파일
- `students` 및 `parent_users` 테이블 관련 마이그레이션
- 제약조건 변경 이력
- `tenant_id` 관련 인덱스 및 RLS 정책

### 1.2 검토 방법

- 파일명 패턴 검색: `students`, `parent_users`
- 내용 검색: `CREATE TABLE`, `ALTER TABLE`, `tenant_id`
- RLS 정책 검색: `students`, `parent_users` 관련 정책

---

## 2. 검토 결과

### 2.1 테이블 생성 마이그레이션

**결과**: `students` 및 `parent_users` 테이블을 생성하는 마이그레이션 파일을 찾지 못함

**추정**:
- 테이블은 초기 스키마에 포함되어 있을 가능성
- 또는 다른 마이그레이션 도구로 관리되었을 가능성
- ERD 문서(`timetable/erd-cloud/01_core_tables.sql`)가 실제 스키마 정의일 가능성

### 2.2 제약조건 변경 이력

**결과**: `tenant_id` 제약조건 변경 이력 없음

**확인 사항**:
- `ALTER TABLE students ALTER COLUMN tenant_id` 관련 마이그레이션 없음
- `ALTER TABLE parent_users ALTER COLUMN tenant_id` 관련 마이그레이션 없음
- 현재 데이터베이스 상태 확인 필요

### 2.3 관련 마이그레이션 파일

다음 마이그레이션 파일들에서 `students` 또는 `parent_users`를 참조:

1. **20251209000001_add_student_plan_rls_and_triggers.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

2. **20251209000002_create_plan_group_items.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

3. **20251209140747_create_master_custom_contents.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

4. **20251208180000_create_attendance_qr_codes_table.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

5. **20251212000000_create_attendance_tables.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

6. **20251212000001_create_sms_logs_table.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

7. **20251209212800_add_history_rls.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

8. **20251209211500_create_plan_history_and_reschedule_log.sql**
   - `students` 테이블 참조
   - RLS 정책에서 `students.tenant_id` 사용

9. **20251208174347_add_attendance_settings_to_student_notifications.sql**
   - `students` 테이블 참조

**발견사항**:
- 모든 관련 마이그레이션에서 `students.tenant_id`를 사용
- RLS 정책에서 `students.tenant_id` 기반 필터링 사용
- `parent_users` 테이블 참조는 적음

---

## 3. RLS 정책 분석

### 3.1 students 테이블 관련 RLS 정책

**패턴**: 대부분의 RLS 정책에서 `students.tenant_id`를 사용하여 필터링

**예시** (20251209000001_add_student_plan_rls_and_triggers.sql):
```sql
-- 학생은 자신의 데이터만 조회 가능
CREATE POLICY "students_select_own"
  ON student_plan
  FOR SELECT
  USING (
    auth.uid() = student_plan.student_id
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_plan.student_id
      AND students.tenant_id = student_plan.tenant_id
    )
  );
```

**영향**:
- `students.tenant_id`가 NULL이면 RLS 정책에서 문제 발생 가능
- NULL 값 처리 로직 필요

### 3.2 parent_users 테이블 관련 RLS 정책

**결과**: `parent_users` 테이블 관련 RLS 정책은 적음

**발견사항**:
- 대부분의 RLS 정책은 `students` 테이블 중심
- `parent_users` 테이블은 직접적인 RLS 정책이 적음

---

## 4. 인덱스 분석

### 4.1 tenant_id 관련 인덱스

**검토 결과**: `students` 및 `parent_users` 테이블의 `tenant_id` 인덱스 관련 마이그레이션 없음

**추정**:
- 인덱스는 초기 스키마에 포함되어 있을 가능성
- 또는 자동 생성되었을 가능성

### 4.2 부분 인덱스 사용 가능성

**검토 결과**: 부분 인덱스(`WHERE tenant_id IS NOT NULL`) 사용 마이그레이션 없음

**권장사항**:
- `tenant_id` nullable 변경 시 부분 인덱스 고려
- 성능 최적화를 위한 인덱스 추가 검토

---

## 5. 외래키 제약조건 분석

### 5.1 students 테이블

**ERD 문서 기준**:
- `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`

**현재 상태**: 확인 필요

### 5.2 parent_users 테이블

**ERD 문서 기준**:
- `tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT` (nullable)

**현재 상태**: 확인 필요

---

## 6. 결론 및 권장사항

### 6.1 주요 발견사항

1. **테이블 생성 마이그레이션 없음**
   - `students` 및 `parent_users` 테이블 생성 마이그레이션 파일 없음
   - 초기 스키마에 포함되어 있을 가능성

2. **제약조건 변경 이력 없음**
   - `tenant_id` 제약조건 변경 이력 없음
   - 현재 데이터베이스 상태 확인 필요

3. **RLS 정책 의존성**
   - 많은 RLS 정책이 `students.tenant_id`에 의존
   - NULL 값 처리 로직 필요

### 6.2 권장사항

#### 1. 현재 데이터베이스 상태 확인

**작업**:
- `students` 테이블의 `tenant_id` 제약조건 확인
- `parent_users` 테이블의 `tenant_id` 제약조건 확인
- 실제 NULL 값 존재 여부 확인

**SQL 쿼리**:
```sql
-- students 테이블 제약조건 확인
SELECT 
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'students' 
  AND column_name = 'tenant_id';

-- parent_users 테이블 제약조건 확인
SELECT 
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'parent_users' 
  AND column_name = 'tenant_id';
```

#### 2. RLS 정책 검토

**작업**:
- `students.tenant_id`를 사용하는 모든 RLS 정책 확인
- NULL 값 처리 로직 추가 필요 여부 확인

#### 3. 마이그레이션 계획 수립

**작업**:
- `students.tenant_id` nullable 변경 마이그레이션 작성 (필요 시)
- RLS 정책 수정 계획 수립
- 롤백 마이그레이션 작성

---

## 7. 다음 단계

1. **현재 데이터베이스 상태 확인** (마이그레이션 계획 수립 전)
2. **마이그레이션 계획 수립** (필요 시)
3. **RLS 정책 검토 및 수정 계획** (필요 시)
4. **테스트 계획 수립** (필요 시)

---

## 8. 참고 파일

- [students 테이블 분석](students-table-schema-analysis.md)
- [parent_users 테이블 분석](parent-users-table-schema-analysis.md)
- [ERD 문서](timetable/erd-cloud/01_core_tables.sql)
- [마이그레이션 디렉토리](supabase/migrations/)

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX






