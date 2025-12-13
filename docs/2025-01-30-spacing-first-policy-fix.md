# Spacing-First 정책 위반 수정

**작업 일시**: 2025-01-30  
**목적**: Spacing-First 정책 위반 사례 수정 및 중복 코드 최적화

---

## 작업 개요

프로젝트 전반에서 발견된 Spacing-First 정책 위반 사례를 수정하고, 중복 패턴을 공통 컴포넌트로 추출하여 코드 품질을 개선했습니다.

---

## 생성된 컴포넌트 및 유틸리티

### 1. PageHeader 컴포넌트
**파일**: `components/layout/PageHeader.tsx`

페이지 헤더 패턴을 표준화한 컴포넌트입니다.

**특징**:
- 제목, 설명, 액션 버튼 지원
- Spacing-First 정책 준수 (gap 사용)
- 타이포그래피 표준화 (text-h1 사용)

**사용 예시**:
```tsx
<PageHeader
  title="출석 SMS 발송 로그"
  description="출석 관련 SMS 발송 이력을 확인할 수 있습니다."
  action={<Link href="/admin/sms/send">SMS 발송하기</Link>}
/>
```

### 2. StatCard 컴포넌트
**파일**: `components/molecules/StatCard.tsx`

통계 카드 패턴을 표준화한 컴포넌트입니다.

**특징**:
- 11가지 색상 옵션 지원 (blue, purple, emerald, green, red, amber, indigo, teal, cyan, pink, violet)
- Spacing-First 정책 준수 (gap-1 사용)
- 일관된 스타일링

**사용 예시**:
```tsx
<StatCard label="책" value="5개" color="blue" />
<StatCard label="강의" value="3개" color="purple" />
```

### 3. Spacing 유틸리티
**파일**: `lib/utils/spacing.ts`

표준 spacing 값을 정의한 유틸리티입니다.

**제공 값**:
- `section`: 섹션 간 간격 (gap-6)
- `card`: 카드 내부 간격 (gap-4)
- `form`: 폼 필드 간격 (gap-3)
- `page`: 페이지 레벨 간격 (gap-8)
- 반응형 spacing 값도 제공

---

## 수정된 파일

### 관리자 페이지

#### 1. `app/(admin)/admin/attendance/sms-logs/page.tsx`
**변경 사항**:
- `mb-8`, `mb-6`, `mt-2` 제거
- `PageHeader` 컴포넌트 사용
- `flex flex-col gap-6`로 섹션 간격 관리

**Before**:
```tsx
<div className="mb-8">
  <h1 className="text-3xl font-bold text-gray-900">출석 SMS 발송 로그</h1>
  <p className="mt-2 text-sm text-gray-600">...</p>
</div>
<div className="mb-6">
  <SMSLogsFilters />
</div>
```

**After**:
```tsx
<div className="flex flex-col gap-6">
  <PageHeader
    title="출석 SMS 발송 로그"
    description="출석 관련 SMS 발송 이력을 확인할 수 있습니다."
  />
  <SMSLogsFilters />
  ...
</div>
```

#### 2. `app/(admin)/admin/students/[id]/_components/ContentUsageSection.tsx`
**변경 사항**:
- `mb-4`, `mb-6`, `mt-1`, `mb-3`, `mb-2` 제거
- `StatCard` 컴포넌트 사용
- `ProgressBar` 컴포넌트 사용 (인라인 스타일 제거)
- `flex flex-col gap-6`, `gap-3`, `gap-2`로 간격 관리

**Before**:
```tsx
<h2 className="mb-4 text-xl font-semibold text-gray-900">콘텐츠 사용 현황</h2>
<div className="mb-6 grid grid-cols-3 gap-4">
  <div className="rounded-lg bg-blue-50 p-4">
    <div className="text-sm text-blue-600">책</div>
    <div className="mt-1 text-2xl font-bold text-blue-700">...</div>
  </div>
</div>
<div className="h-2 w-full rounded-full bg-gray-200">
  <div
    className="h-2 rounded-full bg-indigo-600 transition-all"
    style={{ width: `${content.progress}%` }}
  />
</div>
```

**After**:
```tsx
<div className="flex flex-col gap-6">
  <h2 className="text-xl font-semibold text-gray-900">콘텐츠 사용 현황</h2>
  <div className="grid grid-cols-3 gap-4">
    <StatCard label="책" value={`${contentUsage.books.length}개`} color="blue" />
    ...
  </div>
  <ProgressBar
    value={Math.min(100, content.progress)}
    max={100}
    color="indigo"
    height="sm"
  />
</div>
```

### 학생 페이지

#### 3. `app/(student)/contents/_components/ContentsListClient.tsx`
**변경 사항**:
- `mb-3`, `mb-6` 제거
- `flex flex-col gap-4`로 간격 관리

**Before**:
```tsx
<div>
  <div className="mb-3 flex items-center gap-2 px-1">...</div>
  <ul className="grid gap-4 mb-6">...</ul>
</div>
```

**After**:
```tsx
<div className="flex flex-col gap-4">
  <div className="flex items-center gap-2 px-1">...</div>
  <ul className="grid gap-4">...</ul>
</div>
```

