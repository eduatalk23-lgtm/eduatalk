# 성적 관리 시스템 아키텍처 문서

**작성일**: 2025-02-05  
**버전**: 2.0 (Phase 5 완료 후)

---

## 📋 개요

이 문서는 TimeLevelUp 프로젝트의 성적 관리 시스템의 현재 아키텍처를 설명합니다. Phase 5 작업을 통해 레거시 타입과 매퍼가 완전히 제거되고, 네이티브 타입(`InternalScore`, `MockScore`)을 직접 사용하는 구조로 전환되었습니다.

---

## 🗄 데이터베이스 구조

### 테이블 구조

#### 1. `student_internal_scores` (내신 성적)

**주요 필드**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK → `tenants.id`)
- `student_id` (uuid, FK → `students.id`)
- `student_term_id` (uuid, FK → `student_terms.id`)
- `curriculum_revision_id` (uuid, FK → `curriculum_revisions.id`)
- `subject_group_id` (uuid, FK → `subject_groups.id`)
- `subject_type_id` (uuid, FK → `subject_types.id`)
- `subject_id` (uuid, FK → `subjects.id`)
- `grade` (integer, 1~3)
- `semester` (integer, 1~2)
- `credit_hours` (numeric)
- `raw_score` (numeric, nullable)
- `avg_score` (numeric, nullable) - 과목평균
- `std_dev` (numeric, nullable) - 표준편차
- `rank_grade` (integer, nullable, 1~9) - 석차등급
- `total_students` (integer, nullable)
- `created_at`, `updated_at` (timestamps)

**FK 관계**:
- `student_term_id`: 학기 정보 (자동 생성/조회)
- `curriculum_revision_id`: 개정교육과정
- `subject_group_id`, `subject_type_id`, `subject_id`: 교과/과목/과목구분 계층

#### 2. `student_mock_scores` (모의고사 성적)

**주요 필드**:
- `id` (uuid, PK)
- `tenant_id` (uuid, FK → `tenants.id`)
- `student_id` (uuid, FK → `students.id`)
- `curriculum_revision_id` (uuid, FK → `curriculum_revisions.id`)
- `subject_group_id` (uuid, FK → `subject_groups.id`)
- `subject_id` (uuid, FK → `subjects.id`, nullable)
- `grade` (integer, 1~3)
- `exam_date` (date)
- `exam_title` (text)
- `standard_score` (numeric, nullable)
- `percentile` (numeric, nullable)
- `grade_score` (integer, nullable, 1~9)
- `created_at`, `updated_at` (timestamps)

**FK 관계**:
- `curriculum_revision_id`: 개정교육과정
- `subject_group_id`, `subject_id`: 교과/과목 계층

---

## 🔄 데이터 흐름

### 1. 데이터 조회 흐름 (Read)

```
Server Component (page.tsx)
    ↓
getInternalScores(userId, tenantId, filters?)
    ↓
createSupabaseServerClient()
    ↓
supabase.from("student_internal_scores").select(...)
    ↓
InternalScore[] (네이티브 타입)
    ↓
UI Component (ScoreCardGrid, ScoreCard)
```

**주요 함수**:
- `getInternalScores()`: `lib/data/studentScores.ts`
- `getMockScores()`: `lib/data/studentScores.ts`

**특징**:
- ✅ 매퍼 없이 네이티브 타입 직접 사용
- ✅ FK 관계를 통한 과목 정보 조회
- ✅ Server Component에서 직접 DB 호출

### 2. 데이터 변이 흐름 (Create/Update/Delete)

#### 생성 (Create)

```
Client Component (ScoreFormModal)
    ↓
FormData 생성
    ↓
createInternalScore(formData) - Server Action
    ↓
getCurrentUser() - tenant_id, student_id 자동 획득
    ↓
getOrCreateStudentTerm() - student_term_id 자동 생성/조회
    ↓
supabase.from("student_internal_scores").insert(...)
    ↓
revalidatePath("/scores")
    ↓
router.refresh()
```

#### 수정 (Update)

```
Client Component (ScoreFormModal)
    ↓
FormData 생성
    ↓
updateInternalScore(scoreId, formData) - Server Action
    ↓
getCurrentUser() - tenant_id, student_id 자동 획득
    ↓
supabase.from("student_internal_scores").update(...)
    ↓
revalidatePath("/scores")
    ↓
router.refresh()
```

#### 삭제 (Delete)

```
Client Component (ScoreCard, DeleteButton)
    ↓
deleteInternalScore(scoreId) - Server Action
    ↓
getCurrentUser() - tenant_id, student_id 자동 획득
    ↓
supabase.from("student_internal_scores").delete(...)
    ↓
revalidatePath("/scores")
    ↓
router.refresh()
```

