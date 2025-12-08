# Hydration Error 수정 - RoleBasedLayout

## 문제 상황

### 에러 메시지
```
Hydration failed because the server rendered HTML didn't match the client. 
As a result this tree will be regenerated on the client.

+ <div className="flex-1">
- <Suspense>
```

### 발생 위치
- `components/layout/RoleBasedLayout.tsx` 115번째 줄
- `/admin/sms` 페이지에서 발생

### 원인 분석
1. **Next.js 16의 자동 Suspense 래핑**: Next.js 16에서는 `children`이 자동으로 Suspense로 감싸질 수 있습니다.
2. **서버/클라이언트 렌더링 불일치**: 서버에서는 `<div className="flex-1">`가 바로 렌더링되지만, 클라이언트에서는 `<Suspense>`로 감싸져 있습니다.
3. **Runtime TypeError**: `Cannot read properties of null (reading 'parentNode')` - DOM 조작 시 null 체크 부족

## 해결 방법

### 1. suppressHydrationWarning 사용 (임시 방편)
```tsx
<div className="flex-1" suppressHydrationWarning>
  {children}
</div>
```

### 2. 근본 원인 해결 (권장)
Next.js 16에서는 `children`이 자동으로 Suspense로 감싸질 수 있으므로, 이를 명시적으로 처리해야 합니다.

#### 옵션 A: children을 직접 렌더링
```tsx
<div className="flex-1">
  {children}
</div>
```

#### 옵션 B: children을 Fragment로 감싸기
```tsx
<div className="flex-1">
  <Fragment>{children}</Fragment>
</div>
```

#### 옵션 C: children을 Suspense로 명시적으로 감싸기
```tsx
<div className="flex-1">
  <Suspense fallback={null}>
    {children}
  </Suspense>
</div>
```

## 적용된 수정 사항

### 파일: `components/layout/RoleBasedLayout.tsx`

```tsx
{/* 페이지 콘텐츠 - suppressHydrationWarning으로 hydration 불일치 방지 */}
<div className="flex-1" suppressHydrationWarning>
  {children}
</div>
```

## 추가 조사 필요 사항

1. **parentNode 에러**: DOM 조작 시 null 체크가 필요한 부분 확인
2. **Next.js 16 자동 Suspense 래핑**: 공식 문서 확인 필요
3. **다른 레이아웃 컴포넌트**: 동일한 문제가 있는지 확인

## 참고 자료

- [Next.js 16 Hydration Mismatch](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [React Hydration Error](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content)

## 작업 일시
2025-01-07

