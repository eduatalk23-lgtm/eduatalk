# 템플릿 수정 페이지 네비게이션 성능 개선

## 작업 일시
2025-02-02

## 작업 개요
템플릿 수정 페이지에서 페이지 이동 시 발생하는 병목 현상을 해결하기 위해 React 18의 `useTransition` 훅을 사용하여 네비게이션 성능을 개선했습니다.

## 문제 분석

### 발견된 문제
- "템플릿 상세보기" 및 "취소" 버튼 클릭 시 페이지 이동이 지연되거나 반응이 느림
- `PlanGroupWizard` 컴포넌트의 복잡한 로직으로 인한 네비게이션 지연 가능성
- 사용자 피드백 부족 (로딩 상태 표시 없음)

### 원인 분석
- `router.replace`가 동기적으로 처리되어 무거운 컴포넌트 언마운트 중 UI가 멈출 수 있음
- React의 기본 렌더링 우선순위로 인해 네비게이션이 지연될 수 있음
- 네비게이션 중 사용자 피드백이 없어 반응이 느린 것처럼 느껴짐

## 해결 방안

### React 18의 useTransition 활용
- `useTransition` 훅을 사용하여 네비게이션을 낮은 우선순위로 처리
- UI 반응성을 유지하면서 네비게이션 수행
- `isPending` 상태로 로딩 피드백 제공

## 수정 내용

### 파일: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 1. Import 수정
**변경 전**:
```tsx
import { useState, useCallback } from "react";
```

**변경 후**:
```tsx
import { useState, useCallback, useTransition } from "react";
```

#### 2. useTransition 훅 추가
**변경 전**:
```tsx
const router = useRouter();
const toast = useToast();
```

**변경 후**:
```tsx
const router = useRouter();
const toast = useToast();
const [isPending, startTransition] = useTransition();
```

#### 3. 템플릿 상세보기 버튼 개선
**변경 전**:
```tsx
<button
  type="button"
  onClick={() => {
    router.replace(`/admin/camp-templates/${template.id}`);
  }}
  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
  템플릿 상세보기
</button>
```

**변경 후**:
```tsx
<button
  type="button"
  onClick={() => {
    startTransition(() => {
      router.replace(`/admin/camp-templates/${template.id}`);
    });
  }}
  disabled={isPending}
  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
  {isPending ? "이동 중..." : "템플릿 상세보기"}
</button>
```

#### 4. 취소 버튼 개선
**변경 전**:
```tsx
<button
  type="button"
  onClick={() => {
    if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
      router.replace(`/admin/camp-templates/${template.id}`);
    }
  }}
  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  취소
</button>
```

**변경 후**:
```tsx
<button
  type="button"
  onClick={() => {
    if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
      startTransition(() => {
        router.replace(`/admin/camp-templates/${template.id}`);
      });
    }
  }}
  disabled={isPending}
  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  취소
</button>
```

## 수정된 파일 목록
1. `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

## 개선 효과

### 성능 개선
- **UI 반응성 향상**: 네비게이션이 낮은 우선순위로 처리되어 UI가 멈추지 않음
- **동시성 활용**: React 18의 동시성 기능을 활용하여 더 부드러운 사용자 경험 제공

### 사용자 경험 개선
- **로딩 피드백**: "이동 중..." 텍스트로 네비게이션 진행 상태 표시
- **중복 클릭 방지**: `isPending` 상태로 버튼 비활성화하여 중복 클릭 방지
- **시각적 피드백**: 버튼이 비활성화되어 사용자가 진행 중임을 인지

### 코드 품질
- **프로젝트 패턴 일치**: 다른 컴포넌트(`PlanGroupStatusButtons`, `PlanGroupBulkDeleteDialog` 등)와 동일한 패턴 사용
- **일관성**: 프로젝트 전반에 걸쳐 일관된 네비게이션 처리 방식

## 테스트 확인 사항
- [x] "템플릿 상세보기" 버튼 클릭 시 즉시 반응하는지 확인
- [x] "이동 중..." 텍스트가 표시되는지 확인
- [x] 버튼이 비활성화되는지 확인
- [x] "취소" 버튼 클릭 시 동일하게 작동하는지 확인
- [x] 네비게이션이 정상적으로 완료되는지 확인
- [x] 중복 클릭이 방지되는지 확인

## 참고 사항

### useTransition의 동작 원리
- `startTransition`으로 래핑된 업데이트는 낮은 우선순위로 처리됨
- React는 긴급한 업데이트(입력, 클릭 등)를 먼저 처리하고, 전환 업데이트는 나중에 처리
- 이를 통해 UI가 반응성을 유지하면서 네비게이션을 수행할 수 있음

### 주의사항
- `startTransition` 내부에서는 동기 작업만 수행해야 함
- 비동기 작업(`async/await`)이 필요한 경우, 완료 후 네비게이션을 수행해야 함
- 현재 구현은 `router.replace`만 호출하므로 안전함

### 프로젝트 내 사용 패턴
이 패턴은 다음 컴포넌트에서도 사용되고 있음:
- `PlanGroupStatusButtons.tsx`
- `PlanGroupBulkDeleteDialog.tsx`
- `DeleteContentButton.tsx`
- `PlanGroupActivationDialog.tsx`

## 향후 개선 가능 사항
- 템플릿 저장 후 리다이렉트에도 `startTransition` 적용 고려 (선택적)
- 네비게이션 진행률 표시 (필요한 경우)
- 에러 발생 시 롤백 처리 (필요한 경우)

