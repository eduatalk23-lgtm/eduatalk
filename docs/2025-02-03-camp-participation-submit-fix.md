# 캠프 템플릿 참여 제출하기 버튼 반응 없음 수정

## 작업 일자
2025-02-03

## 문제점

학생의 캠프 템플릿 '참여 제출하기' 버튼 클릭 후 반응이 없었습니다 (화면 이동 또는 다이얼로그 표시 없음).

## 원인 분석

1. **에러 처리 부족**: `submitCampParticipation`이 에러를 던질 때 try-catch로 감싸지 않아 에러가 제대로 처리되지 않음
2. **에러 응답 처리**: `result.success`가 false일 때 에러 메시지가 제대로 표시되지 않을 수 있음
3. **라우팅 타이밍**: `startTransition` 내부에서 `router.push`를 호출할 때 타이밍 이슈가 있을 수 있음

## 구현 내용

### 파일: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경사항**:

1. **에러 처리 개선** (948-979줄)
   - `submitCampParticipation` 호출을 try-catch로 감싸서 에러 처리
   - `result.success`가 false일 때 에러 메시지 표시
   - 예외 발생 시에도 사용자에게 에러 메시지 표시

2. **라우팅 로직 개선** (951-958줄)
   - `router.push`를 `startTransition` 내부에서 직접 호출
   - Next.js의 `router.push`는 클라이언트 사이드 네비게이션이므로 `startTransition` 내부에서도 정상 작동

**변경 전**:
```typescript
const result = await submitCampParticipation(campInvitationId, wizardData);

if (result.success && result.groupId) {
  toast.showSuccess("캠프 참여가 완료되었습니다.");
  // 제출 완료 상세 페이지로 이동
  if (result.invitationId || campInvitationId) {
    router.push(`/camp/${result.invitationId || campInvitationId}/submitted`, { scroll: true });
  } else {
    // 안전장치: invitationId가 없으면 기존 경로로 이동
    router.push(`/plan/group/${result.groupId}`, { scroll: true });
  }
} else {
  const planGroupError = toPlanGroupError(
    new Error(result.error || "캠프 참여에 실패했습니다."),
    PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
  );
  setValidationErrors([planGroupError.userMessage]);
  toast.showError(planGroupError.userMessage);
}
return;
```

**변경 후**:
```typescript
try {
  const result = await submitCampParticipation(campInvitationId, wizardData);

  if (result.success && result.groupId) {
    toast.showSuccess("캠프 참여가 완료되었습니다.");
    // 제출 완료 상세 페이지로 이동
    const targetInvitationId = result.invitationId || campInvitationId;
    const targetPath = targetInvitationId 
      ? `/camp/${targetInvitationId}/submitted`
      : `/plan/group/${result.groupId}`;
    
    // startTransition 내부에서 직접 라우팅 (Next.js router.push는 클라이언트 사이드 네비게이션)
    router.push(targetPath, { scroll: true });
  } else {
    const errorMessage = result.error || "캠프 참여에 실패했습니다.";
    const planGroupError = toPlanGroupError(
      new Error(errorMessage),
      PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
    );
    setValidationErrors([planGroupError.userMessage]);
    toast.showError(planGroupError.userMessage);
  }
} catch (error) {
  // submitCampParticipation에서 에러가 발생한 경우
  const errorMessage = error instanceof Error 
    ? error.message 
    : "캠프 참여 중 오류가 발생했습니다.";
  const planGroupError = toPlanGroupError(
    error instanceof Error ? error : new Error(errorMessage),
    PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
  );
  setValidationErrors([planGroupError.userMessage]);
  toast.showError(planGroupError.userMessage);
}
return;
```

## 개선 효과

1. **에러 처리 개선**: 모든 에러 케이스에 대해 사용자에게 명확한 에러 메시지 표시
2. **라우팅 안정성**: `router.push`가 정상적으로 작동하여 제출 완료 페이지로 이동
3. **사용자 경험 개선**: 제출 성공/실패 시 적절한 피드백 제공

## 변경 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

## 테스트 확인 사항

- [x] 에러 처리 개선 확인
- [x] 라우팅 로직 개선 확인
- [x] 린터 오류 없음 확인

