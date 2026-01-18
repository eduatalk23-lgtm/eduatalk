# 서버 액션 리팩토링 Phase 1: 구조적 정리 및 응답 패턴 표준화

**작업 일시**: 2025-01-30  
**작업 범위**: 서버 액션의 레거시 파일 정리 및 응답 타입 표준화

---

## 📋 작업 개요

리팩토링 과정에서 발생한 기술 부채와 비일관적인 패턴을 개선하기 위한 첫 번째 단계 작업입니다. 주요 목표는:

1. 레거시 Re-export 파일 정리 (Cleanup)
2. 서버 액션 응답 타입 표준화 (Standardization)

---

## ✅ 완료된 작업

### 1. 레거시 Re-export 파일 정리

#### 삭제된 파일
- `app/actions/scores/mock.ts` → `app/(student)/actions/scoreActions.ts`로 이동됨
- `app/actions/consultingNotes.ts` → `app/(admin)/actions/consultingNoteActions.ts`로 이동됨
- `app/actions/goals.ts` → `app/(student)/actions/goalActions.ts`로 이동됨
- `app/actions/studySessions.ts` → `app/(student)/actions/studySessionActions.ts`로 이동됨

#### Import 경로 업데이트
- `app/(student)/today/_components/AttachGoalButton.tsx`
  - `@/app/actions/goals` → `@/app/(student)/actions/goalActions`
- `app/(admin)/admin/students/[id]/_components/ConsultingNotesForm.tsx`
  - `@/app/actions/consultingNotes` → `@/app/(admin)/actions/consultingNoteActions`

### 2. ActionResponse 타입 개선

**파일**: `lib/types/actionResponse.ts`

기존 타입에 `fieldErrors` 필드를 추가하여 Zod 검증 에러 등을 지원하도록 개선했습니다.

```typescript
export type ActionResponse<T = void> = 
  | {
      success: true;
      data?: T;
      message?: string;
    }
  | {
      success: false;
      error?: string;
      validationErrors?: Record<string, string[]>;
      fieldErrors?: Record<string, string[]>; // validationErrors의 alias (Zod 검증 에러 등)
      message?: string;
    };
```

### 3. 서버 액션 표준 응답 패턴 적용

#### `app/actions/auth.ts`

**변경된 함수들**:
- `signUp`: `ActionResponse<{ redirect: string }>` 타입으로 변경
  - Zod 검증 에러 시 `fieldErrors` 포함
  - `createSuccessResponse`, `createErrorResponse` 헬퍼 함수 사용
- `resendConfirmationEmail`: `ActionResponse` 타입으로 변경
  - 기존 `{ success: boolean, error?: string, message?: string }` 형태를 표준 타입으로 통일

**유지된 함수들**:
- `signIn`: 특수한 경우 (이메일 미인증 시 객체 반환, 성공 시 redirect)로 인해 기존 구조 유지

#### `app/actions/tenants.ts`

**변경된 함수**:
- `getTenantOptionsForSignup`: `ActionResponse<TenantOption[]>` 타입으로 변경
  - 기존 `TenantOption[]` 반환에서 표준 응답 타입으로 변경
  - 에러 발생 시 빈 배열 대신 `createErrorResponse` 사용

#### `app/actions/userRole.ts`

**변경된 함수**:
- `changeUserRole`: `ActionResponse` 타입으로 변경
  - 기존 `{ success: boolean, error?: string }` 형태를 표준 타입으로 통일
  - 모든 에러 반환을 `createErrorResponse`로 통일

### 4. 클라이언트 컴포넌트 업데이트

#### `app/signup/page.tsx`
- `signUp` 액션의 응답 타입 변경에 맞춰 `ActionResponse<{ redirect: string }>` 처리
- `getTenantOptionsForSignup` 응답 처리 로직 업데이트
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용

#### `app/login/_components/ResendEmailButton.tsx`
- `resendConfirmationEmail` 응답 처리 로직 업데이트
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용

