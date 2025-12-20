# Phase 5: 레거시 청산 및 네이티브 타입 적용 완료

## 작업 개요

Phase 4에서 데이터 소스가 신규 테이블(`student_internal_scores`)로 전환되었지만, UI 컴포넌트들은 여전히 구형 타입(`SchoolScore`)을 사용하고 있어 매퍼를 거쳐야 하는 비효율이 존재했습니다.

Phase 5 작업을 통해 UI 컴포넌트가 `InternalScore` 타입을 직접 사용하도록 수정하여 매퍼를 제거하고, `@deprecated`된 함수와 파일들을 완전히 삭제했습니다.

## 작업 내용

### 1. UI 컴포넌트 타입 리팩토링 (Native Type Adoption)

#### 수정된 파일들

- **`app/(student)/scores/school/[grade]/[semester]/page.tsx`**
  - `mapInternalScoresToSchoolScores` 호출 제거
  - `getInternalScores` 결과를 그대로 `InternalScore[]` 타입으로 전달

- **`app/(student)/scores/school/[grade]/[semester]/_components/SchoolScoresView.tsx`**
  - Props 타입: `SchoolScore[]` → `InternalScore[]`
  - `editingScore` 타입: `SchoolScore | null` → `InternalScore | null`
  - `curriculumRevisionId` prop 추가

- **`app/(student)/scores/_components/ScoreCardGrid.tsx`**
  - Props 타입: `SchoolScore[]` → `InternalScore[]`
  - SortField: `"grade_score"` → `"rank_grade"`
  - 필드 접근: `score.grade_score` → `score.rank_grade`
  - 과목 정보 매핑 로직 단순화 (FK만 사용)

- **`app/(student)/scores/_components/ScoreCard.tsx`**
  - Props 타입: `SchoolScore` → `InternalScore`
  - 필드명 변경:
    - `grade_score` → `rank_grade`
    - `subject_average` → `avg_score`
    - `standard_deviation` → `std_dev`
  - `class_rank` 필드 제거 (InternalScore에는 없음)
  - 텍스트 필드(`subject_name`, `subject_group`, `subject_type`) 제거, FK만 사용

- **`app/(student)/scores/_components/ScoreFormModal.tsx`**
  - Props 타입: `SchoolScore | null` → `InternalScore | null`
  - `curriculumRevisionId` prop 추가
  - 필드명 변경:
    - `grade_score` → `rank_grade` (서버 전송 시)
    - `subject_average` → `avg_score` (서버 전송 시)
    - `standard_deviation` → `std_dev` (서버 전송 시)
  - `class_rank` 필드 제거
  - 액션 변경: `addSchoolScore` → `createInternalScore`, `updateSchoolScoreAction` → `updateInternalScore`
  - `getTenantContext` 호출 추가 (tenant_id 전달)

### 2. 매퍼 함수 삭제

#### 삭제된 함수들

- **`lib/data/studentScores.ts`**
  - `mapInternalScoreToSchoolScore()` - 단일 InternalScore를 SchoolScore로 변환
  - `mapInternalScoresToSchoolScores()` - InternalScore 배열을 SchoolScore 배열로 변환

### 3. 레거시 함수 삭제

#### 삭제된 함수들

- **`lib/data/studentScores.ts`**
  - `getSchoolScores()` - 레거시 테이블 조회 함수
  - `createSchoolScore()` - 레거시 테이블 생성 함수
  - `updateSchoolScore()` - 레거시 테이블 업데이트 함수
  - `deleteSchoolScore()` - 레거시 테이블 삭제 함수

- **`app/(student)/actions/scoreActions.ts`**
  - `addSchoolScore()` - 레거시 액션
  - `updateSchoolScoreAction()` - 레거시 액션
  - `deleteSchoolScoreAction()` - 레거시 액션

#### 삭제된 파일

- **`app/actions/scores/school.ts`** - 레거시 액션 재export 파일

### 4. 기타 수정 사항

- **`app/(student)/scores/school/[grade]/[semester]/[subject-group]/_components/DeleteSchoolScoreButton.tsx`**
  - `deleteSchoolScore` → `deleteInternalScore`로 변경
  - import 경로 수정: `@/app/actions/scores/school` → `@/app/actions/scores-internal`

