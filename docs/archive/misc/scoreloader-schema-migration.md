# scoreLoader 스키마 마이그레이션

## 작업 개요

`lib/scheduler/scoreLoader.ts`의 `getSchoolScoreSummary`와 `getMockScoreSummary` 함수를 새로운 스키마에 맞게 수정했습니다.

## 문제 상황

- **기존 테이블**: `student_school_scores` (삭제됨)
- **새 테이블**: `student_internal_scores`
- **스키마 변경**: 
  - `subject_group` (텍스트) → `subject_group_id` (FK)
  - `grade_score` → `rank_grade`

## 해결 방법

### 1. getSchoolScoreSummary 함수 수정

**파일**: `lib/scheduler/scoreLoader.ts`

#### 변경 사항

1. **테이블 변경**
   ```typescript
   // 변경 전
   .from("student_school_scores")
   .select("*")
   
   // 변경 후
   .from("student_internal_scores")
   .select("*, subject_groups(name)")
   ```

2. **조인 추가**
   - `subject_groups` 테이블과 조인하여 과목 그룹 이름 가져오기
   - Supabase의 네이티브 조인 문법 사용

3. **타입 정의 변경**
   ```typescript
   // 변경 전
   (scores as Array<{
     subject_group: string | null;
     grade_score: number | null;
     // ...
   }>)
   
   // 변경 후
   (scores as Array<{
     subject_groups: { name: string } | null;
     rank_grade: number | null;
     // ...
   }>)
   ```

4. **필드 접근 변경**
   ```typescript
   // 변경 전
   if (!score.subject_group) return;
   const subject = score.subject_group.toLowerCase().trim();
   const validGrades = subjectScores.map((s) => s.grade_score)
   
   // 변경 후
   if (!score.subject_groups?.name) return;
   const subject = score.subject_groups.name.toLowerCase().trim();
   const validGrades = subjectScores.map((s) => s.rank_grade)
   ```

### 2. getMockScoreSummary 함수 수정

**파일**: `lib/scheduler/scoreLoader.ts`

#### 변경 사항

1. **조인 추가**
   ```typescript
   // 변경 전
   .from("student_mock_scores")
   .select("*")
   
   // 변경 후
   .from("student_mock_scores")
   .select("*, subject_groups(name)")
   ```

2. **타입 정의 변경**
   ```typescript
   // 변경 전
   (scores as Array<{
     subject_group: string | null;
     // ...
   }>)
   
   // 변경 후
   (scores as Array<{
     subject_groups: { name: string } | null;
     // ...
   }>)
   ```

3. **필드 접근 변경**
   ```typescript
   // 변경 전
   if (!score.subject_group) return;
   const subject = score.subject_group.toLowerCase().trim();
   
   // 변경 후
   if (!score.subject_groups?.name) return;
   const subject = score.subject_groups.name.toLowerCase().trim();
   ```

## 변경된 파일

- `lib/scheduler/scoreLoader.ts`

## 테스트 확인 사항

1. ✅ TypeScript 타입 체크 통과
2. ✅ ESLint 에러 없음
3. ⏳ 런타임 테스트 필요:
   - `getSchoolScoreSummary` 함수 실행 확인
   - `getMockScoreSummary` 함수 실행 확인
   - `getRiskIndexBySubject` 함수 실행 확인 (의존 함수)

## 영향받는 함수

- `getSchoolScoreSummary` - 내신 성적 요약 조회
- `getMockScoreSummary` - 모의고사 성적 요약 조회
- `getRiskIndexBySubject` - 위 두 함수를 호출하여 Risk Index 계산

## 호출 경로

```
app/(student)/dashboard/page.tsx
  └─ getMonthlyReportData()
      └─ getMonthlyWeakSubjectTrend()
          └─ getRiskIndexBySubject()
              ├─ getSchoolScoreSummary() ✅ 수정됨
              └─ getMockScoreSummary() ✅ 수정됨
```

## 스키마 참고

### student_internal_scores

```typescript
{
  id: string;
  tenant_id: string;
  student_id: string;
  student_term_id: string;
  curriculum_revision_id: string;
  subject_group_id: string; // FK → subject_groups
  subject_type_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score: number | null;
  avg_score: number | null;
  std_dev: number | null;
  rank_grade: number | null; // 석차등급 (1-9)
  total_students: number | null;
  created_at: string;
  updated_at: string;
}
```

### student_mock_scores

```typescript
{
  id: string;
  tenant_id: string;
  student_id: string;
  student_term_id: string | null;
  exam_date: string;
  exam_title: string;
  grade: number;
  subject_id: string;
  subject_group_id: string; // FK → subject_groups
  standard_score: number | null;
  percentile: number | null;
  grade_score: number | null; // 등급 (1-9)
  raw_score: number | null;
  created_at: string;
  updated_at: string;
}
```

### subject_groups

```typescript
{
  id: string;
  tenant_id: string | null;
  name: string; // 과목 그룹 이름 (예: "국어", "수학", "영어")
  display_order: number;
  created_at: string;
  updated_at: string;
}
```

## 작업 일시

2024-11-29

