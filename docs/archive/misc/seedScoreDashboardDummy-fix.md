# seedScoreDashboardDummy.ts 스키마 에러 수정

## 📋 작업 개요

`scripts/seedScoreDashboardDummy.ts` 실행 시 발생하던 PGRST204 스키마 캐시 에러를 해결하기 위해 존재하지 않는 컬럼을 제거했습니다.

## ❌ 발생한 에러

```bash
모의고사 성적 생성 실패: Could not find the 'subject_group' column of 'student_mock_scores' in the schema cache (코드: PGRST204)
```

## 🔍 원인 분석

실제 Supabase 스키마 기준으로 `student_mock_scores` 테이블에는 다음 컬럼들이 존재하지 않습니다:
- `exam_round` (이미 이전에 제거됨)
- `exam_type` (이미 이전에 제거됨)
- `subject_group` (text 형태) - **이번에 제거**

실제 스키마 구조:
- `id`
- `tenant_id`
- `student_id`
- `exam_date` ✅
- `exam_title` ✅
- `subject_id` ✅
- `subject_group_id` (nullable, FK)
- `percentile` ✅
- `standard_score` ✅
- `grade_score` ✅
- `created_at` 등 메타 컬럼

> 참고: `subject_id` → `subjects` → `subject_groups`로 조인하여 교과군 정보를 사용하므로, `subject_group` 텍스트 컬럼은 불필요합니다.

## ✅ 수정 내용

### 1. `CreateMockScoreParams` 타입 수정

**제거된 필드:**
- `grade` (스키마에 없음)
- `subjectGroupId` (사용하지 않음)
- `subjectGroup` (text) ❌ **제거**
- `subjectName` (사용하지 않음)

**추가된 필드:**
- `examDate: string` ✅
- `examTitle: string` ✅

**최종 타입:**
```typescript
type CreateMockScoreParams = {
  tenantId: string;
  studentId: string;
  examDate: string;
  examTitle: string;
  subjectId: string;
  percentile: number;
  standardScore: number;
  gradeScore: number;
};
```

### 2. `createMockScore` 함수 수정

**제거된 insert 필드:**
- `grade` ❌
- `subject_group_id` ❌
- `subject_group` ❌ **제거**
- `subject_name` ❌

**추가된 insert 필드:**
- `exam_date` ✅
- `exam_title` ✅

**최종 insert payload:**
```typescript
{
  tenant_id: params.tenantId,
  student_id: params.studentId,
  exam_date: params.examDate,
  exam_title: params.examTitle,
  subject_id: params.subjectId,
  percentile: params.percentile,
  standard_score: params.standardScore,
  grade_score: params.gradeScore,
}
```

### 3. 호출부 수정 (`createStudentA`, `createStudentB`, `createStudentC`)

**제거된 파라미터:**
- `grade: termInfo.grade` ❌
- `subjectGroupId: sgId` ❌
- `subjectGroup: score.subjectGroup` ❌ **제거**
- `subjectName: score.subjectName` ❌

**추가된 파라미터:**
- `examDate: "2025-03-15"` ✅
- `examTitle: "2025학년도 3월 모의고사"` ✅

**최종 호출 예시:**
```typescript
await createMockScore({
  tenantId: metadata.tenantId,
  studentId,
  examDate: "2025-03-15",
  examTitle: "2025학년도 3월 모의고사",
  subjectId,
  percentile: score.percentile,
  standardScore: score.standardScore,
  gradeScore: score.gradeScore,
});
```

## 📊 변경 요약

### 제거된 컬럼/필드

| 컬럼/필드명 | 위치 | 상태 |
|------------|------|------|
| `exam_round` | - | 이미 제거됨 (이전 작업) |
| `exam_type` | - | 이미 제거됨 (이전 작업) |
| `subject_group` (text) | 타입, 함수, 호출부 | ✅ **제거 완료** |
| `grade` | 타입, 함수, 호출부 | ✅ 제거 완료 |
| `subjectGroupId` | 타입, 호출부 | ✅ 제거 완료 |
| `subjectName` | 타입, 호출부 | ✅ 제거 완료 |

### 추가된 필드

| 필드명 | 위치 | 상태 |
|--------|------|------|
| `examDate` | 타입, 함수, 호출부 | ✅ 추가 완료 |
| `examTitle` | 타입, 함수, 호출부 | ✅ 추가 완료 |

## 🧪 테스트

수정 후 다음 명령어로 테스트:

```bash
# 더미 데이터 생성
npx tsx scripts/seedScoreDashboardDummy.ts

# API 테스트
npm run test:score-dashboard
```

## 📝 참고 사항

1. **스키마 일관성**: 실제 Supabase 스키마와 코드가 일치하도록 수정했습니다.
2. **교과군 정보**: `subject_id` → `subjects` → `subject_groups` 조인으로 교과군 정보를 사용하므로 텍스트 컬럼이 불필요합니다.
3. **기본값**: `examDate`와 `examTitle`은 현재 모든 학생에 대해 동일한 값("2025-03-15", "2025학년도 3월 모의고사")을 사용합니다. 필요시 개별화할 수 있습니다.

## ✅ 완료 체크리스트

- [x] `CreateMockScoreParams` 타입에서 `subjectGroup` 제거
- [x] `createMockScore` 함수에서 `subject_group` insert 제거
- [x] 호출부에서 `subjectGroup` 인자 제거
- [x] `examDate`, `examTitle` 필드 추가
- [x] 린터 에러 확인 완료
- [x] 스크립트 실행 테스트 필요

---

**작업 일시**: 2025-01-XX  
**작업자**: Cursor AI Assistant

