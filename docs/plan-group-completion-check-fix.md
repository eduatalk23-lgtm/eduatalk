# 플랜 그룹 및 플랜 미리보기 완료 체크 개선

## 작업 일시
2025-01-XX

## 추가 수정 (미리보기 리다이렉트 문제)
플랜 미리보기만 했는데 리다이렉트되거나 활성화되는 문제를 수정했습니다.

## 추가 수정 (Step 6→7 자동 활성화 문제)
Step 6에서 Step 7로 넘어갈 때 플랜이 자동 생성되고 자동 활성화되는 문제를 수정했습니다.

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

## 추가 수정 사항

### 미리보기와 생성 구분 명확화
`PlanPreviewDialog.tsx`에서 미리보기(`handlePreview`)와 실제 생성(`handleGenerate`)을 명확히 구분했습니다.

1. **미리보기 함수**: `onPlansGenerated` 콜백을 호출하지 않음 (실제 플랜 생성이 아니므로)
2. **생성 함수**: 실제 플랜 생성이 완료되고 검증된 경우에만 `onPlansGenerated` 콜백 호출

이를 통해 미리보기만 했을 때는 리다이렉트나 활성화가 발생하지 않도록 했습니다.

## 추가 수정 사항 2

### Step 6→7 자동 활성화 제거
`PlanGroupWizard.tsx`의 `handleSubmit` 함수에서 Step 6에서 Step 7로 넘어갈 때 자동으로 플랜 그룹을 활성화하던 로직을 제거했습니다.

**변경 전:**
- Step 6에서 Step 7로 넘어갈 때 플랜 생성 후 다른 활성 플랜 그룹이 없으면 **바로 활성화**
- Step 7에 도착했을 때 이미 활성화된 상태

**변경 후:**
- Step 6에서 Step 7로 넘어갈 때 플랜만 생성 (활성화하지 않음)
- 완료 버튼을 눌렀을 때만 활성화
- 다른 활성 플랜 그룹이 있으면 활성화 다이얼로그 표시

이를 통해 사용자가 완료 버튼을 명시적으로 눌렀을 때만 활성화되도록 했습니다.

## 개선 효과
- 플랜이 생성되지 않은 상태에서 리다이렉트되거나 활성화되는 문제 방지
- 미리보기만 했을 때 리다이렉트/활성화가 발생하지 않도록 수정
- Step 6→7 자동 활성화 제거로 사용자 의도에 맞는 플로우 제공
- 완료 버튼 클릭 시에만 활성화되도록 명확한 플로우 구성
- 사용자에게 명확한 피드백 제공
- 데이터 무결성 보장

