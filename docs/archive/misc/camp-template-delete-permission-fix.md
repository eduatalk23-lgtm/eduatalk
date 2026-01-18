# 캠프 템플릿 삭제 권한 오류 수정

## 문제 상황

관리자가 캠프 템플릿을 삭제하려고 할 때 "권한이 없습니다" 에러가 발생했습니다.

### 에러 메시지
```
권한이 없습니다.
at <anonymous> (app/(admin)/actions/campTemplateActions.ts:601:13)
```

## 원인 분석

`getCurrentUserRole()` 함수가 `null`을 반환하거나, 세션이 제대로 로드되지 않아 권한 검증이 실패했습니다.

### 문제점
1. `getCurrentUserRole()`이 `null`을 반환하는 경우를 명확하게 처리하지 않음
2. 세션이 만료되었거나 로드되지 않은 경우에 대한 명확한 에러 메시지 부족
3. 디버깅을 위한 로그 부족

## 해결 방법

### 1. 권한 검증 헬퍼 함수 추가

`requireAdminOrConsultant()` 헬퍼 함수를 추가하여 권한 검증을 일관되게 처리하고 더 명확한 에러 메시지를 제공합니다.

```typescript
async function requireAdminOrConsultant() {
  const { userId, role, tenantId } = await getCurrentUserRole();
  
  if (process.env.NODE_ENV === "development") {
    console.log("[requireAdminOrConsultant] 권한 확인:", { userId, role, tenantId });
  }
  
  if (!userId) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  if (role !== "admin" && role !== "consultant") {
    const errorMessage = role === null
      ? "사용자 역할을 확인할 수 없습니다. 다시 로그인해주세요."
      : "관리자 또는 컨설턴트 권한이 필요합니다.";
    
    if (process.env.NODE_ENV === "development") {
      console.error("[requireAdminOrConsultant] 권한 부족:", { userId, role, tenantId });
    }
    
    throw new AppError(errorMessage, ErrorCode.FORBIDDEN, 403, true);
  }
  
  return { userId, role, tenantId };
}
```

### 2. 삭제 함수 수정

`deleteCampTemplateAction` 함수에서 헬퍼 함수를 사용하도록 수정했습니다.

**변경 전:**
```typescript
const { role } = await getCurrentUserRole();
if (role !== "admin" && role !== "consultant") {
  throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
}
```

**변경 후:**
```typescript
await requireAdminOrConsultant();
```

## 개선 사항

1. **명확한 에러 메시지**: 세션이 없거나 역할을 확인할 수 없는 경우 더 구체적인 메시지 제공
2. **디버깅 로그**: 개발 환경에서 권한 확인 과정을 로그로 남김
3. **일관된 권한 검증**: 헬퍼 함수를 통해 권한 검증 로직을 통일

## 테스트

1. 관리자로 로그인한 상태에서 캠프 템플릿 삭제 시도
2. 세션이 만료된 상태에서 삭제 시도 (로그인 필요 메시지 확인)
3. 학생 계정으로 삭제 시도 (권한 부족 메시지 확인)

## 관련 파일

- `app/(admin)/actions/campTemplateActions.ts`
- `lib/auth/getCurrentUserRole.ts`

## 날짜

2024-11-24