#### `app/(parent)/parent/settings/_components/RoleChangeSection.tsx`
- `changeUserRole` 응답 처리 로직 업데이트
- `isSuccessResponse`, `isErrorResponse` 타입 가드 사용

---

## 📊 변경 통계

### 수정된 파일
- **서버 액션**: 3개 파일
  - `app/actions/auth.ts`
  - `app/actions/tenants.ts`
  - `app/actions/userRole.ts`
- **클라이언트 컴포넌트**: 3개 파일
  - `app/signup/page.tsx`
  - `app/login/_components/ResendEmailButton.tsx`
  - `app/(parent)/parent/settings/_components/RoleChangeSection.tsx`
- **타입 정의**: 1개 파일
  - `lib/types/actionResponse.ts`
- **Import 경로 업데이트**: 2개 파일
  - `app/(student)/today/_components/AttachGoalButton.tsx`
  - `app/(admin)/admin/students/[id]/_components/ConsultingNotesForm.tsx`

### 삭제된 파일
- 4개 레거시 re-export 파일

---

## 🔍 주요 개선 사항

### 1. 타입 안전성 향상
- 모든 서버 액션이 일관된 `ActionResponse` 타입 사용
- Discriminated union을 통한 타입 가드 활용
- 클라이언트에서 타입 안전한 에러 처리

### 2. 코드 일관성
- 모든 서버 액션이 동일한 응답 구조 사용
- `createSuccessResponse`, `createErrorResponse` 헬퍼 함수로 일관된 응답 생성
- Zod 검증 에러를 `fieldErrors`로 명확하게 전달

### 3. 유지보수성 향상
- 응답 구조 변경 시 한 곳만 수정 (`lib/types/actionResponse.ts`)
- 레거시 re-export 파일 제거로 import 경로 명확화
- 실제 구현 위치로 직접 import하여 의존성 명확화

### 4. 개발자 경험 개선
- 헬퍼 함수로 간편한 응답 생성
- 타입 가드 함수로 안전한 응답 처리
- 명확한 에러 메시지 및 필드별 검증 에러 지원

---

## ⚠️ 주의사항

### `signIn` 함수의 특수성
`signIn` 함수는 다음 이유로 표준 응답 패턴을 적용하지 않았습니다:
1. 이메일 미인증 시 특수한 객체 반환 (`{ error, needsEmailVerification, email }`)
2. 성공 시 `redirect()` 호출로 인한 반환값 없음

이러한 특수한 경우는 기존 구조를 유지하는 것이 적절합니다.

### 비즈니스 로직 보존
- 모든 비즈니스 로직은 변경하지 않았습니다
- 구조와 반환 타입만 변경했습니다
- Admin 클라이언트를 사용하는 RLS 우회 로직은 그대로 유지했습니다

---

## 🧪 테스트 권장 사항

다음 시나리오에 대한 테스트를 권장합니다:

1. **회원가입 플로우**
   - 정상 회원가입
   - 검증 에러 (Zod validation)
   - 약관 미동의
   - 기관 목록 로드 실패

2. **이메일 재발송**
   - 정상 재발송
   - 이미 인증된 계정
   - 서버 에러

3. **권한 변경**
   - 학생 → 학부모 전환
   - 학부모 → 학생 전환
   - 권한 변경 실패 시나리오

4. **기관 목록 조회**
   - 정상 조회
   - Admin 클라이언트 생성 실패
   - 데이터베이스 에러

---

## 📝 다음 단계 (Phase 2 예정)

1. 나머지 서버 액션들의 표준 응답 패턴 적용
2. 에러 핸들링 유틸리티 개선 (`withErrorHandling` 등)
3. 클라이언트 컴포넌트의 에러 처리 패턴 통일
4. 문서화 및 가이드라인 작성

---

## 🔗 관련 파일

- `lib/types/actionResponse.ts` - 표준 응답 타입 정의
- `app/actions/auth.ts` - 인증 관련 서버 액션
- `app/actions/tenants.ts` - 기관 관련 서버 액션
- `app/actions/userRole.ts` - 사용자 권한 관련 서버 액션

