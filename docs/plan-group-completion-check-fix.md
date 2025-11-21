# 플랜 그룹 및 플랜 미리보기 완료 체크 개선

## 작업 일시
2025-01-XX

## 문제점
플랜 그룹과 플랜 미리보기 진행 시 완료하지 않았는데 리다이렉트되거나 활성화되는 문제가 있었습니다.

### 발견된 문제들
1. **플랜 미리보기에서 플랜 생성 후**: 플랜 생성 후 완료 체크 없이 바로 리다이렉트되거나 다이얼로그가 닫힘
2. **Step 7 완료 버튼**: 플랜이 실제로 생성되었는지 확인하지 않고 바로 리다이렉트
3. **플랜 그룹 활성화**: 플랜이 생성되었는지 확인하지 않고 바로 활성화

## 해결 방법

### 1. 플랜 생성 여부 확인 함수 추가
`app/(student)/actions/planGroupActions.ts`에 `checkPlansExistAction` 함수를 추가하여 플랜 그룹에 플랜이 생성되었는지 확인할 수 있도록 했습니다.

```typescript
/**
 * 플랜 그룹에 플랜이 생성되었는지 확인
 */
async function _checkPlansExist(groupId: string): Promise<{
  hasPlans: boolean;
  planCount: number;
}> {
  // 플랜 개수 확인 로직
}

export const checkPlansExistAction = withErrorHandling(_checkPlansExist);
```

### 2. 플랜 미리보기에서 완료 체크 추가
`app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`의 `handleGenerate` 함수에서 플랜 생성 후 실제로 플랜이 생성되었는지 확인하도록 수정했습니다.

```typescript
const handleGenerate = () => {
  // ... 기존 코드 ...
  
  startGenerateTransition(async () => {
    try {
      const result = await generatePlansFromGroupAction(groupId);
      
      // 플랜이 실제로 생성되었는지 확인
      const checkResult = await checkPlansExistAction(groupId);
      if (!checkResult.hasPlans) {
        alert("플랜 생성에 실패했습니다. 플랜이 생성되지 않았습니다.");
        return;
      }
      
      // ... 나머지 코드 ...
    }
  });
};
```

### 3. Step 7 완료 버튼에서 플랜 생성 여부 확인
`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`의 `onComplete` 핸들러에서 플랜이 생성되었는지 확인하도록 수정했습니다.

```typescript
onComplete={async () => {
  // 플랜이 실제로 생성되었는지 확인
  try {
    const checkResult = await checkPlansExistAction(draftGroupId);
    if (!checkResult.hasPlans) {
      alert("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
      return;
    }
  } catch (error) {
    // 에러 처리
  }
  
  // ... 나머지 코드 ...
}}
```

### 4. 플랜 그룹 활성화 시 완료 체크 추가
다음 두 컴포넌트에서 활성화 시 플랜 생성 여부를 확인하도록 수정했습니다:

#### PlanGroupActivationDialog.tsx
```typescript
const handleActivate = () => {
  startTransition(async () => {
    try {
      // 플랜이 실제로 생성되었는지 확인
      const checkResult = await checkPlansExistAction(groupId);
      if (!checkResult.hasPlans) {
        toast.showError("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
        return;
      }
      
      // ... 나머지 코드 ...
    }
  });
};
```

#### PlanGroupStatusButtons.tsx
```typescript
const handleStatusChange = (newStatus: PlanStatus) => {
  // ... 기존 코드 ...
  
  startTransition(async () => {
    try {
      // 활성화 시 플랜이 생성되었는지 확인
      if (newStatus === "active") {
        const checkResult = await checkPlansExistAction(groupId);
        if (!checkResult.hasPlans) {
          alert("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
          return;
        }
      }
      
      // ... 나머지 코드 ...
    }
  });
};
```

## 수정된 파일 목록
1. `app/(student)/actions/planGroupActions.ts` - 플랜 생성 여부 확인 함수 추가
2. `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx` - 플랜 생성 후 완료 체크 추가
3. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - Step 7 완료 버튼에서 플랜 생성 여부 확인
4. `app/(student)/plan/new-group/_components/PlanGroupActivationDialog.tsx` - 활성화 시 플랜 생성 여부 확인
5. `app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx` - 활성화 시 플랜 생성 여부 확인

## 테스트 시나리오
1. 플랜 미리보기에서 플랜 생성 후 플랜이 실제로 생성되었는지 확인
2. Step 7 완료 버튼 클릭 시 플랜이 없으면 경고 메시지 표시
3. 플랜 그룹 활성화 시 플랜이 없으면 경고 메시지 표시 및 활성화 중단

## 개선 효과
- 플랜이 생성되지 않은 상태에서 리다이렉트되거나 활성화되는 문제 방지
- 사용자에게 명확한 피드백 제공
- 데이터 무결성 보장

