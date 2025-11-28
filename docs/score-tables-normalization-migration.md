# 성적 테이블 정규화 마이그레이션 가이드

## 📋 개요

2025-11-30에 성적 관련 테이블을 정규화 버전으로 마이그레이션했습니다.

### 변경 사항 요약

1. **테이블명 변경**: `student_school_scores` → `student_internal_scores`
2. **모의고사 테이블 구조 정규화**: `student_mock_scores` 필드 구조 변경
3. **필드명 정규화**: `subject_average` → `avg_score`, `standard_deviation` → `std_dev`
4. **교육과정 개정 ID 추가**: 내신 성적에 `curriculum_revision_id` 필드 추가

---

## 🗄 데이터베이스 스키마 변경

### 1. 내신 성적 테이블 (student_internal_scores)

#### 새 스키마

```sql
CREATE TABLE public.student_internal_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    student_id uuid NOT NULL REFERENCES public.students(id),
    curriculum_revision_id uuid NOT NULL REFERENCES public.curriculum_revisions(id),
    subject_group_id uuid NOT NULL REFERENCES public.subject_groups(id),
    subject_type_id uuid NOT NULL REFERENCES public.subject_types(id),
    subject_id uuid NOT NULL REFERENCES public.subjects(id),
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
    semester integer NOT NULL CHECK (semester IN (1, 2)),
    credit_hours numeric NOT NULL CHECK (credit_hours > 0),
    raw_score numeric,
    avg_score numeric,              -- 변경: subject_average → avg_score
    std_dev numeric,                -- 변경: standard_deviation → std_dev
    rank_grade integer CHECK (rank_grade BETWEEN 1 AND 9),
    total_students integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- UNIQUE 제약 조건
ALTER TABLE public.student_internal_scores
ADD CONSTRAINT student_internal_scores_unique_term_subject
UNIQUE (tenant_id, student_id, grade, semester, subject_id);
```

#### 주요 변경 사항

- ✅ `curriculum_revision_id` 필드 추가 (필수)
- ✅ `subject_average` → `avg_score` (필드명 변경)
- ✅ `standard_deviation` → `std_dev` (필드명 변경)
- ✅ `grade_score` 필드 제거 (rank_grade만 사용)
- ✅ 모든 FK 필드가 NOT NULL (정규화 완료)

---

### 2. 모의고사 성적 테이블 (student_mock_scores)

#### 새 스키마

```sql
CREATE TABLE public.student_mock_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    student_id uuid NOT NULL REFERENCES public.students(id),
    exam_date date NOT NULL,        -- 추가: 시험일 필드
    exam_title text NOT NULL,        -- 변경: exam_type → exam_title
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
    subject_id uuid NOT NULL REFERENCES public.subjects(id),
    subject_group_id uuid NOT NULL REFERENCES public.subject_groups(id),
    standard_score numeric,
    percentile numeric CHECK (percentile BETWEEN 0 AND 100),
    grade_score integer CHECK (grade_score BETWEEN 1 AND 9),
    raw_score numeric,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- UNIQUE 제약 조건
ALTER TABLE public.student_mock_scores
ADD CONSTRAINT student_mock_scores_unique_exam_subject
UNIQUE (tenant_id, student_id, exam_date, exam_title, subject_id);
```

#### 주요 변경 사항

- ✅ `exam_type` → `exam_title` (필드명 변경, text 타입)
- ✅ `exam_date` 필드 추가 (필수)
- ✅ `exam_round` 필드 제거
- ✅ `subject_type_id` 필드 제거 (모의고사에는 불필요)
- ✅ 모든 FK 필드가 NOT NULL (정규화 완료)

---

## 📦 마이그레이션 파일

### 새 마이그레이션

- **`20251130000000_create_normalized_score_tables.sql`**
  - 정규화된 성적 테이블 생성
  - UNIQUE 제약 조건 및 인덱스 생성

### 레거시 마이그레이션 (deprecated)

다음 마이그레이션 파일들은 레거시 테이블(`student_school_scores`)을 대상으로 하며, 새 프로젝트에서는 사용하지 않습니다:

- `20250211000000_add_score_subject_fks.sql` ⚠️ DEPRECATED
- `20250211000001_migrate_score_text_to_fks.sql` ⚠️ DEPRECATED
- `20251125201056_remove_test_date_from_score_tables.sql` ⚠️ DEPRECATED

---

## 🔧 코드 변경 사항

### 타입 정의

#### lib/supabase/database.types.ts

- ✅ `student_internal_scores` 타입 추가
- ✅ `student_mock_scores` 타입 구조 수정
- ⚠️ `student_school_scores` 타입은 레거시로 유지 (하위 호환성)

#### lib/domains/score/types.ts

**새 타입:**
- `InternalScore` - 내신 성적 (정규화 버전)
- `InternalScoreInsert` - 내신 성적 생성 입력
- `InternalScoreUpdate` - 내신 성적 수정 입력
- `CreateInternalScoreInput` - 내신 성적 생성 입력 (서비스용)
- `UpdateInternalScoreInput` - 내신 성적 수정 입력 (서비스용)

