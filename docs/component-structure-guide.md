# 컴포넌트 구조 가이드

## 📅 작성일: 2024년 11월 26일

---

## 1. 현재 컴포넌트 구조

### 1.1 공용 컴포넌트 (`components/`)

```
components/
├── layout/
│   └── RoleBasedLayout.tsx
├── navigation/
│   ├── global/
│   │   ├── Breadcrumbs.tsx
│   │   ├── categoryConfig.ts
│   │   ├── CategoryNav.tsx
│   │   └── resolveActiveCategory.ts
│   └── student/
│       ├── studentCategories.ts
│       └── StudentCategoryNav.tsx
└── ui/
    ├── Badge.tsx
    ├── Card.tsx
    ├── Dialog.tsx
    ├── EmptyState.tsx
    ├── ErrorState.tsx
    ├── FormInput.tsx
    ├── FormMessage.tsx
    ├── FormSubmitButton.tsx
    ├── LoadingSkeleton.tsx
    ├── ProgressBar.tsx
    ├── SchoolMultiSelect.tsx
    ├── SchoolSelect.tsx
    ├── SectionHeader.tsx
    ├── SkeletonForm.tsx
    ├── TimeRangeInput.tsx
    ├── Toast.tsx
    └── ToastProvider.tsx
```

### 1.2 페이지별 컴포넌트 (`_components/`)

- 91개 파일에서 `_components` 폴더 사용 중
- 각 페이지/기능별로 로컬 컴포넌트 관리

---

## 2. 권장 컴포넌트 구조

### 2.1 카테고리별 분류

```
components/
├── ui/                   # 기본 UI 컴포넌트 (현재 유지)
│   ├── Badge.tsx
│   ├── Button.tsx        # 추가 권장
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Input.tsx         # FormInput 대체
│   ├── Select.tsx        # 추가 권장
│   └── ...
│
├── forms/                # 폼 관련 컴포넌트 (신규)
│   ├── FormField.tsx
│   ├── FormMessage.tsx   # ui/에서 이동
│   ├── FormSubmitButton.tsx
│   ├── SchoolSelect.tsx  # ui/에서 이동
│   ├── SchoolMultiSelect.tsx
│   └── TimeRangeInput.tsx
│
├── layout/               # 레이아웃 컴포넌트 (확장)
│   ├── RoleBasedLayout.tsx
│   ├── PageHeader.tsx    # 추가 권장
│   ├── PageContainer.tsx # 추가 권장
│   └── Sidebar.tsx       # 추가 권장
│
├── navigation/           # 네비게이션 (현재 유지)
│   ├── global/
│   └── student/
│
├── feedback/             # 피드백 컴포넌트 (신규)
│   ├── Toast.tsx         # ui/에서 이동
│   ├── ToastProvider.tsx
│   ├── Alert.tsx         # 추가 권장
│   └── Spinner.tsx       # 추가 권장
│
├── data-display/         # 데이터 표시 (신규)
│   ├── EmptyState.tsx    # ui/에서 이동
│   ├── ErrorState.tsx
│   ├── LoadingSkeleton.tsx
│   └── SkeletonForm.tsx
│
└── charts/               # 차트 컴포넌트 (신규)
    ├── BarChart.tsx
    ├── LineChart.tsx
    └── PieChart.tsx
```

### 2.2 네이밍 규칙

| 유형 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `SchoolSelect.tsx` |
| 폴더 | kebab-case | `data-display/` |
| 상수/설정 | camelCase | `categoryConfig.ts` |
| 훅 파일 | camelCase + use | `useSchoolSearch.ts` |

---

## 3. 컴포넌트 분류 기준

### 3.1 공용 컴포넌트 (`components/`)

다음 조건 중 하나 이상을 만족할 때:

- **3곳 이상**에서 사용됨
- **도메인 독립적** (특정 비즈니스 로직 없음)
- **스타일 일관성** 필요 (브랜드 컴포넌트)

### 3.2 페이지 컴포넌트 (`_components/`)

다음 조건을 모두 만족할 때:

- **1-2곳**에서만 사용
- **특정 페이지**에 종속
- **비즈니스 로직** 포함

### 3.3 예시

```typescript
// ✅ 공용 컴포넌트 (components/ui/)
// - 3곳 이상에서 사용
// - 순수 UI (로직 없음)
export function Badge({ variant, children }: BadgeProps) {
  return <span className={badgeVariants[variant]}>{children}</span>;
}

// ✅ 페이지 컴포넌트 (_components/)
// - scores 페이지에서만 사용
// - 성적 관련 비즈니스 로직 포함
export function ScoreForm({ action, initialData }: ScoreFormProps) {
  // 성적 검증 로직
  // 성적 계산 로직
  return <form>...</form>;
}
```

---

## 4. 재사용 가능한 컴포넌트 추출 후보

### 4.1 폼 컴포넌트

현재 유사한 폼이 여러 곳에 분산:

```
app/(student)/scores/_components/ScoreForm.tsx
app/(student)/scores/_components/ScoreFormModal.tsx
app/(student)/scores/mock/.../_components/MockScoreFormModal.tsx
app/(student)/scores/school/.../_components/SchoolScoreForm.tsx
```

**권장 개선:**

```typescript
// components/forms/ScoreForm/
// ├── ScoreFormBase.tsx      # 공통 폼 구조
// ├── SchoolScoreFields.tsx  # 내신 전용 필드
// ├── MockScoreFields.tsx    # 모의고사 전용 필드
// └── index.tsx              # 조건부 렌더링
```

### 4.2 차트 컴포넌트

현재 차트가 각 대시보드에 개별 구현:

```
app/(student)/scores/dashboard/_components/CourseAverageChart.tsx
app/(student)/scores/dashboard/school/_components/SchoolGradeDistributionChart.tsx
app/(student)/report/weekly/_components/WeeklyTimeBarChart.tsx
```

**권장 개선:**

```typescript
// components/charts/
// ├── BaseChart.tsx          # 공통 차트 wrapper
// ├── GradeChart.tsx         # 성적 관련 차트
// ├── TimeChart.tsx          # 시간 관련 차트
// └── hooks/useChartData.ts  # 데이터 변환 훅
```

---

## 5. 점진적 마이그레이션 계획

### Phase 1: 구조 정비 (현재)
- [x] 컴포넌트 구조 가이드 문서화
- [ ] 공용 컴포넌트 폴더 확장 (forms, feedback 등)

### Phase 2: 새 컴포넌트 적용
- [ ] 새로 만드는 컴포넌트는 가이드라인 준수
- [ ] 기존 컴포넌트 사용 시 위치 유지

### Phase 3: 점진적 통합
- [ ] 3곳 이상 사용되는 컴포넌트 추출
- [ ] 중복 컴포넌트 통합
- [ ] 페이지별 import 경로 업데이트

---

## 6. 컴포넌트 작성 가이드

### 6.1 기본 구조

```typescript
// components/ui/Button.tsx

import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "rounded-lg font-medium transition-colors",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

const variantStyles = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "text-gray-600 hover:bg-gray-100",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};
```

### 6.2 Export 규칙

```typescript
// components/ui/index.ts
export { Badge } from "./Badge";
export { Button, type ButtonProps } from "./Button";
export { Card } from "./Card";
// ...
```

---

## 7. 참고

- [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)
- [Component Driven Development](https://www.componentdriven.org/)
