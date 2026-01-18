# Student Terms 마이그레이션 작업 문서

## 📋 작업 개요

Supabase DB 스키마를 기준으로 성적 테이블 구조를 정규화하고, `student_terms` 테이블을 도입하여 학기 정보를 중앙 관리하도록 개선했습니다.

## 🎯 변경 사항

### 1. student_terms 테이블 추가

**목적**: 학생의 학년도별 학기 정보를 중앙에서 관리하여 중복 제거 및 데이터 정규화

**구조**:
```sql
CREATE TABLE student_terms (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    student_id uuid NOT NULL,
    school_year integer NOT NULL, -- 학년도 (예: 2024)
    grade integer NOT NULL, -- 학년 (1~3)
    semester integer NOT NULL, -- 학기 (1~2)
    curriculum_revision_id uuid NOT NULL,
    created_at timestamptz,
    updated_at timestamptz,
    UNIQUE (tenant_id, student_id, school_year, grade, semester)
);
```

### 2. student_internal_scores에 student_term_id FK 추가

**변경 전**:
- `grade`, `semester` 필드가 직접 저장됨
- 학기 정보가 중복 저장됨

**변경 후**:
- `student_term_id` FK 추가 (→ `student_terms.id`)
- `grade`, `semester`는 `student_terms`에서 참조
- 학기 정보 중복 제거

### 3. student_mock_scores에 student_term_id FK 추가

**변경 전**:
- `grade` 필드만 저장됨
- 학기 정보가 없음

**변경 후**:
- `student_term_id` FK 추가 (→ `student_terms.id`)
- `grade`, `semester`는 `student_terms`에서 참조
- 학기 정보 추가

## 📁 변경된 파일

### 타입 정의
- `lib/supabase/database.types.ts`
  - `student_terms` 테이블 타입 추가
  - `student_internal_scores`에 `student_term_id` 필드 추가
  - `student_mock_scores`에 `student_term_id` 필드 추가

### 마이그레이션 파일
- `supabase/migrations/20251201000000_add_student_terms_and_fks.sql`
  - `student_terms` 테이블 생성
  - `student_internal_scores`에 `student_term_id` 컬럼 추가
  - `student_mock_scores`에 `student_term_id` 컬럼 추가

### 유틸리티 함수
- `lib/data/studentTerms.ts` (신규)
  - `getOrCreateStudentTerm()`: student_term 조회 또는 생성
  - `getStudentTerm()`: student_term 조회
  - `getStudentTerms()`: 학생의 모든 student_terms 조회
  - `calculateSchoolYear()`: 학년도 계산 헬퍼

### 서비스 로직
- `lib/data/studentScores.ts`
  - `createInternalScore()`: student_term 조회/생성 후 student_term_id 세팅
  - `createMockScore()`: student_term 조회/생성 후 student_term_id 세팅

- `lib/domains/score/repository.ts`
  - `insertInternalScore()`: student_term 조회/생성 후 student_term_id 세팅
  - `insertMockScore()`: student_term 조회/생성 후 student_term_id 세팅

- `lib/domains/score/types.ts`
  - `CreateMockScoreInput`에 `curriculum_revision_id` 필드 추가

### 레거시 코드 주석
- `app/actions/scores.ts`
  - 레거시 `student_scores` 테이블 사용에 대한 deprecation 주석 추가

## 🔄 데이터 흐름

### 내신 성적 생성 흐름

```
1. createInternalScore() 호출
   ↓
2. school_year 계산 (없으면 현재 날짜 기준)
   ↓
3. getOrCreateStudentTerm() 호출
   - 기존 student_term 조회
   - 없으면 새로 생성
   ↓
4. student_term_id 획득
   ↓
5. student_internal_scores에 INSERT
   - student_term_id 포함
```

### 모의고사 성적 생성 흐름

```
1. createMockScore() 호출
   ↓
2. exam_date 기준으로 school_year 계산
   ↓
3. exam_date 기준으로 semester 추정 (3~8월 = 1학기, 9~2월 = 2학기)
   ↓
4. getOrCreateStudentTerm() 호출
   - 기존 student_term 조회
   - 없으면 새로 생성
   ↓
5. student_term_id 획득
   ↓
6. student_mock_scores에 INSERT
   - student_term_id 포함
```