#### 4. `app/(student)/scores/dashboard/_components/ScoreConsistencyAnalysis.tsx`
**변경 사항**:
- `mb-4`, `mb-2` 제거
- `flex flex-col gap-4`, `gap-2`로 간격 관리

**Before**:
```tsx
<div className="mx-auto max-w-md">
  <div className="mb-4 text-6xl">📊</div>
  <h3 className="mb-2 text-lg font-semibold text-gray-900">...</h3>
  <p className="text-sm text-gray-500">...</p>
</div>
```

**After**:
```tsx
<div className="mx-auto flex max-w-md flex-col gap-4">
  <div className="text-6xl">📊</div>
  <div className="flex flex-col gap-2">
    <h3 className="text-lg font-semibold text-gray-900">...</h3>
    <p className="text-sm text-gray-500">...</p>
  </div>
</div>
```

#### 5. `app/(student)/plan/new-group/_components/Step1BasicInfo/BlockSetSection.tsx`
**변경 사항**:
- `mb-2` 제거
- `flex flex-col gap-2`로 간격 관리

**Before**:
```tsx
<div className="rounded-lg border border-gray-200 bg-white p-4">
  <h3 className="mb-2 text-sm font-semibold text-gray-900">
    추가된 블록 ({addedBlocks.length}개)
  </h3>
  <div className="space-y-2">...</div>
</div>
```

**After**:
```tsx
<div className="rounded-lg border border-gray-200 bg-white p-4">
  <div className="flex flex-col gap-2">
    <h3 className="text-sm font-semibold text-gray-900">
      추가된 블록 ({addedBlocks.length}개)
    </h3>
    <div className="space-y-2">...</div>
  </div>
</div>
```

#### 6. `app/(student)/analysis/patterns/_components/PatternAnalysisView.tsx`
**변경 사항**:
- `mb-4`, `mb-2`, `mb-1`, `mt-1`, `mt-2`, `mt-4` 제거
- `ProgressBar` 컴포넌트 사용 (인라인 스타일 제거)
- `flex flex-col gap-4`, `gap-3`, `gap-2`, `gap-1`로 간격 관리

**주요 변경**:
- 요일별 학습 분포: 인라인 스타일 → `ProgressBar` 컴포넌트
- 주간 학습 추이: 인라인 스타일 → `ProgressBar` 컴포넌트
- 학습 히트맵: `mb-2`, `mb-1` 제거

#### 7. `app/(student)/report/weekly/_components/SubjectTimePieChart.tsx`
**변경 사항**:
- `mt-4` 제거
- `flex flex-col gap-4`로 간격 관리

**Before**:
```tsx
<div>
  <ResponsiveContainer>...</ResponsiveContainer>
  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">...</div>
</div>
```

**After**:
```tsx
<div className="flex flex-col gap-4">
  <ResponsiveContainer>...</ResponsiveContainer>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">...</div>
</div>
```

### 부모 페이지

#### 8. `app/(parent)/parent/_components/RiskSignals.tsx`
**변경 사항**:
- `mb-4`, `mb-2` 제거
- `ProgressBar` 컴포넌트 사용 (인라인 스타일 제거)
- `flex flex-col gap-4`, `gap-3`, `gap-2`, `gap-1`로 간격 관리

**Before**:
```tsx
<h3 className="text-lg font-semibold text-red-900 mb-4">🚨 위험 신호</h3>
<p className="text-sm text-red-700 mb-4">...</p>
<div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
  <div
    className="h-full bg-red-500 transition-all"
    style={{ width: `${signal.risk_score}%` }}
  />
</div>
```

**After**:
```tsx
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-2">
    <h3 className="text-lg font-semibold text-red-900">🚨 위험 신호</h3>
    <p className="text-sm text-red-700">...</p>
  </div>
  <ProgressBar
    value={signal.risk_score}
    max={100}
    color="red"
    height="sm"
  />
</div>
```

---

## ProgressBar 컴포넌트 개선

**파일**: `components/atoms/ProgressBar.tsx`

동적 width 값이 필요하므로 인라인 스타일 사용이 적절합니다. 주석을 추가하여 이유를 명시했습니다.

```tsx
// 동적 width는 인라인 스타일이 필요 (Tailwind arbitrary values는 빌드 시점에 생성되어야 함)
style={{ width: `${percentage}%` }}
```

---

## 개선 효과

### 코드 품질
- ✅ Spacing-First 정책 준수
- ✅ 중복 코드 제거
- ✅ 공통 컴포넌트 재사용
- ✅ 일관된 스타일링

### 유지보수성
- ✅ 표준화된 spacing 값 사용
- ✅ 재사용 가능한 컴포넌트
- ✅ 명확한 코드 구조

### 성능
- ✅ 불필요한 margin 계산 제거
- ✅ CSS 최적화 (gap 사용)

---

## 향후 작업

1. **추가 파일 수정**: 나머지 385개 파일의 margin 사용 제거
2. **ESLint 규칙 추가**: margin 사용 금지 규칙 검토
3. **시각적 회귀 테스트**: 수정 전후 스크린샷 비교

---

## 참고

- Spacing-First 정책: `.cursor/rules/project_rule.mdc`
- 생성된 컴포넌트: `components/layout/PageHeader.tsx`, `components/molecules/StatCard.tsx`
- Spacing 유틸리티: `lib/utils/spacing.ts`