**레거시 타입 (deprecated):**
- `SchoolScore` - ⚠️ `InternalScore` 사용 권장
- `CreateSchoolScoreInput` - ⚠️ `CreateInternalScoreInput` 사용 권장

**모의고사 타입 변경:**
- `CreateMockScoreInput` - `exam_type` → `exam_title`, `exam_date` 추가, `exam_round` 제거
- `GetMockScoresFilter` - `examType` → `examTitle`, `examDate` 추가, `examRound` 제거

---

### 서비스 레이어

#### lib/data/studentScores.ts

**새 함수:**
- `getInternalScores()` - 내신 성적 조회 (정규화 버전)
- `createInternalScore()` - 내신 성적 생성 (정규화 버전)

**레거시 함수 (deprecated):**
- `getSchoolScores()` - ⚠️ `getInternalScores()` 사용 권장
- `createSchoolScore()` - ⚠️ `createInternalScore()` 사용 권장

**수정된 함수:**
- `getMockScores()` - 필터 파라미터 변경 (`examType` → `examTitle`, `examDate` 추가)
- `createMockScore()` - 입력 파라미터 변경 (`exam_type` → `exam_title`, `exam_date` 추가)

#### lib/domains/score/repository.ts

**새 함수:**
- `findInternalScores()` - 내신 성적 조회 (정규화 버전)
- `insertInternalScore()` - 내신 성적 생성 (정규화 버전)

**레거시 함수 (deprecated):**
- `findSchoolScores()` - ⚠️ `findInternalScores()` 사용 권장
- `insertSchoolScore()` - ⚠️ `insertInternalScore()` 사용 권장

**수정된 함수:**
- `findMockScores()` - 필터 파라미터 변경
- `insertMockScore()` - 입력 파라미터 변경

#### app/(student)/scores/dashboard/_utils/scoreQueries.ts

- ✅ `fetchSchoolScores()` - `student_internal_scores` 테이블 사용
- ✅ `fetchMockScores()` - 정규화된 `student_mock_scores` 테이블 사용

---

## 🔄 마이그레이션 가이드

### 기존 데이터 마이그레이션

기존 `student_school_scores` 데이터를 `student_internal_scores`로 마이그레이션하려면:

1. **데이터 변환 스크립트 작성 필요**
   - `subject_average` → `avg_score`
   - `standard_deviation` → `std_dev`
   - `curriculum_revision_id` 값 설정 (학생의 교육과정 기준)

2. **모의고사 데이터 마이그레이션**
   - `exam_type` → `exam_title`
   - `exam_round` → `exam_date` (날짜 파싱 필요)
   - `subject_type_id` 제거

### 새 코드 작성 시

```typescript
// ✅ 올바른 예: 새 정규화 버전 사용
import { getInternalScores, createInternalScore } from "@/lib/data/studentScores";

const scores = await getInternalScores(studentId, tenantId, {
  grade: 1,
  semester: 1,
});

await createInternalScore({
  tenant_id: tenantId,
  student_id: studentId,
  curriculum_revision_id: curriculumId,
  subject_group_id: subjectGroupId,
  subject_type_id: subjectTypeId,
  subject_id: subjectId,
  grade: 1,
  semester: 1,
  credit_hours: 3,
  raw_score: 85,
  avg_score: 80,
  std_dev: 10,
});

// ❌ 레거시 코드 (deprecated)
import { getSchoolScores } from "@/lib/data/studentScores";
const scores = await getSchoolScores(studentId); // 사용하지 마세요
```

---

## ✅ 검증 기준

### 1. 마이그레이션 검증

- [x] 새 마이그레이션 파일이 제공된 DDL과 일치하는가?
- [x] UNIQUE 제약 조건이 올바르게 설정되었는가?
- [x] 인덱스가 올바르게 생성되었는가?

### 2. 코드 검증

- [x] `student_school_scores` 참조가 모두 deprecated 처리되었는가?
- [x] 새 함수들이 `student_internal_scores`를 사용하는가?
- [x] 타입 정의가 DB 스키마와 일치하는가?

### 3. 레거시 정리

- [x] 기존 마이그레이션 파일에 deprecated 경고가 추가되었는가?
- [x] 레거시 타입/함수가 deprecated로 표시되었는가?

---

## 📝 참고 사항

### 하위 호환성

레거시 타입과 함수는 하위 호환성을 위해 유지되지만, 새 코드에서는 사용하지 않는 것을 권장합니다.

### 데이터 마이그레이션

기존 데이터를 새 테이블로 마이그레이션하는 스크립트는 별도로 작성해야 합니다.

### RLS 정책

새 테이블에도 기존과 동일한 RLS 정책을 적용해야 합니다.

---

**작성일**: 2025-11-30  
**작성자**: AI Assistant  
**버전**: 1.0