**주요 함수**:
- `createInternalScore()`: `app/actions/scores-internal.ts`
- `updateInternalScore()`: `app/actions/scores-internal.ts`
- `deleteInternalScore()`: `app/actions/scores-internal.ts`

**특징**:
- ✅ Server Action에서 `getCurrentUser()`로 `tenant_id`, `student_id` 자동 획득
- ✅ `student_term_id` 자동 생성/조회 (`getOrCreateStudentTerm`)
- ✅ `revalidatePath`로 캐시 무효화

---

## 🧩 컴포넌트 구조

### 주요 컴포넌트 계층

```
Page (Server Component)
├── SchoolScoresView (Client Component)
    ├── ScoreCardGrid (Client Component)
    │   ├── ScoreCard (Client Component) × N
    │   └── ScoreGridFilterBar (Client Component)
    └── ScoreFormModal (Client Component)
        └── Form Fields
```

### 컴포넌트별 역할

#### 1. `SchoolScoresView` (`app/(student)/scores/school/[grade]/[semester]/_components/SchoolScoresView.tsx`)

**역할**: 내신 성적 뷰의 최상위 컨테이너

**Props**:
```typescript
type SchoolScoresViewProps = {
  initialGrade?: number;
  initialSemester?: number;
  scores: InternalScore[]; // 네이티브 타입
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  curriculumRevisionId: string;
};
```

**기능**:
- 성적 카드 그리드 표시
- 추가/수정 모달 관리
- 삭제 확인 다이얼로그 관리

#### 2. `ScoreCardGrid` (`app/(student)/scores/_components/ScoreCardGrid.tsx`)

**역할**: 성적 카드 그리드 및 필터링/정렬

**Props**:
```typescript
type ScoreCardGridProps = {
  initialGrade?: number;
  initialSemester?: number;
  scores: InternalScore[]; // 네이티브 타입
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  onAddClick?: () => void;
  onEdit: (score: InternalScore) => void;
  onDelete: (scoreId: string) => void;
};
```

**기능**:
- 성적 카드 그리드 렌더링
- 필터링 (학년, 학기, 교과, 과목, 과목구분)
- 정렬 (등급, 원점수 등)
- 빈 상태 처리

#### 3. `ScoreCard` (`app/(student)/scores/_components/ScoreCard.tsx`)

**역할**: 개별 성적 카드

**Props**:
```typescript
type ScoreCardProps = {
  score: InternalScore; // 네이티브 타입
  subjectGroupName: string;
  subjectName: string;
  subjectTypeName: string;
  onEdit: (score: InternalScore) => void;
  onDelete: (scoreId: string) => void;
};
```

**기능**:
- 성적 정보 표시
- 편집/삭제 버튼

#### 4. `ScoreFormModal` (`app/(student)/scores/_components/ScoreFormModal.tsx`)

**역할**: 성적 추가/수정 모달

**Props**:
```typescript
type ScoreFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGrade?: number;
  initialSemester?: number;
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
  editingScore?: InternalScore | null; // 네이티브 타입
  curriculumRevisionId: string;
  onSuccess?: () => void;
};
```

**기능**:
- 성적 추가/수정 폼
- 필드 검증
- Server Action 호출 (`createInternalScore`, `updateInternalScore`)

---

## 📝 필드명 매핑 규칙

### InternalScore 필드 → UI 표시

| InternalScore 필드 | UI 표시 필드 | 설명 |
|-------------------|-------------|------|
| `rank_grade` | 등급 | 석차등급 (1~9) |
| `avg_score` | 과목평균 | 과목 평균 점수 |
| `std_dev` | 표준편차 | 표준편차 |
| `raw_score` | 원점수 | 원점수 |
| `credit_hours` | 학점수 | 이수단위 |
| `total_students` | 수강자수 | 수강자 수 |

### 제거된 필드

- `class_rank`: InternalScore에는 없음 (레거시 필드)
- `subject_name`, `subject_group`, `subject_type`: 텍스트 필드 제거, FK만 사용

### FormData → DB 필드 변환

**ScoreFormModal에서 FormData 생성 시**:
- UI 필드 `grade_score` → DB 필드 `rank_grade`
- UI 필드 `subject_average` → DB 필드 `avg_score`
- UI 필드 `standard_deviation` → DB 필드 `std_dev`

**Server Action에서 처리**:
- `createInternalScore`, `updateInternalScore`에서 FormData를 받아 DB에 저장

---

## 🔧 주요 유틸리티 함수

### 데이터 조회

