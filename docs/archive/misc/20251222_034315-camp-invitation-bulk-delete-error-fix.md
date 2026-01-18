# 캠프 초대 일괄 삭제 에러 수정

## 📋 문제 상황

### 에러 메시지
```
초대 일괄 삭제 실패: Error: An unexpected response was received from the server.
at fetchServerAction (server-action-reducer.ts:196:11)
```

## 🔍 원인 분석

1. **에러 핸들링 래퍼 누락**: `deleteCampInvitationsAction`이 `withErrorHandling`으로 래핑되지 않아 에러가 발생했을 때 Next.js가 예상하지 못한 응답으로 처리
2. **에러 처리 방식 불일치**: 다른 액션들은 `AppError`를 throw하는데, `deleteCampInvitationsAction`은 `{ success: false }` 형식으로 반환
3. **클라이언트 에러 메시지**: 에러 메시지가 제대로 추출되지 않아 사용자에게 명확한 정보 제공 불가

## ✅ 수정 사항

### 1. `app/(admin)/actions/camp-templates/participants.ts` - deleteCampInvitationsAction 수정

**변경 전**:
```typescript
export async function deleteCampInvitationsAction(
  invitationIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  // 에러를 { success: false } 형식으로 반환
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }
  // ...
}
```

**변경 후**:
```typescript
export const deleteCampInvitationsAction = withErrorHandling(
  async (
    invitationIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    // 에러를 AppError로 throw
    if (!invitationIds || invitationIds.length === 0) {
      throw new AppError(
        "삭제할 초대를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
    
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    // ...
  }
);
```

**주요 변경 사항**:
- `withErrorHandling`으로 래핑하여 에러 처리 일관성 확보
- 에러를 `AppError`로 throw하여 다른 액션들과 동일한 패턴 적용
- 입력값 검증, 권한 확인 등 모든 에러 케이스를 `AppError`로 변환

### 2. `app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx` - 에러 메시지 개선

**변경 전**:
```typescript
} catch (error) {
  console.error("초대 일괄 삭제 실패:", error);
  toast.showError("초대 삭제에 실패했습니다.");
}
```

**변경 후**:
```typescript
} catch (error) {
  console.error("초대 일괄 삭제 실패:", error);
  // AppError의 메시지 추출
  const errorMessage =
    error instanceof Error
      ? error.message
      : "초대 삭제에 실패했습니다.";
  toast.showError(errorMessage);
}
```

**주요 변경 사항**:
- `AppError`의 `message` 속성을 추출하여 사용자에게 명확한 에러 메시지 표시
- 에러가 `Error` 인스턴스가 아닌 경우를 대비한 fallback 메시지 제공

## 📊 변경 사항 요약

### 수정된 파일

1. **`app/(admin)/actions/camp-templates/participants.ts`**
   - `deleteCampInvitationsAction`을 `withErrorHandling`으로 래핑
   - 모든 에러를 `AppError`로 throw하도록 변경
   - 다른 액션들과 일관된 에러 처리 패턴 적용

2. **`app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx`**
   - catch 블록에서 에러 메시지를 추출하여 사용자에게 표시
   - `AppError`의 `message` 속성을 활용

### 에러 처리 개선

1. **일관성**: 다른 캠프 초대 관련 액션들과 동일한 에러 처리 패턴 적용
2. **사용자 경험**: 명확한 에러 메시지를 사용자에게 제공
3. **디버깅**: 에러 로깅은 유지하면서 사용자에게는 적절한 메시지 표시

## 🧪 테스트 시나리오

1. **정상 삭제**: 선택한 초대들이 정상적으로 삭제되어야 함
2. **권한 없는 초대**: 권한이 없는 초대 삭제 시도 시 적절한 에러 메시지 표시
3. **존재하지 않는 초대**: 존재하지 않는 초대 삭제 시도 시 적절한 에러 메시지 표시
4. **빈 선택**: 선택된 초대가 없을 때 적절한 에러 메시지 표시
5. **네트워크 에러**: 네트워크 에러 발생 시 적절한 에러 메시지 표시

## 📝 참고 사항

- `withErrorHandling`은 에러를 `AppError`로 변환하여 throw하므로, 클라이언트에서 catch하여 처리해야 함
- `AppError`는 `isUserFacing` 속성을 통해 사용자에게 표시할 수 있는 에러인지 구분
- 다른 캠프 초대 관련 액션들(`deleteCampInvitationAction`, `sendCampInvitationsAction` 등)과 동일한 패턴을 따름

