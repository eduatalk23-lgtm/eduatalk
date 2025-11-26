# 성적 입력 폼 가이드

## 📋 개요

이 문서는 TimeLevelUp 시스템에서 내신 성적과 모의고사 성적을 입력하는 방법을 안내합니다.

---

## 1. 교과 위계 테이블 활용

### 1.1 데이터 구조

성적 입력 폼은 다음 테이블과 정규화된 관계를 가집니다:

```
curriculum_revisions (개정교육과정)
  └─▶ subject_groups (교과)
        └─▶ subjects (과목)
              └─▶ subject_types (과목구분) via subject_type_id
```

### 1.2 데이터 흐름

1. **개정교육과정 선택**: 활성화된 개정교육과정이 자동으로 선택됩니다.
2. **교과 선택**: 해당 개정교육과정의 교과 목록이 표시됩니다.
3. **과목 선택**: 선택한 교과에 속한 과목 목록이 필터링되어 표시됩니다.
4. **과목구분 자동 설정**: 선택한 과목의 `subject_type_id`가 자동으로 설정됩니다 (수정 가능).

---

## 2. 내신 성적 입력

### 2.1 입력 경로

**URL**: `/scores/school/[grade]/[semester]`

예시:
- `/scores/school/1/1` - 1학년 1학기
- `/scores/school/2/2` - 2학년 2학기

### 2.2 필수 필드

| 필드명 | 설명 | 비고 |
|--------|------|------|
| 교과 | 교과 그룹 선택 | 드롭다운 (subject_groups 테이블) |
| 과목 | 과목 선택 | 드롭다운 (선택한 교과의 subjects 테이블) |
| 과목구분 | 과목구분 선택 | 드롭다운 (선택한 과목의 subject_type_id 자동 설정, 수정 가능) |
| 학점수 | 학점수 입력 | 숫자 (예: 4, 5) |
| 원점수 | 원점수 입력 | 숫자 (0 이상) |
| 성취도 | 성취도 등급 | 드롭다운 (A~E, 1~9등급) |

### 2.3 선택 필드

| 필드명 | 설명 | 비고 |
|--------|------|------|
| 과목평균 | 과목 평균 점수 | 숫자 |
| 표준편차 | 표준편차 | 숫자 |
| 수강자수 | 수강자 수 | 숫자 |
| 석차등급 | 석차 등급 | 숫자 (1~9) |

### 2.4 입력 프로세스

1. **교과 선택**
   - 드롭다운에서 교과 선택
   - 선택 시 해당 교과의 첫 번째 과목이 자동 선택됨
   - 해당 과목의 과목구분이 자동 설정됨

2. **과목 선택**
   - 선택한 교과의 과목 목록만 표시됨
   - 과목 선택 시 해당 과목의 과목구분이 자동 설정됨

3. **과목구분 수정** (선택사항)
   - 자동 설정된 과목구분을 수정할 수 있음
   - 해당 개정교육과정의 과목구분 목록에서 선택

4. **성적 정보 입력**
   - 필수 필드 입력
   - 선택 필드 입력 (선택사항)

5. **저장**
   - "전체 저장" 버튼 클릭
   - 필수 필드가 모두 입력된 행만 저장됨

### 2.5 데이터 저장 구조

**FK 필드 (우선 사용)**:
- `subject_group_id`: 교과 그룹 ID
- `subject_id`: 과목 ID
- `subject_type_id`: 과목구분 ID

**하위 호환성 필드 (deprecated)**:
- `subject_group`: 교과 이름 (텍스트)
- `subject_name`: 과목 이름 (텍스트)
- `subject_type`: 과목구분 이름 (텍스트)

---

## 3. 모의고사 성적 입력

### 3.1 입력 경로

**URL**: `/scores/mock/[grade]/[month]/[exam-type]`

예시:
- `/scores/mock/1/3/평가원` - 1학년 3월 평가원 모의고사
- `/scores/mock/2/6/교육청` - 2학년 6월 교육청 모의고사

### 3.2 필수 필드

| 필드명 | 설명 | 비고 |
|--------|------|------|
| 교과 | 교과 그룹 선택 | 드롭다운 (subject_groups 테이블) |
| 과목 | 과목 선택 | 드롭다운 (선택한 교과의 subjects 테이블) |
| 등급 | 등급 입력 | 숫자 (1~9, 1등급이 최고) |
| 표준점수 | 표준점수 입력 | 숫자 (영어/한국사 제외) |
| 백분위 | 백분위 입력 | 숫자 (0~100, 영어/한국사 제외) |

### 3.3 특수 규칙

#### 영어/한국사 과목

- **표준점수**: 입력 불가 (비활성화)
- **백분위**: 입력 불가 (비활성화)
- **등급**: 필수 입력

#### 기타 과목

- **표준점수**: 필수 입력
- **백분위**: 필수 입력
- **등급**: 필수 입력

### 3.4 입력 프로세스

1. **교과 선택**
   - 드롭다운에서 교과 선택
   - 선택 시 해당 교과의 첫 번째 과목이 자동 선택됨
   - 해당 과목의 과목구분이 자동 설정됨

2. **과목 선택**
   - 선택한 교과의 과목 목록만 표시됨
   - 과목 선택 시 해당 과목의 과목구분이 자동 설정됨

3. **성적 정보 입력**
   - 등급 입력 (필수)
   - 표준점수/백분위 입력 (영어/한국사 제외, 필수)
   - 영어/한국사는 등급만 입력

4. **저장**
   - "전체 저장" 버튼 클릭
   - 필수 필드가 모두 입력된 행만 저장됨

