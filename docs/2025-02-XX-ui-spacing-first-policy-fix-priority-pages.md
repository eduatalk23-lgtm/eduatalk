# UI 개선 - Spacing-First 정책 준수 (우선순위 높은 페이지)

**작업 일시**: 2025-02-XX  
**목적**: 우선순위 높은 3개 페이지의 Spacing-First 정책 위반 사항 수정 및 중복 코드 최적화

---

## 작업 개요

우선순위 높은 3개 페이지에서 발견된 Spacing-First 정책 위반 사항을 수정하고, 중복 코드를 최적화하여 재사용 가능한 컴포넌트로 추출했습니다.

---

## 수정된 페이지

### 1. `app/(admin)/admin/tools/page.tsx`

**수정 사항:**
- `mb-8` (헤더 하단 여백) 제거
- `mb-4` (아이콘 하단 여백, 설명 하단 여백) 제거
- `mb-2` (제목 하단 여백) 제거
- `PageHeader` 컴포넌트 사용하여 헤더 영역 표준화
- `ToolCard` 컴포넌트 생성 및 적용으로 중복 코드 제거
- 최상위 컨테이너에 `flex flex-col gap-6` 적용

**Before:**
```tsx
<div className="p-6 md:p-10">
  <h1 className="mb-8 text-h1 text-gray-900">관리 도구</h1>
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 text-2xl">📋</div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">플랜 대량 생성</h2>
      <p className="mb-4 text-sm text-gray-500">...</p>
      <button disabled>준비 중</button>
    </div>
    {/* 반복... */}
  </div>
</div>
```

**After:**
```tsx
<div className="p-6 md:p-10">
  <div className="flex flex-col gap-6">
    <PageHeader
      title="관리 도구"
      description="학생 관리와 데이터 처리를 위한 도구를 사용하세요"
    />
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ToolCard
        icon="📋"
        title="플랜 대량 생성"
        description="여러 학생에게 동일한 플랜을 일괄 생성합니다."
        buttonText="준비 중"
        buttonDisabled={true}
      />
      {/* 반복... */}
    </div>
  </div>
</div>
```

### 2. `app/(student)/scores/dashboard/unified/page.tsx`

**수정 사항:**
- `mb-6` (헤더 하단 여백) 제거
- `mt-8` (추가 액션 상단 여백) 제거
- `PageHeader` 컴포넌트 사용하여 헤더 표준화
- 에러 처리 부분도 `PageHeader` 사용
- 최상위 컨테이너에 `flex flex-col gap-6` 적용
- `text-3xl font-bold` → `text-h1` 변경

**Before:**
```tsx
<section className="mx-auto max-w-6xl p-6 md:p-8">
  <div className="mb-6 flex flex-col gap-2">
    <h1 className="text-3xl font-bold text-gray-900">성적 대시보드</h1>
    <p className="text-sm text-gray-600">...</p>
  </div>
  <div className="flex flex-col gap-6">...</div>
  <div className="mt-8 flex flex-wrap gap-4">...</div>
</section>
```

**After:**
```tsx
<section className="mx-auto max-w-6xl p-6 md:p-8">
  <div className="flex flex-col gap-6">
    <PageHeader
      title="성적 대시보드"
      description="내신 및 모의고사 성적을 통합 분석하고 입시 전략을 제시합니다."
    />
    <div className="flex flex-col gap-6">...</div>
    <div className="flex flex-wrap gap-4">...</div>
  </div>
</section>
```

### 3. `app/(student)/dashboard/page.tsx`

**검토 결과:**
- `mt-auto` 사용 (230번 줄) - flexbox 하단 정렬을 위한 예외 허용 주석 있음 → 유지
- `pt-2` 사용 (77번 줄) - padding이므로 문제 없음
- `colorClasses`는 다른 컴포넌트와 패턴이 다름 (그라디언트 vs 단색) → 추출 불필요
- 다른 margin 사용 없음 → 수정 불필요

---

## 생성된 컴포넌트

### ToolCard 컴포넌트

**파일**: `app/(admin)/admin/tools/_components/ToolCard.tsx`

**특징:**
- Spacing-First 정책 준수 (gap 사용)
- 카드 내부: `flex flex-col gap-4`
- 아이콘/제목/설명/버튼 간격: gap으로 관리
- 재사용 가능한 컴포넌트로 중복 코드 제거

**Props:**
```typescript
type ToolCardProps = {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  buttonDisabled?: boolean;
  onButtonClick?: () => void;
};
```

**사용 예시:**
```tsx
<ToolCard
  icon="📋"
  title="플랜 대량 생성"
  description="여러 학생에게 동일한 플랜을 일괄 생성합니다."
  buttonText="준비 중"
  buttonDisabled={true}
/>
```

---

## 개선 효과

### 코드 품질
- ✅ Spacing-First 정책 준수
- ✅ 중복 코드 제거 (3개 카드 → ToolCard 컴포넌트)
- ✅ 공통 컴포넌트 재사용
- ✅ 일관된 스타일링

### 유지보수성
- ✅ 표준화된 spacing 값 사용
- ✅ 재사용 가능한 컴포넌트
- ✅ 명확한 코드 구조
- ✅ PageHeader 컴포넌트로 헤더 표준화

### 성능
- ✅ 불필요한 margin 계산 제거
- ✅ CSS 최적화 (gap 사용)

---

## 검증 결과

### Spacing-First 정책 준수 확인

1. **admin/tools/page.tsx**
   - ✅ 모든 `mt-`, `mb-`, `mx-`, `my-` 제거 확인
   - ✅ `gap` 사용으로 대체 확인

2. **scores/dashboard/unified/page.tsx**
   - ✅ 모든 `mt-`, `mb-` 제거 확인
   - ✅ `gap` 사용으로 대체 확인
   - ✅ `mx-auto`는 중앙 정렬용이므로 문제 없음

3. **dashboard/page.tsx**
   - ✅ `mt-auto`는 예외 허용이므로 유지
   - ✅ 다른 margin 사용 없음

### Linter 검증
- ✅ 모든 수정된 파일에서 linter 에러 없음

---

## 참고 파일

- [components/layout/PageHeader.tsx](components/layout/PageHeader.tsx) - PageHeader 컴포넌트
- [app/(admin)/admin/tools/_components/ToolCard.tsx](app/(admin)/admin/tools/_components/ToolCard.tsx) - ToolCard 컴포넌트
- [docs/2025-01-30-spacing-first-policy-fix.md](docs/2025-01-30-spacing-first-policy-fix.md) - 이전 수정 사례

---

## 향후 작업

1. **추가 페이지 수정**: 나머지 우선순위 중간/낮은 페이지의 margin 사용 제거
2. **ESLint 규칙 추가**: margin 사용 금지 규칙 검토
3. **시각적 회귀 테스트**: 수정 전후 스크린샷 비교


