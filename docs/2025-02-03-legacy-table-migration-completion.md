# 레거시 테이블 마이그레이션 완료

**작성일**: 2025-02-03  
**작업자**: AI Assistant

---

## 📋 작업 개요

`student_school_scores` 테이블을 참조하는 모든 잔여 코드를 `student_internal_scores` 테이블로 전환하는 작업을 완료했습니다.

---

## 🔧 수정된 파일

### 1. `lib/domains/score/repository.ts`

#### 수정된 함수

1. **`findSchoolScores`** (레거시 함수)
   - `student_school_scores` → `student_internal_scores`로 변경
   - `subject_groups` JOIN을 통해 `name` 조회
   - 반환 타입은 하위 호환성을 위해 `SchoolScore` 유지
   - 컬럼 매핑:
     - `avg_score` → `subject_average`
     - `std_dev` → `standard_deviation`
     - `rank_grade` → `grade_score`

2. **`findSchoolScoreById`**
   - `student_school_scores` → `student_internal_scores`로 변경
   - `subject_groups` JOIN을 통해 `name` 조회
   - 반환 타입은 하위 호환성을 위해 `SchoolScore` 유지
   - 컬럼 매핑 적용

3. **`insertSchoolScore`** (레거시 함수)
   - `student_school_scores` → `student_internal_scores`로 변경
   - 레거시 필드명을 신규 필드명으로 매핑:
     - `subject_average` → `avg_score`
     - `standard_deviation` → `std_dev`
     - `grade_score` → `rank_grade`
   - `curriculum_revision_id`가 없으면 활성화된 교육과정을 기본값으로 사용
   - 활성화된 교육과정이 없으면 에러 발생

4. **`updateSchoolScoreById`**
   - `student_school_scores` → `student_internal_scores`로 변경
   - 레거시 필드명을 신규 필드명으로 매핑
   - `subject_group`, `subject_type`, `subject_name` 텍스트 필드는 무시 (FK로 관리)

5. **`deleteSchoolScoreById`**
   - `student_school_scores` → `student_internal_scores`로 변경

#### 주요 변경 사항

- 모든 쿼리가 `student_internal_scores` 테이블을 사용하도록 변경
- `subject_groups` JOIN을 통해 과목 그룹명 조회
- 레거시 필드명을 신규 필드명으로 자동 매핑
- 하위 호환성을 위해 반환 타입은 `SchoolScore` 유지

---

### 2. `lib/reports/weekly.ts`

#### 수정된 함수

**`getWeeklyWeakSubjectTrend`**
- 성적 데이터 조회 부분 수정:
  - `student_school_scores` → `student_internal_scores`
  - 컬럼 변경:
    - `subject_group` (text) → `subject_groups:subject_group_id(name)` (JOIN)
    - `grade_score` → `rank_grade`
    - `test_date` → `created_at` (내신은 시험일자가 없으므로 생성일 기준)

#### 변경 내용

```typescript
// 변경 전
.from("student_school_scores")
.select("subject_group,grade_score,test_date")

// 변경 후
.from("student_internal_scores")
.select("rank_grade,created_at,subject_groups:subject_group_id(name)")
```

---

### 3. `lib/domains/score/types.ts`

#### 수정 내용

- 레거시 타입(`SchoolScore`, `SchoolScoreInsert`, `SchoolScoreUpdate`)에 주석 추가
- 실제 구현이 `student_internal_scores` 테이블을 사용한다는 점 명시
- 하위 호환성을 위해 타입만 유지된다는 점 명시

---

## 📊 컬럼 매핑 정리

### 내신 성적 테이블 (`student_internal_scores`)

| 레거시 필드명 | 신규 필드명 | 비고 |
|------------|----------|------|
| `grade_score` | `rank_grade` | 석차등급 |
| `subject_average` | `avg_score` | 과목평균 |
| `standard_deviation` | `std_dev` | 표준편차 |
| `subject_group` (text) | `subject_group_id` (FK) | JOIN으로 name 조회 |
| `test_date` | `created_at` | 내신은 시험일자가 없으므로 생성일 기준 |

---

## ⚠️ 주의 사항

### 1. 레거시 함수 사용 시

- `findSchoolScores`, `insertSchoolScore` 등 레거시 함수는 하위 호환성을 위해 유지되지만, 내부적으로는 `student_internal_scores` 테이블을 사용합니다.
- 가능한 한 신규 함수(`findInternalScores`, `insertInternalScore`)를 사용하는 것을 권장합니다.

### 2. `curriculum_revision_id` 필수 필드

- `insertSchoolScore` 함수에서 `curriculum_revision_id`가 없으면 활성화된 교육과정을 기본값으로 사용합니다.
- 활성화된 교육과정이 없으면 에러가 발생합니다.
- 신규 함수(`insertInternalScore`)를 사용하면 `curriculum_revision_id`를 명시적으로 제공해야 합니다.

### 3. 텍스트 필드 제거

- `subject_group`, `subject_type`, `subject_name` 같은 텍스트 필드는 더 이상 저장되지 않습니다.
- 대신 `subject_group_id`, `subject_type_id`, `subject_id` FK를 사용하여 관련 테이블과 JOIN하여 조회합니다.

---

## ✅ 검증 완료

- [x] TypeScript 컴파일 에러 없음
- [x] ESLint 에러 없음
- [x] 모든 레거시 테이블 참조 제거
- [x] 컬럼 매핑 정확성 확인
- [x] 하위 호환성 유지

---

## 🚀 다음 단계

다음 파일들도 확인이 필요할 수 있습니다 (현재 작업 범위 외):

- `lib/domains/score/actions.ts`: Server Actions에서 레거시 함수 사용 여부 확인
- `app/(student)/scores/**`: 프론트엔드 컴포넌트에서 레거시 타입 사용 여부 확인
- 기타 레거시 타입을 참조하는 파일들

---

**작업 완료 시간**: 2025-02-03

