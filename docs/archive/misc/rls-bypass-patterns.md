# RLS 우회 패턴 가이드

## 개요

이 문서는 Supabase RLS(Row Level Security) 정책을 우회해야 하는 시나리오와 올바른 패턴을 설명합니다.

## RLS 우회가 필요한 시나리오

### 1. 관리자/컨설턴트가 다른 학생의 데이터 조회

**시나리오**:
- 관리자 또는 컨설턴트가 다른 학생의 플랜, 콘텐츠, 블록 세트 등을 조회할 때
- 일반 서버 클라이언트는 RLS 정책에 의해 자신의 데이터만 조회 가능
- 다른 학생의 데이터를 조회하려면 Admin 클라이언트(Service Role Key) 사용 필요

**예시**:
- 캠프 모드에서 관리자가 학생의 플랜 그룹을 검토할 때
- 관리자가 학생의 교재/강의 목록을 조회할 때
- 관리자가 학생의 블록 세트를 조회할 때

### 2. 관리자/컨설턴트가 다른 학생의 데이터 생성/수정

**시나리오**:
- 관리자 또는 컨설턴트가 다른 학생을 대신하여 플랜을 생성할 때
- 데이터베이스 트리거/함수에서 교재 존재 여부를 확인하는데, 일반 클라이언트로는 조회 실패

**예시**:
- 캠프 모드에서 관리자가 학생의 플랜을 생성할 때
- 관리자가 학생의 교재를 복사할 때

## 올바른 패턴

### 패턴 1: 클라이언트 선택 헬퍼 사용

**권장 방법**: `lib/supabase/clientSelector.ts`의 헬퍼 함수 사용

```typescript
import { selectClientForContentQuery } from "@/lib/supabase/clientSelector";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

// 콘텐츠 조회 시
const { role, userId } = await getCurrentUserRole();
const isAdminOrConsultant = role === "admin" || role === "consultant";
const queryClient = await selectClientForContentQuery(
  studentId,
  userId || "",
  isAdminOrConsultant
);

const { data: books } = await queryClient
  .from("books")
  .select("*")
  .eq("student_id", studentId);
```

**사용 가능한 헬퍼 함수**:
- `selectClientForStudentQuery`: 일반적인 학생 데이터 조회
- `selectClientForPlanGeneration`: 플랜 생성 작업
- `selectClientForContentQuery`: 콘텐츠(교재/강의) 조회
- `selectClientForBlockSetQuery`: 블록 세트 조회

### 패턴 2: 권한 검증 헬퍼 사용

**권장 방법**: `lib/auth/planGroupAuth.ts`의 헬퍼 함수 사용

```typescript
import {
  getClientForPlanOperation,
  isOtherStudent,
  canBypassStatusCheck,
} from "@/lib/auth/planGroupAuth";

// 플랜 생성 시 클라이언트 선택
const access = await verifyPlanGroupAccess();
const studentId = getStudentIdForPlanGroup(group, access.user.userId, access.role);
const planClient = await getClientForPlanOperation(
  studentId,
  access.user.userId,
  access.role
);

// 상태 체크 우회 여부 확인
const bypassStatus = canBypassStatusCheck(access.role, group.plan_type);

// 다른 학생인지 확인
const isOther = isOtherStudent(studentId, access.user.userId, access.role);
```

### 패턴 3: 직접 Admin 클라이언트 사용 (최후의 수단)

**주의**: 가능한 한 헬퍼 함수를 사용하세요. 직접 사용은 특수한 경우에만 권장됩니다.

```typescript
import { ensureAdminClient } from "@/lib/supabase/clientSelector";

// Admin 클라이언트 사용 (RLS 우회)
const adminClient = ensureAdminClient();
const { data } = await adminClient
  .from("books")
  .select("*")
  .eq("student_id", studentId);
```

## 권한 검증 체크리스트

플랜 생성/조회 작업을 구현할 때 다음을 확인하세요:

### 1. 권한 검증
- [ ] `verifyPlanGroupAccess()` 또는 `getCurrentUserRole()`로 권한 확인
- [ ] 관리자/컨설턴트 권한도 허용하는지 확인

### 2. 클라이언트 선택
- [ ] 적절한 클라이언트 선택 헬퍼 함수 사용
- [ ] 다른 학생의 데이터를 조회하는 경우 Admin 클라이언트 사용

### 3. 상태 체크
- [ ] 캠프 모드 또는 관리자 권한인 경우 상태 체크 우회
- [ ] `canBypassStatusCheck()` 또는 `shouldBypassStatusCheck()` 사용

### 4. 에러 처리
- [ ] Admin 클라이언트 생성 실패 시 명확한 에러 메시지
- [ ] RLS 정책 위반 에러(42501) 발생 시 적절한 처리

## 안티패턴 (피해야 할 것들)

### ❌ 직접 Admin 클라이언트 생성

```typescript
// 나쁜 예: 직접 Admin 클라이언트 생성
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const adminClient = createSupabaseAdminClient();
if (!adminClient) {
  // 에러 처리 없음
}
```

**문제점**:
- 에러 처리가 일관되지 않음
- 권한 검증 로직이 중복됨
- 유지보수가 어려움

### ❌ 권한 검증 없이 Admin 클라이언트 사용

```typescript
// 나쁜 예: 권한 검증 없이 사용
const adminClient = ensureAdminClient();
const { data } = await adminClient.from("books").select("*");
```

**문제점**:
- 보안 위험
- 권한이 없는 사용자도 데이터 접근 가능

### ❌ 하드코딩된 권한 체크

```typescript
// 나쁜 예: 하드코딩된 권한 체크
if (user.role === "admin" || user.role === "consultant") {
  const adminClient = createSupabaseAdminClient();
  // ...
}
```

**문제점**:
- 로직이 여러 곳에 중복됨
- 일관성 없는 권한 체크

## 관련 문서

- [플랜 INSERT 시 RLS 정책 위반 문제 해결](./plan-insert-rls-fix.md)
- [플랜 생성 시 교재 조회 RLS 정책 위반 문제 해결](./plan-generation-book-query-rls-fix.md)
- [RLS 정책 위반 교재 복사 문제 해결](./rls-policy-violation-fix.md)
- [관리자 페이지 '남은 단계 진행하기' RLS 문제 해결](./admin-camp-continue-rls-fix-2025-11-27.md)

## 참고

- Supabase RLS 정책은 일반적으로 사용자가 자신의 데이터만 조회할 수 있도록 제한합니다.
- 관리자/컨설턴트가 다른 학생의 데이터를 조회하려면 Service Role Key를 사용한 Admin 클라이언트가 필요합니다.
- Admin 클라이언트는 RLS를 우회하므로 보안에 주의해야 합니다.
- 가능한 한 헬퍼 함수를 사용하여 일관된 패턴을 유지하세요.

