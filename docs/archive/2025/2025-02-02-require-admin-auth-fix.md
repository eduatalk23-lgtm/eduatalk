# requireAdminAuth 모듈 누락 에러 수정

## 작업 일시
2025-02-02

## 문제 상황

빌드 에러 발생:
```
Module not found: Can't resolve '@/lib/auth/requireAdminAuth'
```

`app/(admin)/actions/tenantUsers.ts`와 `app/(admin)/actions/schedulerSettings.ts`에서 `requireAdminAuth` 함수를 import하려고 했지만, 해당 파일이 존재하지 않았습니다.

## 원인 분석

1. `lib/auth/` 디렉토리에는 다음 파일들이 존재:
   - `requireStudentAuth.ts` - 학생 인증 헬퍼
   - `guards.ts` - `requireAdminOrConsultant` 함수 포함 (admin 또는 consultant 허용)
   - 기타 인증 관련 파일들

2. 하지만 `requireAdminAuth.ts` 파일은 존재하지 않았음

3. 두 파일에서 관리자 전용 기능을 위해 `requireAdminAuth`를 사용하려고 했음:
   - `tenantUsers.ts`: 관리자만 접근 가능한 기관별 사용자 목록 조회
   - `schedulerSettings.ts`: 관리자만 접근 가능한 스케줄러 설정 조회/저장

## 해결 방법

### 1. `requireAdminAuth.ts` 파일 생성

`requireStudentAuth.ts`의 패턴을 참고하여 `lib/auth/requireAdminAuth.ts` 파일을 생성했습니다.

#### 주요 기능:
- 관리자(superadmin 또는 admin) 권한만 허용
- `getCurrentUserRole()`을 사용하여 현재 사용자 역할 확인
- 권한이 없으면 `AppError`를 throw하여 에러 처리
- 반환값: `{ userId: string, role: "admin" | "superadmin", tenantId: string | null }`

#### 코드 구조:
```typescript
export async function requireAdminAuth(): Promise<{
  userId: string;
  role: "admin" | "superadmin";
  tenantId: string | null;
}>
```

### 2. 에러 처리

다양한 상황에 따른 명확한 에러 메시지 제공:
- 로그인되지 않은 경우: "로그인이 필요합니다..."
- 역할을 확인할 수 없는 경우: "사용자 역할을 확인할 수 없습니다..."
- 컨설턴트인 경우: "관리자 권한이 필요합니다. 컨설턴트 권한으로는..."
- 일반 사용자인 경우: "관리자 권한이 필요합니다."

## 생성된 파일

### `lib/auth/requireAdminAuth.ts`
- 관리자 인증 헬퍼 함수
- Server Actions에서 관리자 권한이 필요한 경우 사용
- `requireStudentAuth.ts`와 유사한 패턴으로 구현

## 기존 파일과의 관계

### `requireStudentAuth.ts`
- 학생 권한만 확인
- 유사한 패턴으로 구현되어 있어 참고 가능

### `guards.ts`의 `requireAdminOrConsultant`
- admin 또는 consultant 권한 허용
- `requireAdminAuth`는 admin과 superadmin만 허용 (더 제한적)

### `getCurrentUserRole()`
- 사용자 역할 조회 기본 함수
- `requireAdminAuth`에서 내부적으로 사용

## 사용 예시

```typescript
// app/(admin)/actions/tenantUsers.ts
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";

export async function getTenantUsersAction() {
  const { role, tenantId } = await requireAdminAuth();
  
  // Super Admin이면 모든 기관 조회, 일반 Admin이면 현재 기관만
  const targetTenantId = role === "superadmin" ? null : tenantId;
  // ...
}
```

## 검증

- ✅ 린터 에러 없음
- ✅ TypeScript 타입 정확성 확인
- ✅ 기존 코드와의 일관성 유지

## 참고사항

- `requireAdminAuth`는 admin과 superadmin만 허용
- consultant는 `requireAdminOrConsultant` 함수를 사용해야 함
- 모든 인증 헬퍼는 `getCurrentUserRole()` 기반으로 작동

## 다음 단계

1. ✅ `requireAdminAuth.ts` 파일 생성 완료
2. 빌드 성공 확인 필요 (다른 에러는 별도 이슈)
3. 필요시 추가 테스트 작성




