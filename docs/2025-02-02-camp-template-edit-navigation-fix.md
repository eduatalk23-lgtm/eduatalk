# 템플릿 수정 페이지 버튼 네비게이션 수정

## 작업 일시
2025-02-02

## 작업 개요
캠프 템플릿 수정 페이지에서 "템플릿 상세보기" 및 "취소" 버튼을 클릭해도 페이지 이동이 되지 않는 문제를 수정했습니다.

## 문제 분석

### 발견된 문제
- `Link` 컴포넌트를 사용한 "템플릿 상세보기" 버튼이 클릭해도 페이지 이동이 되지 않음
- `router.push`를 사용한 "취소" 버튼도 페이지 이동이 되지 않음
- 템플릿 저장 후에도 `router.push`가 제대로 작동하지 않음

### 원인 분석
- Next.js의 `Link` 컴포넌트가 특정 상황에서 클릭 이벤트를 제대로 처리하지 못할 수 있음
- `router.push`가 비동기적으로 작동하지 않거나, 네비게이션 히스토리 문제로 인해 이동이 되지 않을 수 있음

## 해결 방안

1. **Link 컴포넌트를 button으로 변경**
   - `Link` 컴포넌트 대신 `button` 요소를 사용하고 `router.replace`로 네비게이션 처리
   - 더 명확한 클릭 이벤트 처리

2. **router.push를 router.replace로 변경**
   - `router.push` 대신 `router.replace`를 사용하여 브라우저 히스토리 문제 방지
   - 수정 페이지에서 상세 페이지로 이동할 때 히스토리에 수정 페이지를 남기지 않음

## 수정 내용

### 파일: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 1. Import 수정
**변경 전**:
```tsx
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
```

**변경 후**:
```tsx
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
```

#### 2. 템플릿 상세보기 버튼 수정
**변경 전**:
```tsx
<Link
  href={`/admin/camp-templates/${template.id}`}
  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
  템플릿 상세보기
</Link>
```

**변경 후**:
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

#### 3. 취소 버튼 수정
**변경 전**:
```tsx
<button
  type="button"
  onClick={() => {
    if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
      router.push(`/admin/camp-templates/${template.id}`);
    }
  }}
  className="..."
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
      router.replace(`/admin/camp-templates/${template.id}`);
    }
  }}
  className="..."
>
  취소
</button>
```

#### 4. 템플릿 저장 후 리다이렉트 수정
**변경 전**:
```tsx
toast.showSuccess("템플릿이 성공적으로 수정되었습니다.");
router.push(`/admin/camp-templates/${template.id}`);
```

**변경 후**:
```tsx
toast.showSuccess("템플릿이 성공적으로 수정되었습니다.");
router.replace(`/admin/camp-templates/${template.id}`);
```

## 수정된 파일 목록
1. `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

## 개선 효과
- **네비게이션 안정성**: `router.replace`를 사용하여 더 안정적인 페이지 이동
- **사용자 경험**: 버튼 클릭 시 즉시 페이지 이동이 이루어짐
- **히스토리 관리**: 수정 페이지를 히스토리에 남기지 않아 뒤로가기 시 더 나은 경험 제공

## 테스트 확인 사항
- [x] "템플릿 상세보기" 버튼 클릭 시 페이지 이동 확인
- [x] "취소" 버튼 클릭 시 확인 다이얼로그 후 페이지 이동 확인
- [x] 템플릿 저장 후 자동 페이지 이동 확인
- [x] 뒤로가기 시 수정 페이지로 돌아가지 않는지 확인

## 참고 사항
- `router.replace`는 `router.push`와 달리 브라우저 히스토리에 현재 페이지를 남기지 않음
- 수정 페이지에서 상세 페이지로 이동할 때는 `replace`가 더 적합함 (뒤로가기 시 수정 페이지로 돌아가지 않음)
- `Link` 컴포넌트 대신 `button`을 사용하여 더 명확한 클릭 이벤트 처리

