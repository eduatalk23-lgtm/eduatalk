# seedScoreDashboardDummy.ts 마이그레이션 작업

## 📋 작업 목적

`student_school_scores` 테이블이 삭제되고 `student_internal_scores` 테이블로 통합된 상황에서, 더미 데이터 생성 스크립트를 현재 DB 스키마에 맞게 수정했습니다.

## 🔄 변경 사항

### 1. 테이블 변경
- **이전**: `student_school_scores` 테이블 사용
- **이후**: `student_internal_scores` 테이블 사용

### 2. 주요 수정 내용

#### (1) Import 추가
```typescript
import { getOrCreateStudentTerm, calculateSchoolYear } from "@/lib/data/studentTerms";
```

#### (2) `getStudentTermInfo` 함수 수정
- **이전**: 단순히 `grade`, `semester`, `schoolYear` 반환
- **이후**: `student_terms` 테이블을 조회/생성하여 `student_term_id`를 포함한 정보 반환
- `async` 함수로 변경

#### (3) `createInternalScore` 함수 완전 재작성
- **테이블 변경**: `student_school_scores` → `student_internal_scores`
- **필수 파라미터 추가**:
  - `student_term_id`: `student_terms` 테이블의 ID
  - `curriculum_revision_id`: 교육과정 개정 ID
- **컬럼명 매핑 변경**:
  - `subject_average` → `avg_score`
  - `standard_deviation` → `std_dev`
- **제거된 컬럼**: 
  - `subject_group` (텍스트 필드)
  - `subject_type` (텍스트 필드)
  - `subject_name` (텍스트 필드)
  - → FK만 사용 (`subject_group_id`, `subject_type_id`, `subject_id`)

#### (4) 학생 생성 함수 수정
- `createStudentA`, `createStudentB`, `createStudentC` 함수 모두 수정
- `getStudentTermInfo` 호출 시 `await` 추가 및 필요한 파라미터 전달
- `createInternalScore` 호출 시 새로운 파라미터 구조 적용

### 3. 스키마 구조

#### `student_internal_scores` 테이블 구조
```typescript
{
  id: string;
  tenant_id: string;
  student_id: string;
  student_term_id: string; // FK → student_terms.id
  curriculum_revision_id: string;
  subject_group_id: string;
  subject_type_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score: number | null;
  avg_score: number | null; // 이전: subject_average
  std_dev: number | null;   // 이전: standard_deviation
  rank_grade: number | null;
  total_students: number | null;
  created_at: string;
  updated_at: string;
}
```

#### `student_terms` 테이블 구조
```typescript
{
  id: string;
  tenant_id: string;
  student_id: string;
  school_year: number; // 학년도 (예: 2024)
  grade: number; // 학년 (1~3)
  semester: number; // 학기 (1~2)
  curriculum_revision_id: string;
  class_name: string | null;
  homeroom_teacher: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

## ✅ 검증 완료

- [x] `student_school_scores` 참조 완전 제거
- [x] `student_internal_scores` 테이블 사용
- [x] `student_terms` 조회/생성 로직 추가
- [x] 컬럼명 매핑 수정
- [x] Linter 오류 없음
- [x] TypeScript 타입 안전성 확보

## 📝 사용 방법

스크립트 실행 방법은 동일합니다:

```bash
npx tsx scripts/seedScoreDashboardDummy.ts
```

## 🔍 참고 사항

- `student_terms` 테이블은 자동으로 조회/생성됩니다
- 하드코딩된 UUID를 사용하지 않고, DB에서 조회한 ID를 사용합니다
- `curriculum_revisions`, `subject_groups`, `subjects` 테이블의 이름 기반 조회를 사용합니다

## 🚨 주의사항

- 이 스크립트는 Service Role Key를 사용하므로 RLS를 우회합니다
- 더미 데이터 생성 전에 필요한 메타데이터(테넌트, 교육과정, 교과 그룹, 과목)가 DB에 존재해야 합니다
- PGRST205 스키마 캐시 에러가 발생하면 Supabase Dashboard에서 스키마를 다시 로드해야 합니다

---

**작업 일자**: 2025-01-31  
**작업자**: AI Assistant  
**관련 이슈**: `student_school_scores` 테이블 삭제 후 `student_internal_scores`로 통합

