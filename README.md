# TimeLevelUp

효율적인 학습 계획 및 성적 관리 시스템

## 📋 프로젝트 개요

**TimeLevelUp**은 학생의 성적 분석을 기반으로 맞춤형 학습 플랜을 자동 생성하는 AI 기반 통합 학습 관리 시스템입니다. 내신성적과 모의고사 성적을 분석하여 적합한 교재와 강의를 추천하고, 학생의 수준과 학습 가능 시간을 고려하여 최적의 학습 스케줄을 자동 생성합니다.

### 핵심 기능

- **AI 기반 맞춤형 학습 플랜**: 학생 성적 분석을 통한 개인화된 학습 경로 제공
- **자동 스케줄링**: 복잡한 시간 제약 조건을 고려한 최적 학습 스케줄 자동 생성
- **실시간 모니터링**: 학습 진행 상황 실시간 추적 및 피드백
- **멀티테넌트 지원**: 여러 프렌차이즈 지점이 독립적으로 사용 가능

---

## 🚀 시작하기

### 필수 요구사항

- Node.js 18.x 이상
- npm 또는 pnpm
- Supabase 계정 및 프로젝트

### 설치

```bash
# 의존성 설치
npm install
# 또는
pnpm install
```

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 개발 서버 실행

```bash
npm run dev      # 개발 서버 시작 (포트 3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 시작
npm run lint     # ESLint 실행
npm run analyze  # 번들 분석 (ANALYZE=true next build)
```

---

## 🏗 프로젝트 구조

```
project/
├── app/                    # Next.js App Router 페이지 및 라우트
│   ├── (admin)/           # 관리자 전용 페이지
│   ├── (parent)/          # 부모 전용 페이지
│   ├── (student)/         # 학생 전용 페이지
│   ├── (superadmin)/      # 슈퍼 관리자 전용 페이지
│   ├── actions/           # Server Actions
│   └── api/               # API Routes
├── components/            # 재사용 가능한 UI 컴포넌트
│   ├── atoms/             # 기본 원자 컴포넌트 (Button, Input, Badge 등)
│   ├── molecules/         # 분자 컴포넌트 (Card, FormField, SectionHeader 등)
│   ├── organisms/         # 유기체 컴포넌트 (DataTable, Pagination 등)
│   ├── forms/             # 폼 관련 컴포넌트
│   │   └── book-selector/ # 교재 선택 관련 컴포넌트
│   ├── ui/                # UI 라이브러리 컴포넌트
│   │   └── hooks/         # UI 관련 커스텀 훅
│   ├── charts/            # 차트 컴포넌트 (LazyRecharts)
│   ├── layout/            # 레이아웃 컴포넌트
│   └── navigation/        # 네비게이션 컴포넌트
├── lib/                   # 유틸리티, 설정, 타입 정의
│   ├── supabase/          # Supabase 클라이언트
│   ├── auth/              # 인증 유틸리티
│   ├── data/              # 데이터 페칭 함수
│   ├── hooks/             # 커스텀 React 훅
│   ├── domains/           # 도메인별 비즈니스 로직
│   └── utils/            # 유틸리티 함수
├── public/                # 정적 파일 (이미지, 아이콘 등)
├── scripts/               # 유틸리티 스크립트
├── supabase/              # Supabase 마이그레이션 파일
└── docs/                  # 프로젝트 문서
```

---

## 📦 주요 기술 스택

### 핵심 프레임워크
- **Next.js 16.0.10** - React 프레임워크 (App Router)
- **React 19.2.0** - UI 라이브러리
- **TypeScript 5** - 타입 안전성
- **Tailwind CSS 4** - 유틸리티 CSS 프레임워크

### 상태 관리
- **@tanstack/react-query 5.90.10** - 서버 상태 관리
- **Zustand 5.0.9** - 클라이언트 상태 관리 (선택적 사용)

### 백엔드 및 인증
- **@supabase/supabase-js 2.81.1** - Supabase 클라이언트
- **@supabase/ssr 0.7.0** - SSR 지원
- **@supabase/auth-helpers-nextjs 0.10.0** - Next.js 인증 헬퍼

