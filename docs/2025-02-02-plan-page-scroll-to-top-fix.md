# 플랜 생성 페이지 스크롤 상단 이동 수정

## 작업 일자
2025-02-02

## 문제
플랜 생성 시 페이지 이동할 때 일부 페이지에서 스크롤 위치가 상단이 아닌 중간이나 아래쪽에 있어 사용자 경험이 좋지 않았습니다.

## 해결 방법

### 1. 공통 스크롤 유틸리티 함수 생성
- `lib/utils/scroll.ts`: 스크롤을 페이지 상단으로 이동시키는 유틸리티 함수 생성
- `components/ScrollToTop.tsx`: 페이지 마운트 시 스크롤을 상단으로 이동시키는 클라이언트 컴포넌트 생성

### 2. 페이지 컴포넌트에 스크롤 상단 이동 로직 추가
다음 페이지들에 `ScrollToTop` 컴포넌트를 추가하여 페이지 로드 시 자동으로 상단으로 스크롤되도록 수정:
- `app/(student)/plan/page.tsx` - 플랜 목록 페이지
- `app/(student)/plan/new-group/page.tsx` - 새 플랜 그룹 생성 페이지
- `app/(student)/plan/group/[id]/page.tsx` - 플랜 그룹 상세 페이지
- `app/(student)/plan/group/[id]/edit/page.tsx` - 플랜 그룹 편집 페이지

### 3. router.push 호출 시 scroll 옵션 명시
플랜 관련 모든 `router.push()` 호출에 `scroll: true` 옵션을 명시적으로 추가:

**수정된 파일들:**
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` (8곳)
- `app/(student)/plan/new-group/_components/PlanGroupActivationDialog.tsx` (2곳)
- `app/(student)/plan/_components/PlanGroupBulkDeleteDialog.tsx` (1곳)
- `app/(student)/plan/_components/PlanGroupDeleteDialog.tsx` (1곳)
- `app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx` (1곳)
- `app/(student)/plan/group/[id]/_components/PlanGroupActionButtons.tsx` (1곳)
- `app/(student)/plan/_components/PlanGroupListItem.tsx` (1곳)
- `app/(student)/plan/group/[id]/_components/PlanGroupDeleteButton.tsx` (1곳)
- `app/(student)/plan/group/[id]/_components/PlanGroupCopyButton.tsx` (1곳)
- `app/(student)/plan/_shared/FilterBar.tsx` (1곳)

## 구현 세부사항

### ScrollToTop 컴포넌트
```typescript
"use client";

import { useEffect } from "react";
import { scrollToTop } from "@/lib/utils/scroll";

export function ScrollToTop() {
  useEffect(() => {
    scrollToTop();
  }, []);

  return null;
}
```

### router.push 사용 예시
```typescript
// 수정 전
router.push(`/plan/group/${groupId}`);

// 수정 후
router.push(`/plan/group/${groupId}`, { scroll: true });
```

## 테스트
- 플랜 목록 페이지에서 새 플랜 생성 버튼 클릭 시 상단으로 이동 확인
- 플랜 생성 완료 후 상세 페이지로 이동 시 상단으로 이동 확인
- 플랜 그룹 활성화/저장 후 상세 페이지로 이동 시 상단으로 이동 확인
- 플랜 그룹 삭제 후 목록 페이지로 이동 시 상단으로 이동 확인
- 필터 변경 시 상단으로 이동 확인

## 영향받는 파일

### 새로 생성된 파일
1. `lib/utils/scroll.ts`
2. `components/ScrollToTop.tsx`

### 수정된 파일
1. `app/(student)/plan/page.tsx`
2. `app/(student)/plan/new-group/page.tsx`
3. `app/(student)/plan/group/[id]/page.tsx`
4. `app/(student)/plan/group/[id]/edit/page.tsx`
5. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
6. `app/(student)/plan/new-group/_components/PlanGroupActivationDialog.tsx`
7. `app/(student)/plan/_components/PlanGroupBulkDeleteDialog.tsx`
8. `app/(student)/plan/_components/PlanGroupDeleteDialog.tsx`
9. `app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx`
10. `app/(student)/plan/group/[id]/_components/PlanGroupActionButtons.tsx`
11. `app/(student)/plan/_components/PlanGroupListItem.tsx`
12. `app/(student)/plan/group/[id]/_components/PlanGroupDeleteButton.tsx`
13. `app/(student)/plan/group/[id]/_components/PlanGroupCopyButton.tsx`
14. `app/(student)/plan/_shared/FilterBar.tsx`

## 참고사항
- Next.js의 `router.push()`는 기본적으로 `scroll: true`가 기본값이지만, 명시적으로 설정하여 일관성을 보장했습니다.
- `ScrollToTop` 컴포넌트는 서버 컴포넌트에서도 사용할 수 있도록 클라이언트 컴포넌트로 구현했습니다.
- `behavior: "instant"`를 사용하여 즉시 스크롤되도록 설정했습니다.

