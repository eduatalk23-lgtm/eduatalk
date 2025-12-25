# 패딩 값 표준화 가이드

## 표준 패딩 정의

### 기본 원칙

- **표준 패딩**: `p-6 md:p-8` (기존 `getContainerClass`의 `md` 옵션과 일치)
- **PageContainer 사용**: 가능한 경우 `PageContainer` 컴포넌트 사용 권장
- **예외 케이스**: 특수한 경우만 예외 허용 (예: 모달 내부, 작은 컴포넌트)

### 표준 패딩 값

```typescript
// 표준 (권장)
p-6 md:p-8

// 작은 패딩 (특수 케이스)
p-4 md:p-6

// 큰 패딩 (특수 케이스)
p-8 md:p-10
```

## PageContainer 사용

### 권장 방법

```tsx
import PageContainer from "@/components/layout/PageContainer";

export default function MyPage() {
  return (
    <PageContainer widthType="FORM">
      {/* 콘텐츠 */}
    </PageContainer>
  );
}
```

### widthType 옵션

- `FORM`: 폼 페이지 (settings, account 등)
- `CONTENT_DETAIL`: 콘텐츠 상세 페이지
- `LIST`: 리스트/대시보드 페이지
- `CAMP_PLAN`: 캠프/플랜 그룹 페이지
- `DASHBOARD`: 대시보드 메인 페이지

## 예외 케이스

### 모달 내부

모달 내부는 일반적으로 더 작은 패딩을 사용합니다:

```tsx
<div className="p-4 md:p-6">
  {/* 모달 콘텐츠 */}
</div>
```

### 작은 컴포넌트

카드나 작은 컴포넌트 내부:

```tsx
<div className="rounded-lg border bg-white p-4">
  {/* 작은 컴포넌트 */}
</div>
```

## 개선된 페이지 목록

다음 페이지들은 이미 표준 패딩을 적용했습니다:

1. ✅ `app/(admin)/admin/students/[id]/page.tsx` - PageContainer 사용
2. ✅ `app/(admin)/admin/students/[id]/attendance-settings/page.tsx` - PageContainer 사용
3. ✅ `app/(student)/settings/page.tsx` - PageContainer 사용
4. ✅ `app/(student)/settings/notifications/page.tsx` - PageContainer 사용
5. ✅ `app/(student)/settings/devices/page.tsx` - PageContainer 사용
6. ✅ `app/(student)/settings/account/page.tsx` - PageContainer 사용
7. ✅ `app/(admin)/admin/content-metadata/page.tsx` - PageContainer 사용

## 향후 개선 대상

다음 파일들은 점진적으로 개선할 수 있습니다:

- `app/(student)/dashboard/page.tsx`
- `app/(admin)/admin/dashboard/page.tsx`
- `app/(admin)/admin/students/page.tsx`
- 기타 관리자 페이지들

## 마이그레이션 가이드

### Before

```tsx
<div className="p-6 md:p-10">
  <h1>제목</h1>
  {/* 콘텐츠 */}
</div>
```

### After

```tsx
<PageContainer widthType="LIST">
  <div className="flex flex-col gap-6">
    <PageHeader title="제목" />
    {/* 콘텐츠 */}
  </div>
</PageContainer>
```

## 참고

- `lib/constants/layout.ts`: 레이아웃 상수 정의
- `components/layout/PageContainer.tsx`: 표준 컨테이너 컴포넌트
- `components/layout/PageHeader.tsx`: 표준 헤더 컴포넌트










