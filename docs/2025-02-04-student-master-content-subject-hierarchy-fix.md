# 학생 페이지 교과/과목 드롭다운 표시 문제 해결

## 📋 문제 상황

학생 페이지의 마스터 콘텐츠 검색 필터에서 개정교육과정 드롭다운 문제 해결 후, 교과(subject_group)와 과목(subject) 드롭다운도 동일한 문제가 있는 것으로 확인되었습니다.

- 교과 드롭다운: "전체"만 표시되고 실제 데이터가 보이지 않음
- 과목 드롭다운: "전체"만 표시되고 실제 데이터가 보이지 않음

## 🔍 원인 분석

### 1. API 라우트에서 공개 클라이언트 사용
학생 페이지의 `HierarchicalFilter` 컴포넌트는 API 라우트를 호출하여 교과와 과목을 조회하는데, API 라우트에서 `createSupabasePublicClient()`를 사용하고 있었습니다.

**문제점:**
- 공개 클라이언트는 RLS(Row Level Security) 정책의 영향을 받습니다
- `subject_groups` 및 `subjects` 테이블에 RLS가 활성화되어 있으면 데이터가 조회되지 않을 수 있습니다

**기존 코드:**
```typescript
// app/api/subject-groups/route.ts
const supabase = createSupabasePublicClient();
const { data: groups, error } = await supabase
  .from("subject_groups")
  .select("*");
```

### 2. 관리자 페이지와 다른 방식 사용
관리자 페이지에서는 `lib/data/subjects.ts`의 함수를 사용하는데, 이 함수들은 Admin 클라이언트를 우선 사용하여 RLS를 우회합니다.

## ✅ 해결 방법

### 1. API 라우트에서 통일된 함수 사용
학생 페이지의 API 라우트도 관리자 페이지와 동일하게 `lib/data/subjects.ts`의 함수를 사용하도록 변경했습니다.

**변경 전:**
```typescript
// app/api/subject-groups/route.ts
const supabase = createSupabasePublicClient();
const { data: groups, error } = await supabase
  .from("subject_groups")
  .select("*");
```

**변경 후:**
```typescript
// app/api/subject-groups/route.ts
import { getSubjectGroups, getSubjectGroupsWithSubjects } from "@/lib/data/subjects";

const groups = await getSubjectGroups(curriculumRevisionId);
// 또는
const groupsWithSubjects = await getSubjectGroupsWithSubjects(curriculumRevisionId);
```

### 2. Admin 클라이언트 우선 사용
`lib/data/subjects.ts`의 함수들은 Admin 클라이언트를 우선 사용하여 RLS를 우회합니다:

```typescript
// lib/data/subjects.ts
export async function getSubjectGroups(curriculumRevisionId?: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();
  // ...
}
```

### 3. 디버깅 로그 추가
데이터 조회 상태를 확인할 수 있도록 디버깅 로그를 추가했습니다.

## 📝 변경된 파일

### 1. `app/api/subject-groups/route.ts`
- `createSupabasePublicClient()` 제거
- `lib/data/subjects.ts`의 `getSubjectGroups()`, `getSubjectGroupsWithSubjects()` 함수 사용
- 디버깅 로그 추가

### 2. `app/api/subjects/route.ts`
- `lib/data/contentMasters.ts`의 `getSubjectsForFilter()` 대신
- `lib/data/subjects.ts`의 `getSubjectsByGroup()` 함수 사용
- 디버깅 로그 추가

## 🎯 기대 효과

1. 학생 페이지에서도 교과와 과목 드롭다운에 실제 데이터가 표시됩니다
2. 관리자 페이지와 학생 페이지가 동일한 함수를 사용하여 일관성이 향상됩니다
3. RLS 정책 문제로 인한 데이터 조회 실패 문제가 해결됩니다

## 📌 참고 사항

- 교과와 과목 조회는 계층형 구조입니다:
  1. 개정교육과정 선택 → 교과 목록 조회
  2. 교과 선택 → 과목 목록 조회
- API 라우트를 통해 클라이언트 컴포넌트에서 데이터를 조회합니다
- Admin 클라이언트를 우선 사용하여 RLS를 우회하므로 안정적으로 데이터를 조회할 수 있습니다

---

**작성일**: 2025-02-04
**관련 이슈**: 학생 페이지 교과/과목 드롭다운 표시 문제

