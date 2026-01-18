# 플랜 생성 시 교재 조회 RLS 정책 위반 문제 해결

## 문제 분석

### 근본 원인
- `_generatePlansFromGroup` 함수에서 교재/강의 조회 시 일반 서버 클라이언트 사용
- Admin/Consultant가 다른 학생의 교재를 조회할 때 RLS 정책에 막힘
- Step 6에서 교재 복사는 성공했지만, 플랜 생성 시 조회에서 실패

### 에러 로그
```
[Error] Referenced book (a366d6bd-1ece-4b09-8a52-014f4100c21c) does not exist for student (6d1cff5e-fa9f-4811-8d7f-44f75850b62b)
```

### 문제 흐름
1. Step 6에서 교재 복사 성공 → `plan_contents`에 복사된 학생 교재 ID 저장
2. 플랜 생성 시 `_generatePlansFromGroup`에서 교재 조회 시도
3. 일반 서버 클라이언트로 조회 → RLS 정책 때문에 실패
4. Admin 액션에서 호출될 때는 다른 학생의 교재를 조회하려고 하므로 실패

## 해결 방법

### 근본적인 해결 (구현 완료)

`_generatePlansFromGroup` 함수에서 Admin/Consultant가 다른 학생의 교재/강의를 조회할 때는 Admin 클라이언트를 사용하도록 수정했습니다.

## 구현 내용

### 1. Admin 클라이언트 Import 추가

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

### 2. 교재/강의 조회 클라이언트 결정 로직 추가

**변경 사항:**
- Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용
- 학생이 자신의 콘텐츠를 조회할 때는 일반 서버 클라이언트 사용

**주요 코드:**
```typescript
// Admin/Consultant가 다른 학생의 교재를 조회할 때는 Admin 클라이언트 사용
const isAdminOrConsultant = role === "admin" || role === "consultant";
const isOtherStudent = isAdminOrConsultant && studentId !== user.userId;
const bookQueryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

if (isOtherStudent && !bookQueryClient) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}
```

### 3. 교재 조회 로직 수정

**변경 사항:**
- 교재 조회 시 `bookQueryClient` 사용
- 마스터 교재로 학생 교재 찾기 시 `bookQueryClient` 사용
- 복사된 교재 조회 시 `bookQueryClient` 사용

**주요 코드:**
```typescript
// 학생 교재 조회
let studentBook = await bookQueryClient
  .from("books")
  .select("id, total_pages, master_content_id")
  .eq("id", finalContentId)
  .eq("student_id", studentId)
  .maybeSingle();

// 마스터 교재로 학생 교재 찾기
const { data: studentBookByMaster } = await bookQueryClient
  .from("books")
  .select("id, total_pages, master_content_id")
  .eq("student_id", studentId)
  .eq("master_content_id", finalContentId)
  .maybeSingle();

// 복사된 교재 조회
const { data: copiedBook } = await bookQueryClient
  .from("books")
  .select("id, total_pages, master_content_id")
  .eq("id", bookId)
  .eq("student_id", studentId)
  .maybeSingle();
```

### 4. 강의 조회 로직 수정

동일한 방식으로 강의 조회도 `bookQueryClient` 사용하도록 수정했습니다.

## 테스트 시나리오

1. ✅ Admin 액션에서 다른 학생의 교재 조회 성공 확인
2. ✅ 학생 액션에서 자신의 교재 조회 성공 확인
3. ✅ 마스터 교재로 학생 교재 찾기 성공 확인
4. ✅ 복사된 교재 조회 성공 확인

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 콘텐츠를 조회할 때만 Admin 클라이언트 사용
- 학생이 자신의 콘텐츠를 조회할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/plans.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션

## 변경 이력

- 2025-11-26: 플랜 생성 시 교재 조회 RLS 정책 위반 문제 해결을 위해 Admin 클라이언트 사용으로 변경

