# 성적 대시보드 통합 페이지 학생 정보 조회 수정

## 작업 일시
2025-11-28

## 문제 상황

`/scores/dashboard/unified` 페이지에서 다음 두 가지 문제가 발생했습니다:

1. **학생 정보 조회 실패**: "학생 정보를 찾을 수 없습니다" 메시지가 표시됨
2. **404 에러**: "학생 설정하기" 버튼 클릭 시 `/student-setup` 페이지로 이동하려 하지만 해당 페이지가 존재하지 않음

## 원인 분석

### 1. 잘못된 컬럼명 사용

**파일**: `app/(student)/scores/dashboard/unified/page.tsx` (56번째 줄)

```typescript
// ❌ 잘못된 쿼리
const { data: student } = await supabase
  .from("students")
  .select("id, grade")
  .eq("user_id", user.id)  // students 테이블에 user_id 컬럼은 없음
  .eq("tenant_id", tenantId)
  .single();
```

**문제점**:
- `students` 테이블의 `id` 컬럼이 `auth.users.id`와 직접 매칭됨
- `user_id`라는 컬럼은 존재하지 않아 항상 조회 실패
- 다른 페이지들(`lib/data/students.ts`, `app/(student)/dashboard/page.tsx` 등)에서는 모두 `.eq("id", user.id)` 패턴을 사용

### 2. 삭제된 페이지로의 링크

**파일**: `app/(student)/scores/dashboard/unified/page.tsx` (72번째 줄)

```typescript
// ❌ 존재하지 않는 페이지로 링크
<Link href="/student-setup" ...>
```

**문제점**:
- `/student-setup` 페이지는 이전에 제거됨
- 초기 설정은 `/settings` 페이지에서 처리하도록 통합됨
- 관련 문서: `docs/student-setup-mypage-integration.md`

## 해결 방법

### 1. 학생 정보 조회 쿼리 수정

```typescript
// ✅ 수정된 쿼리
const { data: student } = await supabase
  .from("students")
  .select("id, grade")
  .eq("id", user.id)  // 올바른 컬럼명 사용
  .maybeSingle();  // tenant_id 조건 제거 (선택적 필드이므로)
```

**변경 사항**:
- `.eq("user_id", user.id)` → `.eq("id", user.id)`
- `.eq("tenant_id", tenantId)` 조건 제거 (tenant_id는 null일 수 있음)
- `.single()` → `.maybeSingle()` (레코드가 없을 경우 null 반환)

### 2. 링크 경로 수정

```typescript
// ✅ 수정된 링크
<Link href="/settings" ...>
  학생 설정하기
</Link>
```

**변경 사항**:
- `href="/student-setup"` → `href="/settings"`

## 수정된 파일

### `app/(student)/scores/dashboard/unified/page.tsx`

**변경 전**:
```typescript
const { data: student } = await supabase
  .from("students")
  .select("id, grade")
  .eq("user_id", user.id)
  .eq("tenant_id", tenantId)
  .single();

// ...

<Link href="/student-setup" ...>
```

**변경 후**:
```typescript
const { data: student } = await supabase
  .from("students")
  .select("id, grade")
  .eq("id", user.id)
  .maybeSingle();

// ...

<Link href="/settings" ...>
```

## 테스트 시나리오

### 1. 정상 학생 정보 조회
- ✅ 학생 정보가 있는 경우 대시보드 정상 표시
- ✅ 성적 데이터가 정상적으로 로드됨

### 2. 학생 정보 없는 경우
- ✅ "학생 정보를 찾을 수 없습니다" 메시지 표시
- ✅ "학생 설정하기" 버튼 클릭 시 `/settings` 페이지로 이동
- ✅ 설정 페이지에서 학생 정보 입력 가능

## 참고 문서

- `docs/student-setup-mypage-integration.md` - student-setup 페이지 제거 및 마이페이지 통합
- `docs/settings-page-redirect-loop-fix.md` - 설정 페이지 리다이렉트 루프 수정
- `docs/mypage-student-setup-redirect-fix.md` - 마이페이지 접근 시 리다이렉트 문제 해결

## 관련 코드 패턴

프로젝트 내 다른 파일들에서 학생 정보 조회 시 사용하는 패턴:

```typescript
// lib/data/students.ts
export async function getStudentById(studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("...")
    .eq("id", studentId)  // id 컬럼 사용
    .maybeSingle();
}

// app/(student)/dashboard/page.tsx
const { data: student } = await supabase
  .from("students")
  .select("id,name")
  .eq("id", user.id)  // id 컬럼 사용
  .maybeSingle();
```

## 영향 범위

- ✅ 학생 정보 조회 로직이 정상 작동하여 성적 대시보드 페이지 접근 가능
- ✅ 초기 설정이 필요한 사용자가 올바른 페이지로 이동
- ✅ 404 에러 제거

## 추가 개선 사항

향후 고려할 사항:

1. **일관성 검증**: 모든 페이지에서 학생 정보 조회 패턴이 일관되게 사용되는지 확인
2. **에러 핸들링**: 학생 정보 조회 실패 시 더 자세한 에러 메시지 제공
3. **타입 안전성**: `maybeSingle()` 사용 시 null 체크 강화

## 결론

학생 정보 조회 쿼리의 잘못된 컬럼명을 수정하고, 삭제된 페이지로의 링크를 올바른 경로로 변경하여 통합 성적 대시보드 페이지가 정상 작동하도록 수정했습니다.