### UI 라이브러리
- **recharts 3.5.1** - 차트 라이브러리 (Lazy Loading 적용)
- **lucide-react 0.554.0** - 아이콘 라이브러리 (최적화됨)
- **framer-motion 12.23.25** - 애니메이션 라이브러리
- **react-hook-form 7.68.0** - 폼 상태 관리
- **zod 3.23.8** - 스키마 검증

### 스타일링
- **tailwindcss 4** - 유틸리티 CSS 프레임워크
- **clsx 2.1.1** - 조건부 클래스명
- **tailwind-merge 3.4.0** - Tailwind 클래스 병합
- **next-themes 0.4.6** - 다크모드 지원

---

## 🎨 주요 컴포넌트 사용 가이드

### BaseBookSelector

교재 선택 및 등록을 위한 통합 컴포넌트입니다. 로직과 UI가 분리되어 있어 재사용성이 높습니다.

```tsx
import { BaseBookSelector } from "@/components/forms/BaseBookSelector";
import { createBookWithoutRedirect } from "@/app/(student)/actions/contentActions";

function MyComponent() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const books = [/* 교재 목록 */];

  return (
    <BaseBookSelector
      value={selectedBookId}
      onChange={setSelectedBookId}
      books={books}
      createBookAction={createBookWithoutRedirect}
      onCreateBook={(bookId) => {
        // 새 교재 생성 후 처리
        setSelectedBookId(bookId);
      }}
      bookTypeLabel="교재"
    />
  );
}
```

**주의사항**:
- `createBookAction`은 `FormData`를 받아 `{ success: boolean, bookId: string | null, error: string | null }` 형태를 반환해야 합니다.
- `onCreateBook` 콜백은 새 교재 생성 후 목록을 새로고침하는 용도로 사용됩니다.

### SchoolMultiSelect

여러 학교를 선택할 수 있는 멀티 셀렉트 컴포넌트입니다. 무한 루프 방지 메커니즘이 내장되어 있습니다.

```tsx
import SchoolMultiSelect from "@/components/ui/SchoolMultiSelect";

function MyComponent() {
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);

  return (
    <SchoolMultiSelect
      value={selectedSchools}
      onChange={setSelectedSchools}
      type="대학교"
      maxCount={3}
      placeholder="대학교를 검색하세요"
      onSchoolSelect={(school) => {
        // 학교 선택 시 추가 처리
        console.log("선택된 학교:", school);
      }}
    />
  );
}
```

**주의사항**:
- `value` prop은 배열의 참조가 아닌 내용이 변경될 때만 업데이트됩니다.
- `maxCount` 기본값은 3입니다.

### SectionHeader

섹션 제목과 설명, 액션 버튼을 포함하는 헤더 컴포넌트입니다.

```tsx
import { SectionHeader } from "@/components/molecules/SectionHeader";

function MyComponent() {
  return (
    <SectionHeader
      title="학습 계획"
      description="오늘의 학습 계획을 확인하세요"
      actionLabel="더보기"
      actionHref="/plan"
      size="lg"
      level="h1"
    />
  );
}
```

### LazyRecharts

Recharts 라이브러리를 지연 로딩하는 차트 컴포넌트입니다. 초기 번들 크기를 줄이기 위해 사용합니다.

```tsx
import { LazyBarChart, LazyBar, LazyXAxis, LazyYAxis, LazyResponsiveContainer } from "@/components/charts/LazyRecharts";

function MyChart() {
  const data = [
    { name: "월", value: 100 },
    { name: "화", value: 200 },
    // ...
  ];

  return (
    <LazyResponsiveContainer width="100%" height={300}>
      <LazyBarChart data={data}>
        <LazyXAxis dataKey="name" />
        <LazyYAxis />
        <LazyBar dataKey="value" fill="#8884d8" />
      </LazyBarChart>
    </LazyResponsiveContainer>
  );
}
```

**주의사항**:
- 차트가 로드되기 전에는 `ChartLoadingSkeleton`이 표시됩니다.
- `recharts`를 직접 import하지 말고 `LazyRecharts`에서 import하세요.

