# 관리자 플랜 그룹 생성 후 플랜 생성 실패 문제 해결

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: ✅ 완료

---

## 문제 분석

### 발생한 문제

관리자 영역에서 플랜 그룹 생성 시 다음 문제가 발생했습니다:

1. **마스터 컨텐츠에서 컨텐츠 선택**
2. **AI 플랜 생성 미사용**
3. **플랜 생성 시작 이후 모달 닫힘, 렌더 반응은 있으나 플랜 생성이 진행되지 않음**
4. **캘린더 또는 데일리 뷰에 플랜이 보이지 않음**

### 원인 분석

1. **플랜 그룹 상태 문제**: `createPlanGroupAction`이 플랜 그룹을 생성할 때 기본 상태는 "draft"입니다.
2. **플랜 생성 요구사항**: `_generatePlansWithServices`는 플랜 그룹 상태가 "saved" 또는 "active"여야만 플랜을 생성할 수 있습니다.
3. **에러 처리 부족**: 플랜 생성 실패 시 에러가 콘솔에만 출력되고 사용자에게 표시되지 않았습니다.
4. **플랜 생성 확인 부재**: 플랜이 실제로 생성되었는지 확인하는 로직이 없었습니다.

---

## 해결 방안

### 수정 내용

#### 1. 필요한 import 추가

```typescript
import { generatePlansFromGroupAction, checkPlansExistAction } from '@/lib/domains/plan/actions/plan-groups/plans';
import { updatePlanGroupStatus } from '@/lib/domains/plan/actions/plan-groups/status';
import { useToast } from '@/components/ui/ToastProvider';
```

#### 2. useToast hook 추가

```typescript
const toast = useToast();
```

#### 3. onSuccess 콜백 수정

플랜 그룹 생성 후 다음 순서로 처리하도록 수정:

1. **플랜 그룹 상태를 "saved"로 변경**
   - `updatePlanGroupStatus(groupId, "saved")` 호출
   - 실패 시 에러 메시지 표시 및 중단

2. **플랜 생성**
   - `generatePlansFromGroupAction(groupId)` 호출
   - 결과에서 생성된 플랜 개수 확인

3. **플랜 생성 확인**
   - `checkPlansExistAction(groupId)` 호출
   - 플랜이 실제로 생성되었는지 확인
   - 생성되지 않은 경우 에러 메시지 표시

4. **성공 메시지 표시**
   - Toast 알림으로 성공 메시지 표시
   - 생성된 플랜 개수 포함

5. **에러 처리 개선**
   - 모든 에러를 catch하여 사용자에게 명확한 메시지 표시
   - 콘솔에도 에러 로그 출력

### 수정된 코드

```typescript
onSuccess={async (groupId, generateAI) => {
  setShowCreateWizard(false);
  if (generateAI) {
    // AI 생성: AI 모달에서 플랜 생성
    setNewGroupIdForAI(groupId);
    setShowAIPlanModal(true);
  } else {
    // AI 없이 생성: 플랜 그룹 상태를 saved로 변경 후 플랜 생성
    try {
      // 1. 플랜 그룹 상태를 "saved"로 변경
      try {
        await updatePlanGroupStatus(groupId, "saved");
      } catch (statusError) {
        const errorMessage = statusError instanceof Error ? statusError.message : "플랜 그룹 상태 업데이트에 실패했습니다.";
        toast.showError(errorMessage);
        handleRefresh();
        return;
      }

      // 2. 플랜 생성
      const result = await generatePlansFromGroupAction(groupId);

      // 3. 플랜 생성 확인
      const checkResult = await checkPlansExistAction(groupId);
      if (!checkResult.hasPlans) {
        toast.showError("플랜 생성에 실패했습니다. 플랜이 생성되지 않았습니다.");
        handleRefresh();
        return;
      }

      // 4. 성공 메시지 표시
      toast.showSuccess(`플랜이 생성되었습니다. (총 ${result.count}개)`);
      handleRefresh();
    } catch (err) {
      console.error('[AdminPlanManagement] 플랜 생성 실패:', err);
      const errorMessage = err instanceof Error ? err.message : "플랜 생성에 실패했습니다.";
      toast.showError(errorMessage);
      handleRefresh();
    }
  }
}}
```

---

## 수정된 파일

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`
  - Import 추가: `checkPlansExistAction`, `updatePlanGroupStatus`, `useToast`
  - `useToast` hook 추가
  - `onSuccess` 콜백 수정: 플랜 그룹 상태 변경 → 플랜 생성 → 플랜 생성 확인 → 에러 처리 개선

---

## 테스트 시나리오

### 성공 케이스

1. 관리자 영역에서 플래너 선택
2. 마스터 컨텐츠에서 컨텐츠 선택
3. AI 플랜 생성 미사용
4. 플랜 그룹 생성 완료
5. 플랜 그룹 상태가 "saved"로 변경됨
6. 플랜 생성 성공
7. Toast 알림으로 성공 메시지 표시
8. 캘린더/데일리 뷰에서 플랜 확인

### 에러 케이스

1. **플랜 그룹 상태 업데이트 실패**
   - 에러 메시지 표시
   - 플랜 생성 중단

2. **플랜 생성 실패**
   - 에러 메시지 표시
   - 플랜 생성 확인 실패 시 추가 에러 메시지

3. **플랜 생성 확인 실패**
   - 플랜이 생성되지 않았다는 메시지 표시

---

## 개선 사항

1. ✅ 플랜 그룹 생성 후 상태를 "saved"로 변경하여 플랜 생성 가능 상태로 만듦
2. ✅ 플랜 생성 후 실제로 플랜이 생성되었는지 확인하는 로직 추가
3. ✅ 에러 처리 개선 및 사용자에게 명확한 에러 메시지 표시
4. ✅ Toast 알림을 통한 성공/실패 피드백 제공
5. ✅ 학생 모드와의 일관성 유지 (학생 모드에서도 동일한 패턴 사용)

---

## 참고 문서

- [관리자 플랜 생성 시스템 분석](./2026-01-15-admin-planner-plan-creation-system-analysis.md)
- [플랜 그룹 생성 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)

---

**작성 완료**: 2026-01-15  
**버전**: 1.0

