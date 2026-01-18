# 테이블 개선 및 정리 - 마이그레이션 상태 점검

**작성 일자**: 2025-02-10  
**목적**: 실제 데이터베이스 스키마와 마이그레이션 파일 간의 불일치 확인 및 정리

---

## 1. 마이그레이션 파일 현황

### 총 마이그레이션 파일 수: 26개

주요 마이그레이션 타임라인:
- `20250131000000_initial_schema.sql` - 초기 스키마
- `20250201000000_add_camp_tables.sql` - 캠프 테이블 추가
- `20250204000000_make_subject_groups_global.sql` - 교과 그룹 전역화
- `20250206000000_remove_subject_type_column.sql` - subject_type 컬럼 제거
- `20250210000000_create_student_career_goals.sql` - 진로 목표 테이블 생성
- `20250210000004_create_student_profiles.sql` - 프로필 테이블 생성
- `20250210000006_refactor_students_table.sql` - students 테이블 리팩토링

---

## 2. 확인된 불일치 사항

### 2.1 subjects 테이블

**문제**: 마이그레이션 파일에는 `code`, `is_active` 필드가 있으나 실제 DB에는 없음

**상태**:
- ✅ `subject_type` 컬럼은 정상적으로 제거됨 (20250206000000)
- ❌ `code` 필드: 마이그레이션에 없음 (초기 스키마에 포함되지 않음)
- ❌ `is_active` 필드: 마이그레이션에 없음 (초기 스키마에 포함되지 않음)

**실제 스키마** (doc/subjects-table-actual-schema.md 기준):
```sql
subjects (
  id uuid PRIMARY KEY,
  subject_group_id uuid NOT NULL,
  name text NOT NULL,
  display_order int4 NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  subject_type_id uuid (nullable)
)
```

**결론**: `code`, `is_active` 필드는 마이그레이션에 포함되지 않았으므로 실제 DB와 일치함. 문제 없음.

---

### 2.2 students 테이블 리팩토링 상태

**마이그레이션**: `20250210000006_refactor_students_table.sql`

**제거된 필드** (student_profiles로 이동):
- ✅ `gender` - 제거됨
- ✅ `phone` - 제거됨
- ✅ `mother_phone` - 제거됨
- ✅ `father_phone` - 제거됨

**제거된 필드** (student_career_goals로 이동):
- ✅ `exam_year` - 제거됨
- ✅ `curriculum_revision` - 제거됨
- ✅ `desired_university_1` - 제거됨
- ✅ `desired_university_2` - 제거됨
- ✅ `desired_university_3` - 제거됨
- ✅ `desired_career_field` - 제거됨 (student_career_field_preferences로 이동)

**변경된 필드**:
- ✅ `school` (text) → `school_id` (uuid FK) - 변경됨
- ✅ `class_number` → `class` - 통일됨

**추가된 필드**:
- ✅ `student_number` - 추가됨
- ✅ `enrolled_at` - 추가됨
- ✅ `status` - 추가됨

**코드 반영 상태**: ✅ 완료
- `lib/data/students.ts` - 새 스키마 반영됨
- `lib/data/studentProfiles.ts` - 프로필 테이블 사용
- `lib/data/studentCareerGoals.ts` - 진로 목표 테이블 사용

---

### 2.3 student_career_goals 테이블

**마이그레이션**: `20250210000000_create_student_career_goals.sql`

**Deprecated 필드**:
- ⚠️ `desired_university_1_id` - deprecated, `desired_university_ids` 배열 사용 권장
- ⚠️ `desired_university_2_id` - deprecated, `desired_university_ids` 배열 사용 권장
- ⚠️ `desired_university_3_id` - deprecated, `desired_university_ids` 배열 사용 권장

**새 필드**:
- ✅ `desired_university_ids` (uuid[]) - 추가됨 (20250210000008)

**상태**: Deprecated 필드가 여전히 코드에서 사용 중 → 제거 필요

---

## 3. 테이블명/필드명 불일치

### 3.1 parent_student_links vs student_parent_links

**ERD 문서**: `student_parent_links`  
**실제 코드**: `parent_student_links` 사용

**확인 필요**: 실제 데이터베이스에서 사용 중인 테이블명 확인

### 3.2 relation vs relationship

**ERD 문서**: `relationship`  
**실제 코드**: `relation` 사용

**확인 필요**: 실제 데이터베이스에서 사용 중인 필드명 확인

---

## 4. 미사용 필드

### 4.1 students 테이블

**ERD에 있으나 미사용** (doc/students-parents-core-tables.md 기준):
- `student_number` - ✅ 이제 사용됨 (마이그레이션으로 활성화)
- `enrolled_at` - ✅ 이제 사용됨 (마이그레이션으로 활성화)
- `address` - ❌ 미사용 (student_profiles로 이동 가능)
- `emergency_contact` - ❌ 미사용 (student_profiles로 이동 가능)
- `medical_info` - ❌ 미사용 (student_profiles로 이동 가능)
- `notes` - ❌ 미사용
- `is_active` - ❌ 미사용

**상태**: 대부분 student_profiles로 이동되었거나, 마이그레이션으로 활성화됨

### 4.2 parent_users 테이블

**ERD에 있으나 미사용**:
- `relationship` - ❌ 미사용
- `occupation` - ❌ 미사용
- `updated_at` - ❌ 미사용

**상태**: 미사용 필드 정리 필요

---

## 5. 인덱스 현황

### 5.1 students 테이블

**마이그레이션에 포함된 인덱스**:
- ✅ `idx_students_school_id` - 생성됨
- ✅ `idx_students_status` - 생성됨
- ✅ `idx_students_grade` - 생성됨

### 5.2 student_profiles 테이블

**마이그레이션에 포함된 인덱스**:
- ✅ `idx_student_profiles_tenant_id` - 생성됨

### 5.3 student_career_goals 테이블

**마이그레이션에 포함된 인덱스**:
- ✅ `idx_student_career_goals_student_id` - 생성됨
- ✅ `idx_student_career_goals_exam_year` - 생성됨
- ✅ `idx_student_career_goals_university_1` - 생성됨
- ✅ `idx_student_career_goals_university_2` - 생성됨
- ✅ `idx_student_career_goals_university_3` - 생성됨

**상태**: 기본 인덱스는 생성됨. 성능 분석 후 추가 인덱스 필요 여부 확인

---

## 6. 다음 단계

### 우선순위 1: Deprecated 필드 제거
- [ ] `student_career_goals`의 `desired_university_1~3_id` 필드 제거
- [ ] 코드에서 `desired_university_ids` 배열만 사용하도록 업데이트

### 우선순위 2: 테이블명/필드명 통일
- [ ] 실제 DB에서 `parent_student_links` vs `student_parent_links` 확인
- [ ] 실제 DB에서 `relation` vs `relationship` 확인
- [ ] 일관성 있게 통일

### 우선순위 3: 미사용 필드 정리
- [ ] `parent_users` 테이블의 미사용 필드 제거 또는 활용 계획 수립
- [ ] 다른 테이블의 미사용 필드 점검

### 우선순위 4: 인덱스 최적화
- [ ] 쿼리 성능 분석
- [ ] 추가 인덱스 필요 여부 확인

---

**마지막 업데이트**: 2025-02-10









