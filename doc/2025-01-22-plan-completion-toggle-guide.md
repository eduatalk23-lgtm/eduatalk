# 플랜 완료/미완료 체크 방법

## 개요

플랜의 완료 상태를 토글하는 방법을 설명합니다.

## 미완료 체크 방법

### 1. 위치

**파일**: `app/(student)/today/_components/PlanCard.tsx`

플랜 목록에서 각 플랜 항목의 왼쪽에 있는 체크박스 아이콘을 클릭합니다.

### 2. UI 표시

- **완료된 플랜**: 녹색 체크 아이콘 (CheckCircle2) ✅
- **미완료 플랜**: 회색 원 아이콘 (Circle) ⭕

### 3. 동작 방식

```typescript
// 완료/미완료 토글
const handleToggleCompletion = async (planId: string, isCompleted: boolean) => {
  setIsLoading(true);
  try {
    const result = await togglePlanCompletion(planId, !isCompleted);
    if (!result.success) {
      alert(result.error || "완료 상태 변경에 실패했습니다.");
    } else {
      router.refresh();
    }
  } catch (error) {
    alert("오류가 발생했습니다.");
  } finally {
    setIsLoading(false);
  }
};
```

**로직**:
1. 현재 완료 상태의 반대로 변경 (`!isCompleted`)
2. `togglePlanCompletion` 서버 액션 호출
3. 성공 시 페이지 새로고침

### 4. 서버 액션 로직

**파일**: `app/actions/today.ts`

```typescript
export async function togglePlanCompletion(
  planId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }>
```

**동작**:
- `completed = true`: 플랜을 완료 상태로 변경
  - `progress = 100`
  - `start_page_or_time`, `end_page_or_time` 설정
  - `student_content_progress` 테이블에 기록

- `completed = false`: 플랜을 미완료 상태로 변경
  - `progress = 0`
  - `start_page_or_time`, `end_page_or_time`은 유지 (기존 값 유지)

## 사용 방법

### 완료 처리
1. 플랜 목록에서 미완료 플랜의 회색 원 아이콘 클릭
2. 녹색 체크 아이콘으로 변경됨
3. 진행률이 100%로 설정됨

### 미완료 처리
1. 플랜 목록에서 완료된 플랜의 녹색 체크 아이콘 클릭
2. 회색 원 아이콘으로 변경됨
3. 진행률이 0%로 설정됨

## 주의사항

- 완료 상태 변경은 즉시 반영됩니다
- 진행률 정보는 `student_content_progress` 테이블에 저장됩니다
- 완료 상태로 변경하면 `start_page_or_time`, `end_page_or_time`이 플랜의 계획된 범위로 설정됩니다
- 미완료로 변경해도 기존에 입력한 범위 정보는 유지됩니다

