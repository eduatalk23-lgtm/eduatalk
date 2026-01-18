# RLS 정책 위반 교재 복사 문제 해결

## 문제 분석

### 근본 원인
- `copyMasterBookToStudent`와 `copyMasterLectureToStudent` 함수가 `createSupabaseServerClient()`를 사용하여 RLS 정책에 막힘
- 일반 서버 클라이언트는 RLS 정책을 따르므로, 학생을 대신하여 교재를 복사할 권한이 없음

### 영향 범위
1. **Admin 액션** (`campTemplateActions.ts`)에서 교재 복사 실패
2. **학생 액션** (`plan-groups/plans.ts`)에서 교재 복사 실패
3. 복사 실패 후에도 `plan_contents`에 마스터 교재 ID가 저장되어 플랜 생성 시 에러 발생

### 에러 로그
```
[data/contentMasters] 교재 복사 실패 {
  code: '42501',
  message: 'new row violates row-level security policy for table "books"'
}
```

## 해결 방법

### 근본적인 해결 (구현 완료)

`copyMasterBookToStudent`와 `copyMasterLectureToStudent` 함수를 Admin 클라이언트를 사용하도록 수정했습니다. 이 함수들은 관리자가 학생을 위해 콘텐츠를 복사하는 작업이므로 RLS를 우회해야 합니다.

## 구현 내용

### 1. Admin 클라이언트 Import 추가

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

### 2. copyMasterBookToStudent 함수 수정

**변경 사항:**
- `createSupabaseServerClient()` → `createSupabaseAdminClient()` 사용
- Admin 클라이언트 생성 실패 시 명확한 에러 메시지 제공
- RLS 정책 위반 에러(42501) 발생 시 구체적인 에러 메시지 제공
- 상세한 에러 로깅 추가

**주요 코드:**
```typescript
export async function copyMasterBookToStudent(
  bookId: string,
  studentId: string,
  tenantId: string
): Promise<{ bookId: string }> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }
  // ... 나머지 로직
}
```

### 3. copyMasterLectureToStudent 함수 수정

동일한 방식으로 Admin 클라이언트 사용하도록 수정했습니다.

### 4. 에러 처리 개선

**개선 사항:**
- Admin 클라이언트 생성 실패 시 명확한 에러 메시지
- RLS 정책 위반 에러(42501) 발생 시 구체적인 에러 메시지
- 에러 로깅에 상세 정보 추가 (bookId, studentId, tenantId, error code, details, hint)

**에러 처리 예시:**
```typescript
if (error) {
  console.error("[data/contentMasters] 교재 복사 실패", {
    bookId,
    studentId,
    tenantId,
    error: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  throw new Error(
    error.code === "42501"
      ? "RLS 정책 위반: 교재 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
      : error.message || "교재 복사에 실패했습니다."
  );
}
```

## 테스트 시나리오

1. ✅ Admin 액션에서 마스터 교재 복사 성공 확인
2. ✅ 학생 액션에서 마스터 교재 복사 성공 확인
3. ✅ 이미 복사된 교재가 있는 경우 중복 체크 동작 확인
4. ✅ Admin 클라이언트 생성 실패 시 적절한 에러 처리 확인

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 이 함수들은 서버 사이드에서만 호출되어야 함 (이미 Server Action에서만 사용 중)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `lib/data/contentMasters.ts` - 수정된 함수들
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션
- `app/(student)/actions/plan-groups/plans.ts` - 호출하는 학생 액션

## 변경 이력

- 2025-11-26: RLS 정책 위반 문제 해결을 위해 Admin 클라이언트 사용으로 변경