자세한 사용법은 [컴포넌트 가이드](./docs/COMPONENT_GUIDE.md)를 참고하세요.

---

## 🛠 개발 가이드

### 성능 최적화 컨벤션

#### 1. Lazy Loading

무거운 라이브러리나 컴포넌트는 동적 import를 사용하여 지연 로딩합니다.

```tsx
// ✅ 좋은 예: 동적 import
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <LoadingSkeleton />,
});

// ❌ 나쁜 예: 직접 import
import HeavyComponent from "./HeavyComponent";
```

#### 2. 코드 스플리팅

페이지별로 코드를 분리하여 초기 번들 크기를 줄입니다.

```tsx
// Next.js는 자동으로 페이지별 코드 스플리팅을 수행합니다
// 추가로 필요한 경우:
const Component = dynamic(() => import("./Component"));
```

#### 3. 이미지 최적화

Next.js Image 컴포넌트를 사용하여 이미지를 최적화합니다.

```tsx
import Image from "next/image";

<Image
  src="/image.jpg"
  alt="설명"
  width={300}
  height={200}
  priority={isAboveFold} // 첫 화면에 보이는 이미지인 경우
/>
```

### 컴포넌트 작성 규칙

#### 1. 로직과 UI 분리

복잡한 로직은 커스텀 훅으로 분리합니다.

```tsx
// ✅ 좋은 예
function MyComponent() {
  const { data, isLoading, handleSubmit } = useMyLogic();
  return <UIComponent data={data} onSubmit={handleSubmit} />;
}

// ❌ 나쁜 예: 로직과 UI가 섞여 있음
function MyComponent() {
  const [data, setData] = useState();
  // ... 복잡한 로직
  return <div>...</div>;
}
```

#### 2. 메모이제이션

불필요한 리렌더링을 방지하기 위해 `React.memo`를 사용합니다.

```tsx
export const MyComponent = memo(function MyComponent({ prop1, prop2 }) {
  // ...
});
```

#### 3. 타입 안전성

모든 컴포넌트와 함수에 TypeScript 타입을 명시합니다.

```tsx
type MyComponentProps = {
  title: string;
  description?: string;
  onAction?: () => void;
};

export function MyComponent({ title, description, onAction }: MyComponentProps) {
  // ...
}
```

### 스타일링 규칙

#### 1. Tailwind CSS 우선 사용

인라인 스타일은 피하고 Tailwind 유틸리티 클래스를 사용합니다.

```tsx
// ✅ 좋은 예
<div className="flex items-center gap-4 p-6 rounded-lg bg-white">

// ❌ 나쁜 예
<div style={{ display: "flex", padding: "24px" }}>
```

#### 2. Spacing-First 정책

외곽 여백은 최상단 래퍼의 `padding`, 형제 요소 간 간격은 부모의 `gap`으로 관리합니다.

```tsx
// ✅ 좋은 예
<div className="p-6">
  <div className="flex flex-col gap-4">
    <Card />
    <Card />
  </div>
</div>

// ❌ 나쁜 예
<div>
  <Card className="mb-4" />
  <Card />
</div>
```

자세한 개발 가이드라인은 [`.cursor/rules/project_rule.mdc`](.cursor/rules/project_rule.mdc)를 참고하세요.

---

## 📚 문서

- [컴포넌트 사용 가이드](./docs/COMPONENT_GUIDE.md) - 주요 컴포넌트 사용법
- [프로젝트 구조 분석](./AGENTS.md) - 상세한 프로젝트 구조 설명
- [개발 가이드라인](.cursor/rules/project_rule.mdc) - 코딩 컨벤션 및 규칙

---

## 🧪 테스트

```bash
npm run test        # 테스트 실행
npm run test:watch  # 테스트 감시 모드
```

---

## 📝 라이선스

이 프로젝트는 비공개 프로젝트입니다.

---

## 🤝 기여

프로젝트에 기여하고 싶으시다면 이슈를 생성하거나 풀 리퀘스트를 보내주세요.

---

**마지막 업데이트**: 2025-02-04

