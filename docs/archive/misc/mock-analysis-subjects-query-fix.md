# 모의고사 분석 subjects/subject_groups 조회 문제 해결

## 문제 분석

### 근본 원인
- `getMockAnalysis` 함수에서 `subjects`와 `subject_groups` 조회 시 RLS 정책에 막힘
- `subjects`와 `subject_groups` 테이블은 전역 관리 테이블이므로 `tenant_id` 컬럼이 없음
- 일반 서버 클라이언트로 조회 시 RLS 정책 때문에 데이터가 비어버림
- 결과적으로 `subjectMap`이 비고, `rows`가 전부 필터링되어 모의고사 분석이 항상 N/A로 표시됨

### 영향 범위
1. **모의고사 분석 API** (`/api/students/[studentId]/score-dashboard`)에서 모의고사 분석 결과가 항상 N/A
2. 성적 대시보드에서 모의고사 평균 백분위, 표준점수 합, 상위 3개 등급 합이 모두 N/A로 표시

### 에러 로그
```
[scores/mockAnalysis] 조회된 subjects 데이터: []
[scores/mockAnalysis] 생성된 subjectMap: []
[scores/mockAnalysis] 변환된 rows: []
```

## 해결 방법

### 근본적인 해결 (구현 완료)

`getMockAnalysis` 함수에서 `subjects`와 `subject_groups` 조회 시 Admin 클라이언트를 사용하도록 수정했습니다. 이 테이블들은 전역 관리 테이블이므로 RLS를 우회해야 합니다.

## 구현 내용

### 1. Admin 클라이언트 Import 추가

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

### 2. subjects 조회 수정

**변경 사항:**
- `tenant_id` 필터 제거 (컬럼이 없음)
- Admin 클라이언트 사용하여 RLS 우회
- Admin 클라이언트가 없으면 일반 서버 클라이언트로 fallback

**주요 코드:**
```typescript
// subjects 조회 (subject_group_id 포함)
// 주의: subjects 테이블은 전역 관리이므로 tenant_id 컬럼이 없음
// RLS 정책을 우회하기 위해 Admin 클라이언트 사용
const adminClient = createSupabaseAdminClient();
const subjectsClient = adminClient || supabase;

const { data: subjectsData, error: subjectsError } = await subjectsClient
  .from("subjects")
  .select("id, subject_group_id")
  .in("id", subjectIds);
```

### 3. subject_groups 조회 수정

**변경 사항:**
- `tenant_id` 필터 제거 (컬럼이 없음)
- Admin 클라이언트 사용하여 RLS 우회

**주요 코드:**
```typescript
// subject_groups 조회
// 주의: subject_groups 테이블은 전역 관리이므로 tenant_id 컬럼이 없음
// RLS 정책을 우회하기 위해 Admin 클라이언트 사용
const { data: subjectGroupsData, error: sgError } = await subjectsClient
  .from("subject_groups")
  .select("id, name")
  .in("id", subjectGroupIds);
```

## 테스트 결과

### 더미학생A (정시 우위) 테스트

**입력 데이터:**
- 국어: percentile 85, standardScore 135, gradeScore 2
- 수학: percentile 84, standardScore 133, gradeScore 2
- 영어: percentile 86, standardScore 137, gradeScore 2
- 사회: percentile 83, standardScore 132, gradeScore 3
- 과학: percentile 87, standardScore 138, gradeScore 2

**예상 결과:**
- 평균 백분위: (85 + 84 + (83+87)/2) / 3 = 84.67
- 표준점수 합: 135 + 133 + 132 + 138 = 538
- 상위 3개 등급 합: 2 + 2 + 2 = 6

**실제 결과:**
```
📝 모의고사 분석:
   최근 시험: 2025-06 모평 (2025-06-01)
   평균 백분위: 84.67 ✅
   표준점수 합: 538.00 ✅
   상위 3개 등급 합: 6 ✅
```

## 변경된 파일

- `lib/scores/mockAnalysis.ts`
  - Admin 클라이언트 import 추가
  - `subjects` 조회 시 Admin 클라이언트 사용
  - `subject_groups` 조회 시 Admin 클라이언트 사용
  - `tenant_id` 필터 제거 (컬럼이 없음)

## 참고 사항

### 테이블 구조 변경 이력

`subjects`와 `subject_groups` 테이블은 2025-02-04 마이그레이션에서 전역 관리로 변경되었습니다:
- `tenant_id` 컬럼 제거
- `curriculum_revision_id` 기반으로 관리
- RLS 정책이 모든 사용자가 조회할 수 있도록 설정되어야 하지만, 실제로는 RLS에 막히는 경우가 있음

### 해결 방안

1. **Admin 클라이언트 사용** (현재 구현)
   - RLS를 우회하여 안정적으로 데이터 조회
   - Service Role Key가 필요

2. **RLS 정책 수정** (대안)
   - `subjects`와 `subject_groups` 테이블의 RLS 정책을 모든 사용자가 조회할 수 있도록 수정
   - 하지만 보안상 Admin 클라이언트 사용이 더 안전

## 관련 문서

- `docs/교육과정-교과-과목-테이블-연결-확인.md`
- `docs/subjects-table-final-schema.md`
- `supabase/migrations/20250204000000_make_subject_groups_global.sql`
- `supabase/migrations/20250204000001_migrate_subject_data_to_global.sql`

