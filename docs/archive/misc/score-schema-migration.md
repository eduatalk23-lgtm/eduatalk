# 성적 스키마 마이그레이션 가이드

## 📋 개요

이 문서는 Supabase DB 스키마를 새로운 구조로 정리한 내용을 설명합니다.

**작업 일자**: 2025-12-01  
**목적**: student_terms 테이블을 중심으로 한 정규화된 성적 관리 구조로 전환

---

## 🗄 새로운 스키마 구조

### 1. student_terms (학생-학기 마스터)

학생의 학년도별 학기 정보를 관리하는 마스터 테이블입니다.

```sql
CREATE TABLE student_terms (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    student_id uuid NOT NULL REFERENCES students(id),
    school_year integer NOT NULL, -- 학년도 (예: 2024)
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3), -- 학년 (1~3)
    semester integer NOT NULL CHECK (semester IN (1, 2)), -- 학기 (1~2)
    curriculum_revision_id uuid NOT NULL REFERENCES curriculum_revisions(id),
    class_name text, -- 반 이름 (예: "1반", "A반")
    homeroom_teacher text, -- 담임교사 이름
    notes text, -- 비고
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, student_id, school_year, grade, semester)
);
```

**주요 특징**:
- 같은 학생의 같은 학년도/학년/학기는 중복 불가 (UNIQUE 제약조건)
- 반 이름, 담임교사 등 학기별 메타데이터 관리 가능
- curriculum_revision_id로 교육과정 개정 정보 연결

### 2. student_internal_scores (내신 성적)

내신 성적 테이블입니다. `student_term_id` FK를 통해 `student_terms`와 연결됩니다.

