# 인덱스 최적화 분석

**작성 일자**: 2025-02-10  
**목적**: 자주 조회되는 필드에 대한 인덱스 현황 확인 및 최적화 계획 수립

---

## 1. 현재 인덱스 현황

### students 테이블

**마이그레이션에 포함된 인덱스** (`20250210000006_refactor_students_table.sql`):
- ✅ `idx_students_school_id` - `school_id` 필드
- ✅ `idx_students_status` - `status` 필드
- ✅ `idx_students_grade` - `grade` 필드

**추가 고려 사항**:
- `tenant_id` - 멀티테넌트 조회에 사용되나 deprecated 상태
- `id` - PK이므로 자동 인덱스 생성됨

### student_profiles 테이블

**마이그레이션에 포함된 인덱스** (`20250210000004_create_student_profiles.sql`):
- ✅ `idx_student_profiles_tenant_id` - `tenant_id` 필드

**추가 고려 사항**:
- `id` - PK이므로 자동 인덱스 생성됨

### student_career_goals 테이블

**마이그레이션에 포함된 인덱스** (`20250210000000_create_student_career_goals.sql`):
- ✅ `idx_student_career_goals_student_id` - `student_id` 필드
- ✅ `idx_student_career_goals_exam_year` - `exam_year` 필드
- ✅ `idx_student_career_goals_university_1` - `desired_university_1_id` 필드 (deprecated)
- ✅ `idx_student_career_goals_university_2` - `desired_university_2_id` 필드 (deprecated)
- ✅ `idx_student_career_goals_university_3` - `desired_university_3_id` 필드 (deprecated)

**추가 인덱스** (`20250210000008_add_desired_university_ids_array.sql`):
- ✅ `idx_student_career_goals_university_ids` - `desired_university_ids` 배열 (GIN 인덱스)

**제거 예정 인덱스**:
- ❌ `idx_student_career_goals_university_1` - deprecated 필드 제거 시 함께 제거
- ❌ `idx_student_career_goals_university_2` - deprecated 필드 제거 시 함께 제거
- ❌ `idx_student_career_goals_university_3` - deprecated 필드 제거 시 함께 제거

---

## 2. 쿼리 패턴 분석

### 자주 조회되는 필드

**students 테이블**:
- `id` - PK, 자동 인덱스 ✅
- `school_id` - 학교별 학생 조회, 인덱스 존재 ✅
- `grade` - 학년별 학생 조회, 인덱스 존재 ✅
- `status` - 상태별 학생 조회, 인덱스 존재 ✅
- `tenant_id` - deprecated, 인덱스 불필요

**student_profiles 테이블**:
- `id` - PK, 자동 인덱스 ✅
- `tenant_id` - 멀티테넌트 조회, 인덱스 존재 ✅

**student_career_goals 테이블**:
- `student_id` - 학생별 진로 목표 조회, 인덱스 존재 ✅
- `exam_year` - 입시년도별 조회, 인덱스 존재 ✅
- `desired_university_ids` - 대학교별 조회, GIN 인덱스 존재 ✅

### JOIN 패턴

**자주 사용되는 JOIN**:
1. `students` ↔ `student_profiles` (1:1, `id` 기준)
2. `students` ↔ `student_career_goals` (1:1, `student_id` 기준)
3. `students` ↔ `schools` (FK, `school_id` 기준)
4. `student_career_goals` ↔ `schools` (FK, `desired_university_ids` 배열)

**인덱스 상태**:
- ✅ 모든 FK 필드에 인덱스 존재
- ✅ JOIN에 사용되는 필드에 인덱스 존재

---

## 3. 추가 인덱스 필요성 분석

### 복합 인덱스 고려 사항

**students 테이블**:
- `(school_id, grade)` - 학교별 학년별 조회
- `(school_id, status)` - 학교별 상태별 조회

**현재 상태**: 단일 인덱스만 존재, 복합 인덱스는 쿼리 패턴 분석 후 추가 고려

### 성능 최적화

**현재 상태**: 기본 인덱스는 모두 생성됨

**추가 최적화 필요 여부**:
- 쿼리 성능 모니터링 후 결정
- 실제 사용 패턴 분석 필요

---

## 4. 인덱스 정리 계획

### 제거 예정 인덱스

**student_career_goals 테이블**:
- `idx_student_career_goals_university_1` - deprecated 필드 제거 시 함께 제거
- `idx_student_career_goals_university_2` - deprecated 필드 제거 시 함께 제거
- `idx_student_career_goals_university_3` - deprecated 필드 제거 시 함께 제거

**마이그레이션**: `20250210000009_remove_deprecated_university_fields.sql`에 포함됨

### 추가 인덱스 (필요 시)

**복합 인덱스 추가 고려**:
```sql
-- students 테이블 복합 인덱스 (쿼리 패턴 분석 후 추가)
CREATE INDEX IF NOT EXISTS idx_students_school_grade 
ON students(school_id, grade);

CREATE INDEX IF NOT EXISTS idx_students_school_status 
ON students(school_id, status);
```

**현재 상태**: 기본 인덱스는 충분하며, 복합 인덱스는 성능 모니터링 후 추가

---

## 5. 권장 사항

### 현재 상태 평가

**✅ 양호**: 기본 인덱스는 모두 생성됨

**⚠️ 개선 필요**:
- Deprecated 필드 인덱스 제거 (마이그레이션 예정)
- 복합 인덱스는 쿼리 패턴 분석 후 추가

### 성능 모니터링

**권장 사항**:
1. 쿼리 성능 모니터링
2. 자주 사용되는 쿼리 패턴 분석
3. 필요 시 복합 인덱스 추가

---

## 6. 실행 계획

### Phase 1: Deprecated 인덱스 제거

1. [x] 마이그레이션 파일 생성 (`20250210000009_remove_deprecated_university_fields.sql`)
2. [ ] 마이그레이션 실행
3. [ ] 인덱스 제거 확인

### Phase 2: 성능 모니터링

1. [ ] 쿼리 성능 모니터링
2. [ ] 자주 사용되는 쿼리 패턴 분석
3. [ ] 복합 인덱스 필요 여부 결정

### Phase 3: 추가 인덱스 생성 (필요 시)

1. [ ] 복합 인덱스 생성 마이그레이션 작성
2. [ ] 마이그레이션 실행
3. [ ] 성능 개선 확인

---

**마지막 업데이트**: 2025-02-10









