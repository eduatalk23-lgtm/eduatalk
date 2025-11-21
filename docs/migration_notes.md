# 성적 테이블 마이그레이션 가이드

## 개요

기존 `student_scores` 테이블을 내신과 모의고사로 분리한 새로운 스키마입니다.

## 테이블 구조

### 1. student_school_scores (내신)

**주요 필드:**
- `grade`: 학년 (1, 2, 3)
- `semester`: 학기 (1, 2)
- `subject_group`: 교과 그룹 (국어, 수학, 영어, 사회, 과학 등)
- `subject_type`: 과목 유형 (공통, 일반선택, 진로선택)
- `subject_name`: 세부 과목명
- `grade_score`: 성취도 등급 (1~9)
- `class_rank`: 반 석차 (선택)

**특징:**
- 학기별 관리 가능
- 반 석차 정보 포함 가능
- 내신 특화 필드 구조

### 2. student_mock_scores (모의고사)

**주요 필드:**
- `grade`: 학년 (1, 2, 3)
- `subject_group`: 교과 그룹 (국어, 수학, 영어, 탐구 등)
- `subject_name`: 세부 과목명
- `exam_type`: 시험 유형 (평가원, 교육청, 사설)
- `exam_round`: 시험 회차 (3월, 4월, 6월, 9월 등)
- `percentile`: 백분위 (0~100)
- `grade_score`: 등급 (1~9)

**특징:**
- 시험 유형별 관리
- 백분위 정보 포함
- 모의고사 특화 필드 구조

## 인덱스 전략

### 내신 테이블
- `student_id`: 학생별 조회 최적화
- `grade, semester`: 학년/학기별 필터링
- `subject_group`: 과목 그룹별 조회
- `test_date`: 날짜별 정렬/필터링
- 복합 인덱스: `(student_id, grade, semester)` - 가장 빈번한 조회 패턴

### 모의고사 테이블
- `student_id`: 학생별 조회 최적화
- `grade`: 학년별 필터링
- `exam_type`: 시험 유형별 필터링
- `test_date`: 날짜별 정렬/필터링
- 복합 인덱스: `(student_id, grade)`, `(student_id, exam_type)`

## RLS (Row Level Security)

두 테이블 모두 다음 정책을 적용:
- **SELECT**: 학생은 자신의 성적만 조회 가능
- **INSERT**: 학생은 자신의 성적만 추가 가능
- **UPDATE**: 학생은 자신의 성적만 수정 가능
- **DELETE**: 학생은 자신의 성적만 삭제 가능

## 데이터 마이그레이션 (기존 데이터 이관)

기존 `student_scores` 테이블의 데이터를 새 테이블로 이관하는 경우:

```sql
-- 내신 데이터 이관 예시
INSERT INTO student_school_scores (
  student_id, grade, semester, subject_group, 
  subject_type, subject_name, raw_score, grade_score, test_date
)
SELECT 
  student_id,
  -- grade 추출 로직 (기존 데이터에서)
  semester::integer,
  course as subject_group,
  subject_type,
  course_detail as subject_name,
  raw_score,
  grade as grade_score,
  test_date::date
FROM student_scores
WHERE subject_type IN ('내신', '학교성적'); -- 적절한 필터 조건

-- 모의고사 데이터 이관 예시
INSERT INTO student_mock_scores (
  student_id, grade, subject_group, subject_name,
  exam_type, exam_round, raw_score, percentile, grade_score, test_date
)
SELECT 
  student_id,
  -- grade 추출 로직
  course as subject_group,
  course_detail as subject_name,
  score_type_detail as exam_type,
  -- exam_round 추출 로직
  raw_score,
  -- percentile 계산 로직 (기존 데이터에 없는 경우)
  grade as grade_score,
  test_date::date
FROM student_scores
WHERE subject_type IN ('모의고사', '평가원', '교육청'); -- 적절한 필터 조건
```

## 애플리케이션 코드 변경 사항

1. **Server Actions 업데이트**
   - `app/actions/scores.ts`에 새 테이블용 함수 추가
   - 내신/모의고사 구분 로직 구현

2. **UI 컴포넌트**
   - 성적 입력 폼을 내신/모의고사로 분리
   - 각각의 특화된 필드 표시

3. **조회 로직**
   - 내신: 학년/학기별 조회
   - 모의고사: 시험 유형별 조회

## 제약조건 및 검증

### 내신 테이블
- `grade`: 1~3 범위 체크
- `semester`: 1 또는 2만 허용
- `grade_score`: 1~9 범위 체크
- `class_rank`: 양수만 허용

### 모의고사 테이블
- `grade`: 1~3 범위 체크
- `percentile`: 0~100 범위 체크
- `grade_score`: 1~9 범위 체크

## 향후 확장 고려사항

1. **과목 그룹 enum화**: 현재는 text이지만, 향후 enum 타입으로 변경 가능
2. **통계 함수**: 평균, 표준편차 계산을 위한 함수 추가
3. **뷰 생성**: 내신/모의고사 통합 조회를 위한 뷰 생성 고려
4. **트리거**: 성적 입력 시 자동 통계 업데이트 트리거