### 5. DB 정리용 마이그레이션 파일 생성

#### 생성된 파일

- **`supabase/migrations/20250205000000_drop_legacy_student_school_scores_table.sql`**
  - 레거시 테이블(`student_school_scores`) 삭제용 마이그레이션
  - 백업 테이블로 이름 변경 옵션 포함
  - 프로덕션 환경에서는 백업 테이블로 이름 변경 권장

## 필드명 매핑 정리

### InternalScore → UI 표시 (변환 없음, 직접 사용)

| InternalScore 필드 | UI 표시 필드 | 비고 |
|-------------------|-------------|------|
| `rank_grade` | 등급 | 직접 사용 |
| `avg_score` | 과목평균 | 직접 사용 |
| `std_dev` | 표준편차 | 직접 사용 |
| `raw_score` | 원점수 | 직접 사용 |
| `credit_hours` | 학점수 | 직접 사용 |
| `total_students` | 수강자수 | 직접 사용 |

### 제거된 필드

- `class_rank` - InternalScore에는 없음
- `subject_name`, `subject_group`, `subject_type` - 텍스트 필드 제거, FK만 사용

## 타입 변경 요약

### Before (Phase 4)

```typescript
// page.tsx
const internalScores = await getInternalScores(...);
const scores = mapInternalScoresToSchoolScores(internalScores); // 매퍼 사용
<SchoolScoresView scores={scores} /> // SchoolScore[] 타입

// 컴포넌트
type Props = {
  scores: SchoolScore[];
  onEdit: (score: SchoolScore) => void;
};
```

### After (Phase 5)

```typescript
// page.tsx
const scores: InternalScore[] = await getInternalScores(...); // 매퍼 제거
<SchoolScoresView scores={scores} /> // InternalScore[] 타입

// 컴포넌트
type Props = {
  scores: InternalScore[];
  onEdit: (score: InternalScore) => void;
};
```

## 영향 범위

### 수정된 컴포넌트

1. **ScoreCardGrid** - 성적 카드 그리드
2. **ScoreCard** - 개별 성적 카드
3. **SchoolScoresView** - 내신 성적 뷰
4. **ScoreFormModal** - 성적 추가/수정 모달

### 삭제된 함수/파일

1. 매퍼 함수 2개
2. 레거시 데이터 접근 함수 4개
3. 레거시 서버 액션 3개
4. 레거시 액션 재export 파일 1개

## 검증 사항

- ✅ TypeScript 컴파일 에러 없음
- ✅ ESLint 에러 없음
- ✅ UI 컴포넌트가 InternalScore 타입 직접 사용
- ✅ 매퍼 함수 완전 제거
- ✅ 레거시 함수 완전 제거
- ✅ 필드명 변경 (rank_grade, avg_score, std_dev)
- ✅ class_rank 필드 제거

## 남은 작업

### 레거시 폴더 정리 (선택 사항)

다음 파일들은 더 이상 사용되지 않을 수 있으나, URL 구조 유지를 위해 남겨둘 수 있습니다:

- `app/(student)/scores/school/[grade]/[semester]/[subject-group]/new/_components/SchoolScoreForm.tsx`
- `app/(student)/scores/school/[grade]/[semester]/_components/SchoolScoresTable.tsx`

이 파일들은 `ScoreFormModal`과 `ScoreCardGrid`로 대체되었습니다.

## 다음 단계

1. **레거시 테이블 삭제** (선택 사항)
   - `/admin/migration-status` 페이지에서 데이터 일치 확인
   - `20250205000000_drop_legacy_student_school_scores_table.sql` 마이그레이션 실행
   - 프로덕션 환경에서는 백업 테이블로 이름 변경 권장

2. **레거시 폴더 정리** (선택 사항)
   - 사용되지 않는 컴포넌트 파일 삭제
   - URL 구조 유지가 필요한지 확인

## 참고

- Phase 4 작업: `docs/2025-02-05-score-migration-switchover-completion.md`
- 마이그레이션 상태 확인: `/admin/migration-status`

