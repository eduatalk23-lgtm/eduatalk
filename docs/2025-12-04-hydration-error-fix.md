# Hydration 에러 및 Runtime 에러 수정

## 작업 일시
2025-12-04

## 문제 상황

### 1. Hydration 에러
```
Hydration failed because the server rendered HTML didn't match the client.
```
- `RoleBasedLayout` 컴포넌트의 115번째 줄에서 발생
- 서버와 클라이언트에서 Suspense 경계가 다르게 렌더링되는 문제

### 2. Runtime TypeError
```
Cannot read properties of null (reading 'parentNode')
```
- `ScrollToTop` 컴포넌트에서 DOM 조작 시 발생

### 3. 빌드 에러
- `campTemplateActions.ts`에서 `schedulerOptions` 변수 스코프 문제
- 여러 타입 에러들

## 수정 내용

### 1. RoleBasedLayout 수정
**파일**: `components/layout/RoleBasedLayout.tsx`

`children` 렌더링 방식을 개선하여 서버와 클라이언트 간 일관성 확보:

```tsx
{/* 페이지 콘텐츠 */}
<div className="flex-1">
  {children}
</div>
```

### 2. ScrollToTop 컴포넌트 안전성 개선
**파일**: `components/ScrollToTop.tsx`

DOM이 준비된 후에만 스크롤 실행하도록 수정:

```tsx
useEffect(() => {
  // DOM이 준비된 후에만 스크롤 실행
  if (typeof window !== "undefined") {
    // 다음 틱에서 실행하여 DOM이 완전히 렌더링된 후 실행
    const timer = setTimeout(() => {
      scrollToTop();
    }, 0);
    
    return () => clearTimeout(timer);
  }
}, []);
```

### 3. campTemplateActions.ts 수정
**파일**: `app/(admin)/actions/campTemplateActions.ts`

`schedulerOptions` 변수를 함수 상단에서 정의하여 스코프 문제 해결:

```tsx
let tenantBlockSetId: string | null = null;
const schedulerOptions = (result.group.scheduler_options as any) || {};
```

### 4. 타입 에러 수정

#### campTemplateBlockSets.ts
- `blocks` 속성을 required로 변경

#### SchoolEditForm.tsx
- `region_id`, `category`, `university_type`, `university_ownership` 타입을 optional로 변경

#### SchoolFormModal.tsx
- 타입 단언을 사용하여 타입 에러 해결

#### SubjectGroupSidebar.tsx, SubjectList.tsx, SubjectTable.tsx, SubjectTypeList.tsx, SubjectTypeTable.tsx
- `display_order`가 `undefined`일 수 있는 경우를 처리하기 위해 nullish coalescing 연산자(`??`) 사용

#### UnifiedSubjectForm.tsx
- `display_order`가 `undefined`일 수 있는 경우를 처리

#### continue/page.tsx
- `recommended_contents` 타입 에러 해결

## 결과

- Hydration 에러 해결
- Runtime TypeError 해결
- 빌드 에러 대부분 해결 (일부 타입 에러는 계속 수정 중)

## 참고 사항

- Next.js 16의 App Router에서 Suspense 경계가 서버와 클라이언트에서 다르게 렌더링될 수 있으므로 주의 필요
- DOM 조작 시 DOM이 완전히 준비된 후에 실행하도록 보장 필요
- TypeScript strict mode에서 optional 속성 처리 시 nullish coalescing 연산자 활용

