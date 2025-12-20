# 컴포넌트 사용 가이드

이 문서는 TimeLevelUp 프로젝트의 주요 컴포넌트 사용법을 설명합니다.

---

## 목차

1. [SectionHeader](#sectionheader)
2. [BaseBookSelector](#basebookselector)
3. [SchoolMultiSelect](#schoolmultiselect)
4. [LazyRecharts](#lazyrecharts)

---

## SectionHeader

섹션 제목과 설명, 액션 버튼을 포함하는 헤더 컴포넌트입니다.

### Props

| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `title` | `string` | **필수** | 섹션 제목 |
| `description` | `string` | `undefined` | 섹션 설명 |
| `action` | `ReactNode` | `undefined` | 커스텀 액션 컴포넌트 |
| `actionLabel` | `string` | `undefined` | 액션 링크 텍스트 |
| `actionHref` | `string` | `undefined` | 액션 링크 주소 |
| `className` | `string` | `undefined` | 추가 CSS 클래스 |
| `size` | `"sm" \| "md" \| "lg"` | `undefined` | 크기 (없으면 level에 따라 자동 설정) |
| `level` | `"h1" \| "h2"` | `"h2"` | 시멘틱 태그 레벨 |

### 사용 예제

#### 기본 사용

```tsx
import { SectionHeader } from "@/components/molecules/SectionHeader";

function MyPage() {
  return (
    <SectionHeader
      title="학습 계획"
      description="오늘의 학습 계획을 확인하세요"
    />
  );
}
```

#### 링크 액션 포함

```tsx
<SectionHeader
  title="성적 관리"
  description="내신 및 모의고사 성적을 관리하세요"
  actionLabel="전체 보기"
  actionHref="/scores"
/>
```

#### 커스텀 액션 컴포넌트

```tsx
<SectionHeader
  title="학습 콘텐츠"
  description="교재, 강의, 커스텀 콘텐츠를 관리하세요"
  action={
    <button className="btn-primary">
      새 콘텐츠 추가
    </button>
  }
/>
```

#### 크기 및 레벨 조정

```tsx
<SectionHeader
  title="대시보드"
  level="h1"
  size="lg"
  description="학습 현황을 한눈에 확인하세요"
/>
```

---

## BaseBookSelector

교재 선택 및 등록을 위한 통합 컴포넌트입니다. 로직과 UI가 분리되어 있어 재사용성이 높습니다.

### Props

| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `value` | `string \| null` | `undefined` | 현재 선택된 교재 ID |
| `onChange` | `(bookId: string \| null) => void` | **필수** | 교재 선택 변경 콜백 |
| `books` | `BookItem[]` | **필수** | 교재 목록 |
| `createBookAction` | `BookCreateAction` | **필수** | 교재 생성 액션 함수 |
| `onCreateBook` | `(bookId: string) => void` | `undefined` | 새 교재 생성 후 콜백 |
| `disabled` | `boolean` | `false` | 비활성화 여부 |
| `className` | `string` | `""` | 추가 CSS 클래스 |
| `bookTypeLabel` | `string` | `"교재"` | 교재 타입 라벨 ("교재" 또는 "마스터 교재") |

### BookItem 타입

```typescript
type BookItem = {
  id: string;
  title: string;
  subtitle?: string;
  // ... 기타 필드
};
```

### BookCreateAction 타입

```typescript
type BookCreateAction = (formData: FormData) => Promise<{
  success: boolean;
  bookId: string | null;
  error: string | null;
}>;
```

### 사용 예제

#### 기본 사용

```tsx
import { BaseBookSelector } from "@/components/forms/BaseBookSelector";
import { createBookWithoutRedirect } from "@/app/(student)/actions/contentActions";
import { getBooks } from "@/lib/data/studentContents";

async function MyComponent() {
  const user = await getCurrentUser();
  const books = await getBooks(user.userId);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  return (
    <BaseBookSelector
      value={selectedBookId}
      onChange={setSelectedBookId}
      books={books}
      createBookAction={createBookWithoutRedirect}
      onCreateBook={async (bookId) => {
        // 새 교재 생성 후 목록 새로고침
        router.refresh();
        setSelectedBookId(bookId);
      }}
    />
  );
}
```

#### 마스터 교재 선택

```tsx
<BaseBookSelector
  value={selectedMasterBookId}
  onChange={setSelectedMasterBookId}
  books={masterBooks}
  createBookAction={createMasterBookAction}
  bookTypeLabel="마스터 교재"
/>
```

#### 비활성화 상태

```tsx
<BaseBookSelector
  value={selectedBookId}
  onChange={setSelectedBookId}
  books={books}
  createBookAction={createBookWithoutRedirect}
  disabled={isSubmitting}
/>
```

### 주의사항

1. **createBookAction 구현**: `FormData`를 받아 `{ success, bookId, error }` 형태를 반환해야 합니다.
2. **onCreateBook 콜백**: 새 교재 생성 후 목록을 새로고침하는 용도로 사용됩니다. 없으면 `onChange`만 호출됩니다.
3. **메타데이터 처리**: 컴포넌트 내부에서 `useBookMetadata` 훅을 사용하여 메타데이터를 자동으로 처리합니다.

---

## SchoolMultiSelect

여러 학교를 선택할 수 있는 멀티 셀렉트 컴포넌트입니다. 무한 루프 방지 메커니즘이 내장되어 있습니다.

### Props

| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `value` | `string[]` | `[]` | 선택된 학교 ID 배열 |
| `onChange` | `(value: string[]) => void` | **필수** | 선택 변경 콜백 |
| `type` | `"중학교" \| "고등학교" \| "대학교"` | `undefined` | 학교 타입 필터 |
| `placeholder` | `string` | `"대학교를 검색하세요"` | 검색 입력 필드 플레이스홀더 |
| `className` | `string` | `undefined` | 추가 CSS 클래스 |
| `disabled` | `boolean` | `false` | 비활성화 여부 |
| `maxCount` | `number` | `3` | 최대 선택 개수 |
| `onSchoolSelect` | `(school: School) => void` | `undefined` | 학교 선택 시 추가 처리 콜백 |

### School 타입

```typescript
type School = {
  id: string;
  name: string;
  type?: "중학교" | "고등학교" | "대학교";
  region?: string;
};
```

### 사용 예제

#### 기본 사용

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
    />
  );
}
```

#### 학교 타입 필터링

```tsx
<SchoolMultiSelect
  value={selectedHighSchools}
  onChange={setSelectedHighSchools}
  type="고등학교"
  maxCount={5}
  placeholder="고등학교를 검색하세요"
/>
```

#### 선택 시 추가 처리

```tsx
<SchoolMultiSelect
  value={selectedSchools}
  onChange={setSelectedSchools}
  onSchoolSelect={(school) => {
    // 학교 선택 시 추가 처리
    console.log("선택된 학교:", school);
    // 예: 학교 정보를 별도로 저장하거나 분석
  }}
/>
```

#### 비활성화 상태

```tsx
<SchoolMultiSelect
  value={selectedSchools}
  onChange={setSelectedSchools}
  disabled={isSubmitting}
/>
```

### 주의사항

1. **무한 루프 방지**: 컴포넌트 내부에서 `previousValueRef`를 사용하여 이전 값과 비교하므로, `value` prop의 참조가 변경되어도 내용이 같으면 재조회하지 않습니다.
2. **배열 참조**: `value` prop은 배열의 참조가 아닌 내용이 변경될 때만 업데이트됩니다.
3. **최대 개수**: `maxCount`에 도달하면 검색 기능이 비활성화됩니다.

---

## LazyRecharts

Recharts 라이브러리를 지연 로딩하는 차트 컴포넌트입니다. 초기 번들 크기를 줄이기 위해 사용합니다.

### 사용 가능한 컴포넌트

- `LazyBarChart` - 막대 차트
- `LazyLineChart` - 선 차트
- `LazyAreaChart` - 영역 차트
- `LazyPieChart` - 파이 차트
- `LazyComposedChart` - 복합 차트
- `LazyScatterChart` - 산점도 차트
- `LazyRadarChart` - 레이더 차트
- `LazyResponsiveContainer` - 반응형 컨테이너

### 사용 예제

#### 막대 차트

```tsx
import {
  LazyBarChart,
  LazyBar,
  LazyXAxis,
  LazyYAxis,
  LazyResponsiveContainer,
  LazyTooltip,
  LazyLegend,
} from "@/components/charts/LazyRecharts";

function MyBarChart() {
  const data = [
    { name: "월", value: 100 },
    { name: "화", value: 200 },
    { name: "수", value: 150 },
    { name: "목", value: 300 },
    { name: "금", value: 250 },
  ];

  return (
    <LazyResponsiveContainer width="100%" height={300}>
      <LazyBarChart data={data}>
        <LazyXAxis dataKey="name" />
        <LazyYAxis />
        <LazyTooltip />
        <LazyLegend />
        <LazyBar dataKey="value" fill="#8884d8" />
      </LazyBarChart>
    </LazyResponsiveContainer>
  );
}
```

#### 선 차트

```tsx
import {
  LazyLineChart,
  LazyLine,
  LazyXAxis,
  LazyYAxis,
  LazyResponsiveContainer,
  LazyCartesianGrid,
  LazyTooltip,
} from "@/components/charts/LazyRecharts";

function MyLineChart() {
  const data = [
    { name: "1월", score: 80 },
    { name: "2월", score: 85 },
    { name: "3월", score: 90 },
    { name: "4월", score: 88 },
  ];

  return (
    <LazyResponsiveContainer width="100%" height={300}>
      <LazyLineChart data={data}>
        <LazyCartesianGrid strokeDasharray="3 3" />
        <LazyXAxis dataKey="name" />
        <LazyYAxis />
        <LazyTooltip />
        <LazyLine type="monotone" dataKey="score" stroke="#8884d8" />
      </LazyLineChart>
    </LazyResponsiveContainer>
  );
}
```

#### 파이 차트

```tsx
import {
  LazyPieChart,
  LazyPie,
  LazyCell,
  LazyResponsiveContainer,
  LazyTooltip,
  LazyLegend,
} from "@/components/charts/LazyRecharts";

function MyPieChart() {
  const data = [
    { name: "국어", value: 30 },
    { name: "수학", value: 25 },
    { name: "영어", value: 20 },
    { name: "과학", value: 15 },
    { name: "기타", value: 10 },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <LazyResponsiveContainer width="100%" height={300}>
      <LazyPieChart>
        <LazyPie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <LazyCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </LazyPie>
        <LazyTooltip />
        <LazyLegend />
      </LazyPieChart>
    </LazyResponsiveContainer>
  );
}
```

#### 로딩 스켈레톤 커스터마이징

```tsx
import { ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";

function MyChart() {
  return (
    <LazyResponsiveContainer width="100%" height={400} fallbackHeight={400}>
      {/* 차트 컴포넌트 */}
    </LazyResponsiveContainer>
  );
}

// 또는 직접 사용
<ChartLoadingSkeleton height={300} />
```

### 주의사항

1. **직접 import 금지**: `recharts`를 직접 import하지 말고 `LazyRecharts`에서 import하세요.
2. **로딩 상태**: 차트가 로드되기 전에는 `ChartLoadingSkeleton`이 표시됩니다.
3. **캐싱**: Recharts 모듈은 한 번 로드되면 캐시되어 재사용됩니다.

### 성능 최적화

- **초기 번들 크기 감소**: Recharts (~327KB)를 지연 로딩하여 초기 번들 크기를 줄입니다.
- **코드 스플리팅**: 차트가 필요한 페이지에서만 Recharts를 로드합니다.
- **캐싱**: 한 번 로드된 Recharts 모듈은 캐시되어 재사용됩니다.

---

## 추가 리소스

- [프로젝트 README](../README.md)
- [개발 가이드라인](../.cursor/rules/project_rule.mdc)
- [프로젝트 구조 분석](../AGENTS.md)

---

**마지막 업데이트**: 2025-02-04