#### `getInternalScores()`
```typescript
// lib/data/studentScores.ts
export async function getInternalScores(
  studentId: string,
  tenantId: string,
  filters?: {
    grade?: number;
    semester?: number;
  }
): Promise<InternalScore[]>
```

**기능**:
- `student_internal_scores` 테이블에서 성적 조회
- 필터링 (학년, 학기)
- 네이티브 타입 `InternalScore[]` 반환

#### `getMockScores()`
```typescript
// lib/data/studentScores.ts
export async function getMockScores(
  studentId: string,
  tenantId: string
): Promise<MockScore[]>
```

**기능**:
- `student_mock_scores` 테이블에서 성적 조회
- 네이티브 타입 `MockScore[]` 반환

### Server Actions

#### `createInternalScore()`
```typescript
// app/actions/scores-internal.ts
export async function createInternalScore(formData: FormData)
```

**기능**:
- `getCurrentUser()`로 `tenant_id`, `student_id` 자동 획득
- `getOrCreateStudentTerm()`로 `student_term_id` 자동 생성/조회
- `student_internal_scores` 테이블에 삽입
- `revalidatePath("/scores")` 호출

#### `updateInternalScore()`
```typescript
// app/actions/scores-internal.ts
export async function updateInternalScore(
  scoreId: string,
  formData: FormData
)
```

**기능**:
- `getCurrentUser()`로 `tenant_id`, `student_id` 자동 획득
- `student_internal_scores` 테이블 업데이트
- `revalidatePath("/scores")` 호출

#### `deleteInternalScore()`
```typescript
// app/actions/scores-internal.ts
export async function deleteInternalScore(scoreId: string)
```

**기능**:
- `getCurrentUser()`로 `tenant_id`, `student_id` 자동 획득
- `student_internal_scores` 테이블에서 삭제
- `revalidatePath("/scores")` 호출

---

## 🗑 삭제된 레거시 컴포넌트

Phase 5 작업에서 다음 레거시 파일들이 삭제되었습니다:

### 삭제된 컴포넌트

1. **`SchoolScoreForm.tsx`**
   - 위치: `app/(student)/scores/school/[grade]/[semester]/[subject-group]/new/_components/`
   - 대체: `ScoreFormModal`

2. **`SchoolScoresTable.tsx`**
   - 위치: `app/(student)/scores/school/[grade]/[semester]/_components/`
   - 대체: `ScoreCardGrid`

3. **`SchoolScoreEditForm.tsx`**
   - 위치: `app/(student)/scores/school/[grade]/[semester]/[subject-group]/[id]/edit/_components/`
   - 대체: `ScoreFormModal` (모달로 통합)

4. **`MockScoresTable.tsx`**
   - 위치: `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/`
   - 대체: `MockScoreCardGrid`

### 삭제된 함수

1. **매퍼 함수**:
   - `mapInternalScoreToSchoolScore()`
   - `mapInternalScoresToSchoolScores()`

2. **레거시 데이터 접근 함수**:
   - `getSchoolScores()`
   - `createSchoolScore()`
   - `updateSchoolScore()`
   - `deleteSchoolScore()`

3. **레거시 서버 액션**:
   - `addSchoolScore()`
   - `updateSchoolScoreAction()`
   - `deleteSchoolScoreAction()`

---

## 🎯 아키텍처 원칙

### 1. 네이티브 타입 사용

- ✅ UI 컴포넌트는 `InternalScore`, `MockScore` 타입을 직접 사용
- ❌ 매퍼 함수를 통한 타입 변환 금지
- ❌ 레거시 타입(`SchoolScore`) 사용 금지

### 2. FK 관계 활용

- ✅ 과목 정보는 FK(`subject_group_id`, `subject_id`, `subject_type_id`)로만 관리
- ❌ 텍스트 필드(`subject_name`, `subject_group`, `subject_type`) 사용 금지

### 3. Server Action 패턴

- ✅ `getCurrentUser()`로 `tenant_id`, `student_id` 자동 획득
- ✅ `getOrCreateStudentTerm()`로 `student_term_id` 자동 생성/조회
- ✅ `revalidatePath()`로 캐시 무효화

### 4. 컴포넌트 분리

- ✅ 카드 그리드: `ScoreCardGrid`
- ✅ 개별 카드: `ScoreCard`
- ✅ 폼 모달: `ScoreFormModal`
- ✅ 필터 바: `ScoreGridFilterBar`

---

## 📚 참고 문서

- Phase 5 작업 완료: `docs/2025-02-05-phase5-legacy-cleanup-completion.md`
- Phase 4 작업 완료: `docs/2025-02-05-score-migration-switchover-completion.md`
- 성적 입력 구현: `docs/score-input-implementation.md`

---

**마지막 업데이트**: 2025-02-05

