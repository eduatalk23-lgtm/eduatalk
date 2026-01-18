# testScoreDashboard 스크립트 - student_terms 테이블 적용

## 작업 개요

`scripts/testScoreDashboard.ts` 파일에서 학생별 학기 조회 부분을 현재 Supabase 스키마 기준으로 수정했습니다.

**작업 일자**: 2025-01-31  
**작업 파일**: `scripts/testScoreDashboard.ts`

---

## 변경 사항

### 1. 테이블 변경

**이전**: `student_school_scores` 테이블 사용
```typescript
const { data: scores } = await supabase
  .from("student_school_scores")
  .select("grade, semester")
  .eq("student_id", student.id)
  .order("grade", { ascending: false })
  .order("semester", { ascending: false })
  .limit(1);
```

**변경 후**: `student_terms` 테이블 사용
```typescript
const { data: termData, error: termError } = await supabase
  .from("student_terms")
  .select("id, school_year, grade, semester")
  .eq("tenant_id", student.tenant_id)
  .eq("student_id", student.id)
  .order("school_year", { ascending: false })
  .order("semester", { ascending: false })
  .limit(1);
```

### 2. 쿼리 조건 개선

- `tenant_id` 조건 추가: 각 테넌트별로 학기 정보를 정확히 조회
- 정렬 순서: `school_year DESC, semester DESC`로 최신 학기 우선 조회
- 조회 필드: `id, school_year, grade, semester` 포함

### 3. 출력 형식 개선

**이전**: 
```
- 학기: 2학년 1학기
```

**변경 후**:
```
- 학기: 2025년 2학년 1학기 (Term ID: 671cc1d0-5ed1-4326-9e3c-1f10bc6e63ef)
```

또는 학기 정보가 없는 경우:
```
- 학기: 학기 정보 없음
```

### 4. 새로운 함수 추가

`getStudentTermInfo()` 함수를 추가하여 특정 학생의 학기 정보를 조회할 수 있도록 했습니다:

```typescript
async function getStudentTermInfo(studentId: string, tenantId: string) {
  // student_terms 테이블에서 최신 학기 정보 조회
  // 반환: { id, school_year, grade, semester } | null
}
```

### 5. 메인 함수 개선

- 학기 정보를 먼저 조회하여 표시
- `grade`와 `semester`가 제공되지 않았을 경우, `student_terms`에서 조회한 정보를 자동으로 사용

---

## student_terms 테이블 구조

```typescript
{
  id: string;                    // PK
  tenant_id: string;             // FK → tenants.id
  student_id: string;            // FK → students.id
  school_year: number;           // 학년도 (예: 2025)
  grade: number;                 // 학년 (1~3)
  semester: number;              // 학기 (1~2)
  curriculum_revision_id: string; // FK → curriculum_revisions
  class_name: string | null;     // 반 이름
  homeroom_teacher: string | null; // 담임교사 이름
  notes: string | null;          // 비고
  created_at: string;
  updated_at: string;
}
```

---

## 사용 방법

### 1. 학생 목록 조회 (인자 없이 실행)

```bash
npx tsx scripts/testScoreDashboard.ts
```

출력 예시:
```
📋 사용 가능한 학생 목록 (최근 10명):

  👤 더미학생1 (ID: fd0854f1-1f6a-45bb-9743-5c389e754caf)
     - Tenant ID: 84b71a5d-5681-4da3-88d2-91e75ef89015
     - 학기: 2025년 2학년 1학기 (Term ID: 671cc1d0-5ed1-4326-9e3c-1f10bc6e63ef)
     - 테스트 명령어:
       npx tsx scripts/testScoreDashboard.ts fd0854f1-1f6a-45bb-9743-5c389e754caf 84b71a5d-5681-4da3-88d2-91e75ef89015 2 1
```

### 2. 특정 학생 테스트 (studentId, tenantId만 제공)

```bash
npx tsx scripts/testScoreDashboard.ts fd0854f1-1f6a-45bb-9743-5c389e754caf 84b71a5d-5681-4da3-88d2-91e75ef89015
```

- `student_terms` 테이블에서 자동으로 최신 학기 정보를 조회하여 사용
- 학기 정보가 있으면: "2025년 2학년 1학기 (Term ID: ...)" 형태로 출력
- 학기 정보가 없으면: "학기 정보 없음" 출력

### 3. 특정 학생 테스트 (grade, semester 명시)

```bash
npx tsx scripts/testScoreDashboard.ts fd0854f1-1f6a-45bb-9743-5c389e754caf 84b71a5d-5681-4da3-88d2-91e75ef89015 2 1
```

---

## 테스트 데이터

다음 테스트 데이터를 사용하여 확인할 수 있습니다:

- **student_id**: `fd0854f1-1f6a-45bb-9743-5c389e754caf`
- **tenant_id**: `84b71a5d-5681-4da3-88d2-91e75ef89015`
- **term_id**: `671cc1d0-5ed1-4326-9e3c-1f10bc6e63ef`
- **school_year**: `2025`
- **grade**: `2`
- **semester**: `1`

예상 출력:
```
✅ 학기 정보: 2025년 2학년 1학기 (Term ID: 671cc1d0-5ed1-4326-9e3c-1f10bc6e63ef)
```

---

## SQL 쿼리 컨셉

실제 사용되는 Supabase 쿼리는 다음과 같습니다:

```sql
SELECT id, school_year, grade, semester
FROM public.student_terms
WHERE tenant_id = $tenantId
  AND student_id = $studentId
ORDER BY school_year DESC, semester DESC
LIMIT 1;
```

---

## 주요 개선 사항

1. ✅ **정확한 테이블 사용**: `student_terms` 테이블로 변경하여 학기 정보를 정확히 조회
2. ✅ **tenant_id 조건 추가**: 멀티 테넌트 환경에서 정확한 데이터 조회
3. ✅ **출력 형식 개선**: 학년도와 Term ID를 포함한 상세 정보 표시
4. ✅ **자동 학기 정보 조회**: grade/semester가 없어도 자동으로 조회하여 사용
5. ✅ **에러 처리 개선**: 학기 정보 조회 실패 시 명확한 메시지 표시

---

## 관련 파일

- `scripts/testScoreDashboard.ts` - 수정된 스크립트 파일
- `lib/supabase/database.types.ts` - `student_terms` 테이블 타입 정의

---

## 참고 사항

- `student_terms` 테이블은 학생의 학기별 정보를 관리하는 정규화된 테이블입니다
- 한 학생이 여러 학기 정보를 가질 수 있으므로, 최신 학기를 조회하기 위해 `ORDER BY school_year DESC, semester DESC LIMIT 1`을 사용합니다
- `tenant_id` 조건은 멀티 테넌트 환경에서 데이터 격리를 위해 필수입니다

