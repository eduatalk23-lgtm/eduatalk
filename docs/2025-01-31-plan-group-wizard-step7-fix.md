# 플랜 그룹 위저드 Step 7 스케줄 결과 단계 수정

**작업 일자**: 2025-01-31  
**작업 내용**: 플랜 그룹 생성 시 Step 7(스케줄 결과) 단계를 거치도록 수정

## 문제 상황

플랜 그룹 생성 시 Step 6(최종 확인)에서 "다음" 버튼을 클릭하면:
- 플랜이 생성되지만 Step 7(스케줄 결과) 단계를 거치지 않고
- 바로 상세보기 페이지(`/plan/group/${groupId}`)로 리다이렉트됨

## 원인 분석

### 문제가 발생한 위치

1. **`usePlanGenerator.ts`의 `generatePlans` 함수**
   - 일반 플랜 생성 모드에서 플랜 생성 후 바로 `router.push()`로 리다이렉트
   - Step 7을 거치지 않고 상세보기 페이지로 이동

2. **`usePlanSubmission.ts`의 `handleSubmit` 함수**
   - `generatePlans` 호출 후 리다이렉트를 기대
   - Step 7로 이동하는 로직이 없음

## 해결 방법

### 1. `usePlanGenerator.ts` 수정

일반 플랜 생성 모드에서 리다이렉트 제거:

```typescript
// 일반 플랜 생성
if (!isAdminContinueMode && !campInvitationId) {
  await updatePlanGroupStatus(groupId, "saved");
  const result = await generatePlansFromGroupAction(groupId);
  toast.showSuccess(`플랜이 생성되었습니다. (총 ${result.count}개)`);
  // 리다이렉트 제거 - Step 7로 이동하도록 상위에서 처리
  // Step 7에서 완료 버튼을 눌렀을 때만 상세보기 페이지로 이동
}
```

**변경 사항**:
- `router.push()` 호출 제거
- 주석 추가로 의도 명확화

**예외 처리**:
- 캠프 모드: 기존대로 리다이렉트 유지 (캠프 제출 페이지로 이동)
- 관리자 continue 모드: 기존대로 리다이렉트 유지 (참여자 목록으로 이동)

### 2. `usePlanSubmission.ts` 수정

플랜 생성 후 Step 7로 이동하도록 수정:

```typescript
// 2. Plan Generation (Generate Real Plans)
if (generatePlansFlag) {
  await generatePlans(finalGroupId);
  // 플랜 생성 후 Step 7로 이동 (리다이렉트는 Step 7 완료 버튼에서 처리)
  goToStep(7);
} else {
  goNext();
}
```

**변경 사항**:
- `generatePlans` 호출 후 `goToStep(7)` 추가
- 주석 추가로 의도 명확화

## 수정된 흐름

### 이전 흐름
```
Step 6 (최종 확인) 
  → "다음" 버튼 클릭
  → 플랜 생성
  → 바로 상세보기 페이지로 리다이렉트 ❌
```

### 수정된 흐름
```
Step 6 (최종 확인)
  → "다음" 버튼 클릭
  → 플랜 생성
  → Step 7 (스케줄 결과)로 이동 ✅
  → "완료" 버튼 클릭
  → 상세보기 페이지로 리다이렉트 ✅
```

## 영향 범위

### 수정된 파일
- `app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts`
- `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`

### 영향받는 기능
- ✅ 일반 플랜 그룹 생성: Step 7을 거치도록 수정됨
- ✅ 캠프 모드: 기존대로 리다이렉트 유지 (변경 없음)
- ✅ 관리자 continue 모드: 기존대로 리다이렉트 유지 (변경 없음)

## 테스트 체크리스트

- [ ] 일반 플랜 그룹 생성 시 Step 7(스케줄 결과) 단계 표시 확인
- [ ] Step 7에서 스케줄 결과가 올바르게 표시되는지 확인
- [ ] Step 7 "완료" 버튼 클릭 시 상세보기 페이지로 이동 확인
- [ ] 캠프 모드에서 기존 흐름 유지 확인
- [ ] 관리자 continue 모드에서 기존 흐름 유지 확인

## 참고 사항

- Step 7은 `PlanGroupWizard.tsx`에서 `currentStep === 7 && draftGroupId && !isTemplateMode` 조건으로 렌더링됨
- Step 7의 완료 버튼은 `handleStep7Complete` 함수에서 처리됨
- 캠프 모드와 관리자 모드는 기존 리다이렉트 로직을 유지하여 호환성 보장