### 3.5 데이터 저장 구조

**FK 필드 (우선 사용)**:
- `subject_group_id`: 교과 그룹 ID
- `subject_id`: 과목 ID
- `subject_type_id`: 과목구분 ID (nullable)

**하위 호환성 필드 (deprecated)**:
- `subject_group`: 교과 이름 (텍스트)
- `subject_name`: 과목 이름 (텍스트)

**자동 설정 필드**:
- `exam_round`: 회차 (월) - 탭의 월 값으로 자동 설정
- `test_date`: 시험일 - 현재 날짜로 자동 설정

---

## 4. 데이터 마이그레이션

### 4.1 마이그레이션 전략

기존 텍스트 필드(`subject_group`, `subject_type`, `subject_name`)를 FK 필드로 변환하는 과정입니다.

**단계**:
1. 새 FK 컬럼 추가 (nullable)
2. 기존 텍스트 데이터를 FK로 변환
3. 데이터 검증 및 수동 보정
4. NOT NULL 제약조건 추가 (선택사항)
5. 기존 텍스트 컬럼 제거 (향후)

### 4.2 마이그레이션 스크립트

**파일**: `supabase/migrations/20250211000001_migrate_score_text_to_fks.sql`

**실행 방법**:
```bash
# Supabase CLI 사용
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
```

### 4.3 마이그레이션 검증

마이그레이션 후 다음 쿼리로 결과를 확인할 수 있습니다:

```sql
-- 내신 성적 마이그레이션 결과 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(subject_group_id) as migrated_subject_group,
  COUNT(subject_id) as migrated_subject,
  COUNT(subject_type_id) as migrated_subject_type,
  COUNT(CASE WHEN subject_group IS NOT NULL AND subject_group_id IS NULL THEN 1 END) as failed_subject_group,
  COUNT(CASE WHEN subject_name IS NOT NULL AND subject_id IS NULL THEN 1 END) as failed_subject,
  COUNT(CASE WHEN subject_type IS NOT NULL AND subject_type_id IS NULL THEN 1 END) as failed_subject_type
FROM student_school_scores;

-- 모의고사 성적 마이그레이션 결과 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(subject_group_id) as migrated_subject_group,
  COUNT(subject_id) as migrated_subject,
  COUNT(subject_type_id) as migrated_subject_type,
  COUNT(CASE WHEN subject_group IS NOT NULL AND subject_group_id IS NULL THEN 1 END) as failed_subject_group,
  COUNT(CASE WHEN subject_name IS NOT NULL AND subject_id IS NULL THEN 1 END) as failed_subject
FROM student_mock_scores;
```

### 4.4 수동 보정

마이그레이션 실패 데이터는 수동으로 보정해야 합니다:

```sql
-- 내신 성적: subject_group_id 마이그레이션 실패한 데이터
SELECT DISTINCT subject_group
FROM student_school_scores
WHERE subject_group IS NOT NULL 
  AND subject_group_id IS NULL
ORDER BY subject_group;

-- 내신 성적: subject_id 마이그레이션 실패한 데이터
SELECT DISTINCT subject_group, subject_name
FROM student_school_scores
WHERE subject_name IS NOT NULL 
  AND subject_id IS NULL
ORDER BY subject_group, subject_name;
```

---

## 5. 하위 호환성

### 5.1 텍스트 필드 유지

마이그레이션 기간 동안 기존 텍스트 필드는 deprecated로 표시되지만, 하위 호환성을 위해 유지됩니다.

**Deprecated 필드**:
- `subject_group` (text)
- `subject_type` (text)
- `subject_name` (text)

### 5.2 데이터 저장 우선순위

1. **FK 필드 우선**: `subject_group_id`, `subject_id`, `subject_type_id`가 있으면 우선 사용
2. **텍스트 필드 fallback**: FK 필드가 없으면 텍스트 필드 사용

### 5.3 코드에서의 처리

```typescript
// Server Actions 예시
const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
const subjectGroup = String(formData.get("subject_group") ?? "").trim();

// FK 우선, 없으면 텍스트 필드 사용
if (!subjectGroupId && !subjectGroup) {
  throw new Error("교과를 선택해주세요.");
}
```

---

## 6. 문제 해결

### 6.1 교과/과목이 표시되지 않는 경우

**원인**: 개정교육과정이 활성화되지 않았거나, 해당 개정교육과정에 교과/과목 데이터가 없는 경우

**해결 방법**:
1. Supabase Dashboard에서 `curriculum_revisions` 테이블 확인
2. `is_active = true`인 개정교육과정 확인
3. 해당 개정교육과정에 교과/과목 데이터가 있는지 확인

### 6.2 과목구분이 자동 설정되지 않는 경우

**원인**: 선택한 과목에 `subject_type_id`가 설정되지 않은 경우

**해결 방법**:
1. 수동으로 과목구분 선택
2. 또는 `subjects` 테이블에서 해당 과목의 `subject_type_id` 설정

### 6.3 저장 시 오류 발생

**원인**: 필수 필드 누락 또는 데이터 유효성 검증 실패

**해결 방법**:
1. 필수 필드가 모두 입력되었는지 확인
2. 숫자 필드의 유효성 확인 (범위, 형식)
3. 브라우저 콘솔에서 오류 메시지 확인

---

## 7. 참고 자료

- [성적 유형 분석](./score-types-analysis.md)
- [교과 위계 구조 분석](./과목구분-위계-구조-분석.md)
- [교육과정-교과-과목-테이블-연결-확인](./교육과정-교과-과목-테이블-연결-확인.md)

---

**마지막 업데이트**: 2025-02-11