## 📝 주요 함수 설명

### getOrCreateStudentTerm()

**목적**: 주어진 조건에 맞는 student_term이 있으면 반환하고, 없으면 새로 생성

**파라미터**:
- `tenant_id`: 테넌트 ID
- `student_id`: 학생 ID
- `school_year`: 학년도 (예: 2024)
- `grade`: 학년 (1~3)
- `semester`: 학기 (1~2)
- `curriculum_revision_id`: 교육과정 개정 ID

**반환값**: `student_term_id` (string)

**특징**:
- UNIQUE 제약조건으로 중복 생성 방지
- 트랜잭션 안전성 보장

### calculateSchoolYear()

**목적**: 현재 날짜를 기준으로 학년도를 계산

**로직**:
- 3월~12월: 해당 연도
- 1월~2월: 전년도

**예시**:
- 2024년 3월 → 2024
- 2024년 1월 → 2023

## ⚠️ 주의사항

### 기존 데이터 마이그레이션

현재 마이그레이션 파일은 새 구조만 생성하며, 기존 데이터 마이그레이션은 별도로 수행해야 합니다.

**필요한 작업**:
1. `student_internal_scores`의 기존 데이터를 기반으로 `student_terms` 생성
2. 생성된 `student_term_id`를 `student_internal_scores`에 업데이트
3. `student_mock_scores`의 기존 데이터를 기반으로 `student_terms` 생성 (없는 경우)
4. 생성된 `student_term_id`를 `student_mock_scores`에 업데이트

**마이그레이션 스크립트 예시** (참고용):
```sql
-- student_internal_scores 기반으로 student_terms 생성
INSERT INTO public.student_terms (tenant_id, student_id, school_year, grade, semester, curriculum_revision_id)
SELECT DISTINCT
    tenant_id,
    student_id,
    EXTRACT(YEAR FROM created_at)::integer as school_year,
    grade,
    semester,
    curriculum_revision_id
FROM public.student_internal_scores
ON CONFLICT (tenant_id, student_id, school_year, grade, semester) DO NOTHING;

-- student_internal_scores에 student_term_id 업데이트
UPDATE public.student_internal_scores sis
SET student_term_id = st.id
FROM public.student_terms st
WHERE sis.tenant_id = st.tenant_id
  AND sis.student_id = st.student_id
  AND sis.grade = st.grade
  AND sis.semester = st.semester
  AND sis.curriculum_revision_id = st.curriculum_revision_id
  AND sis.student_term_id IS NULL;
```

### 레거시 테이블 참조

다음 파일들은 아직 레거시 테이블(`student_scores`, `student_school_scores`)을 참조합니다:
- `app/actions/scores.ts` - 레거시 `student_scores` 사용
- 기타 여러 파일들 (스크립트, 리포트 등)

이 파일들은 점진적으로 새 구조로 마이그레이션해야 합니다.

## ✅ 체크리스트

- [x] `student_terms` 테이블 타입 정의 추가
- [x] `student_internal_scores`에 `student_term_id` FK 추가
- [x] `student_mock_scores`에 `student_term_id` FK 추가
- [x] 마이그레이션 파일 생성
- [x] `student_terms` 조회/생성 유틸리티 함수 작성
- [x] 내신 성적 생성 로직에 `student_term_id` 세팅 추가
- [x] 모의고사 성적 생성 로직에 `student_term_id` 세팅 추가
- [x] 레거시 코드에 deprecation 주석 추가
- [ ] 기존 데이터 마이그레이션 스크립트 작성 (별도 작업)
- [ ] 레거시 테이블 참조 코드 교체 (별도 작업)

## 📚 참고 자료

- `supabase/migrations/20251201000000_add_student_terms_and_fks.sql` - 마이그레이션 파일
- `lib/data/studentTerms.ts` - student_terms 유틸리티 함수
- `lib/data/studentScores.ts` - 성적 생성 함수 (student_term_id 세팅 포함)
- `lib/domains/score/repository.ts` - 성적 Repository (student_term_id 세팅 포함)