```sql
CREATE TABLE student_internal_scores (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    student_id uuid NOT NULL REFERENCES students(id),
    student_term_id uuid REFERENCES student_terms(id), -- FK
    curriculum_revision_id uuid NOT NULL REFERENCES curriculum_revisions(id),
    subject_group_id uuid NOT NULL REFERENCES subject_groups(id),
    subject_type_id uuid NOT NULL REFERENCES subject_types(id),
    subject_id uuid NOT NULL REFERENCES subjects(id),
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
    semester integer NOT NULL CHECK (semester IN (1, 2)),
    credit_hours numeric NOT NULL CHECK (credit_hours > 0),
    raw_score numeric,
    avg_score numeric,
    std_dev numeric,
    rank_grade integer CHECK (rank_grade BETWEEN 1 AND 9),
    total_students integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**주요 특징**:
- `student_term_id`를 통해 학기 정보 참조
- `grade`, `semester` 필드는 중복 저장 (조회 성능 향상)
- 교과 위계 테이블(subject_groups, subject_types, subjects)과 FK 연결

### 3. student_mock_scores (모의고사 성적)

모의고사 성적 테이블입니다. `student_term_id` FK를 통해 `student_terms`와 연결됩니다 (nullable).

```sql
CREATE TABLE student_mock_scores (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    student_id uuid NOT NULL REFERENCES students(id),
    student_term_id uuid REFERENCES student_terms(id), -- FK (nullable)
    exam_date date NOT NULL,
    exam_title text NOT NULL,
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
    subject_id uuid NOT NULL REFERENCES subjects(id),
    subject_group_id uuid NOT NULL REFERENCES subject_groups(id),
    standard_score numeric,
    percentile numeric CHECK (percentile BETWEEN 0 AND 100),
    grade_score integer CHECK (grade_score BETWEEN 1 AND 9),
    raw_score numeric,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**주요 특징**:
- `student_term_id`는 nullable (학기 정보를 찾지 못한 경우 NULL 허용)
- `exam_date`를 기준으로 학년도와 학기를 계산하여 `student_term` 연결 시도
- 연결 실패 시에도 성적 저장 가능 (나중에 연결 가능)

---

## 🔄 레거시 테이블 제거

다음 테이블들은 더 이상 사용하지 않습니다:

- ❌ `student_school_scores` → ✅ `student_internal_scores`로 대체
- ❌ `student_scores` (통합 성적 테이블) → ✅ `student_internal_scores` + `student_mock_scores`로 분리
- ❌ `grades` (학년 마스터) → ✅ `student_terms`에 통합
- ❌ `semesters` (학기 마스터) → ✅ `student_terms`에 통합

---

## 📝 코드 변경 사항

### 1. 타입 정의 업데이트

**파일**: `lib/supabase/database.types.ts`

- `student_terms` 타입에 `class_name`, `homeroom_teacher`, `notes` 필드 추가
- `student_mock_scores.student_term_id`를 nullable로 변경

### 2. 데이터 접근 함수

**파일**: `lib/data/studentTerms.ts`

- `getOrCreateStudentTerm()` 함수에 `class_name`, `homeroom_teacher`, `notes` 파라미터 추가

**파일**: `lib/data/studentScores.ts`

- `createInternalScore()`: `student_term_id` 자동 연결
- `createMockScore()`: `student_term_id` 자동 연결 (실패 시 NULL 허용)

**파일**: `lib/domains/score/repository.ts`

- `insertInternalScore()`: `student_term_id` 자동 연결
- `insertMockScore()`: `student_term_id` 자동 연결 (실패 시 NULL 허용)

### 3. 새로운 API

**파일**: `app/actions/scores-internal.ts`

- `createInternalScore()`: 내신 성적 생성 (FormData 기반)
- `createMockScore()`: 모의고사 성적 생성 (FormData 기반)

### 4. 검증 쿼리 예시

**파일**: `lib/data/scoreQueries.ts`

- `getTermScores()`: 한 학기의 내신 + 모의고사 리스트 조회
- `getAllTermScores()`: 학생의 모든 학기 성적 조회

---

## 🚀 사용 예시

### 내신 성적 입력

```typescript
import { createInternalScore } from "@/app/actions/scores-internal";

const formData = new FormData();
formData.append("student_id", studentId);
formData.append("tenant_id", tenantId);
formData.append("school_year", "2024");
formData.append("grade", "1");
formData.append("semester", "1");
formData.append("curriculum_revision_id", curriculumRevisionId);
formData.append("subject_group_id", subjectGroupId);
formData.append("subject_type_id", subjectTypeId);
formData.append("subject_id", subjectId);
formData.append("credit_hours", "3");
formData.append("raw_score", "85");
formData.append("class_name", "1반");
formData.append("homeroom_teacher", "홍길동");

const result = await createInternalScore(formData);
```

### 모의고사 성적 입력

```typescript
import { createMockScore } from "@/app/actions/scores-internal";

const formData = new FormData();
formData.append("student_id", studentId);
formData.append("tenant_id", tenantId);
formData.append("exam_date", "2024-06-15");
formData.append("exam_title", "2024년 6월 모의고사");
formData.append("grade", "1");
formData.append("subject_id", subjectId);
formData.append("subject_group_id", subjectGroupId);
formData.append("curriculum_revision_id", curriculumRevisionId);
formData.append("raw_score", "90");
formData.append("standard_score", "135");
formData.append("percentile", "85");

const result = await createMockScore(formData);
```

### 한 학기의 성적 조회

```typescript
import { getTermScores } from "@/lib/data/scoreQueries";

const { term, internalScores, mockScores } = await getTermScores(
  studentId,
  tenantId,
  2024, // school_year
  1,    // grade
  1     // semester
);

console.log("학기 정보:", term);
console.log("내신 성적:", internalScores);
console.log("모의고사 성적:", mockScores);
```

---

## ⚠️ 주의사항

### 1. 기존 데이터 마이그레이션

기존 데이터가 있는 경우, 다음 단계로 마이그레이션해야 합니다:

1. `student_internal_scores`의 기존 데이터를 기반으로 `student_terms` 생성
2. 생성된 `student_term_id`를 `student_internal_scores`에 업데이트
3. `student_mock_scores`의 기존 데이터를 기반으로 `student_terms` 생성 (없는 경우)
4. 생성된 `student_term_id`를 `student_mock_scores`에 업데이트

마이그레이션 스크립트는 별도로 작성해야 합니다.

### 2. 레거시 코드

다음 파일들은 레거시 테이블을 참조하므로, 새 구조로 교체가 필요합니다:

- `app/(student)/scores/dashboard/_utils.ts` - `student_scores` 테이블 사용
- `app/(student)/analysis/_utils.ts` - `student_scores` 테이블 사용
- `app/api/admin/check-student-scores/route.ts` - `student_school_scores` 테이블 사용
- `app/actions/scores.ts` - `student_scores` 테이블 사용 (이미 deprecated 표시)

### 3. student_term_id NULL 처리

모의고사 성적의 경우, `student_term_id`가 NULL일 수 있습니다. 이는 다음 경우에 발생합니다:

- `exam_date`를 기준으로 학년도/학기를 계산했지만, 해당 학기의 `student_term`이 없는 경우
- `curriculum_revision_id`가 없어서 `student_term`을 생성할 수 없는 경우

이 경우에도 성적은 저장되며, 나중에 수동으로 `student_term_id`를 연결할 수 있습니다.

---

## 📚 참고 자료

- 마이그레이션 파일: `supabase/migrations/20251201000000_add_student_terms_and_fks.sql`
- 타입 정의: `lib/supabase/database.types.ts`
- 데이터 접근 함수: `lib/data/studentTerms.ts`, `lib/data/studentScores.ts`
- 도메인 레포지토리: `lib/domains/score/repository.ts`
- 검증 쿼리: `lib/data/scoreQueries.ts`

---

**마지막 업데이트**: 2025-12-01

