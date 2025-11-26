# Atomic Design 기반 UI 컴포넌트 재구성

## 📋 작업 개요

중복 UI 컴포넌트를 제거하고 Atomic Design 패턴(atoms/molecules/organisms)으로 재구성했습니다.

## 🎯 목표

1. **중복 제거**: 비슷한 기능의 컴포넌트 통합
2. **일관성**: 통일된 API와 스타일링
3. **재사용성**: 조합 가능한 기본 컴포넌트 제공
4. **유지보수성**: 명확한 계층 구조

## 📁 새로운 디렉토리 구조

```
components/
├── atoms/           # 가장 기본적인 UI 요소
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Label.tsx
│   ├── ProgressBar.tsx
│   ├── Select.tsx
│   ├── Skeleton.tsx
│   ├── Spinner.tsx
│   └── index.ts
├── molecules/       # atoms의 조합
│   ├── Card.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   ├── FormField.tsx
│   ├── SectionHeader.tsx
│   ├── Tabs.tsx
│   ├── Toast.tsx
│   └── index.ts
├── organisms/       # 복잡한 UI 구성
│   ├── DataTable.tsx
│   ├── Dialog.tsx
│   ├── LoadingOverlay.tsx
│   ├── Pagination.tsx
│   ├── ToastContainer.tsx
│   └── index.ts
├── layout/          # 레이아웃 컴포넌트 (기존 유지)
├── navigation/      # 네비게이션 컴포넌트 (기존 유지)
├── ui/              # 기존 컴포넌트 (점진적 마이그레이션)
└── index.ts         # 전체 export
```

## 🧩 컴포넌트 분류

### Atoms (8개)

가장 기본적인 단위로, 더 이상 분해할 수 없는 UI 요소입니다.

| 컴포넌트 | 설명 | Props |
|----------|------|-------|
| `Button` | 버튼 | `variant`, `size`, `isLoading`, `fullWidth` |
| `Input` | 텍스트 입력 | `inputSize`, `hasError` |
| `Select` | 드롭다운 선택 | `selectSize`, `hasError` |
| `Label` | 폼 레이블 | `required` |
| `Badge` | 상태 뱃지 | `variant`, `size` |
| `Spinner` | 로딩 스피너 | `size` |
| `Skeleton` | 로딩 스켈레톤 | `variant`, `width`, `height` |
| `ProgressBar` | 진행률 바 | `value`, `variant`, `size`, `showLabel` |

### Molecules (7개)

Atoms를 조합하여 특정 기능을 수행하는 컴포넌트입니다.

| 컴포넌트 | 구성 | 설명 |
|----------|------|------|
| `Card` | Container + Content | 카드 레이아웃 (Header, Content, Footer 포함) |
| `FormField` | Label + Input | 폼 입력 필드 |
| `FormSelect` | Label + Select | 폼 선택 필드 |
| `EmptyState` | Icon + Text + Button | 빈 상태 표시 |
| `ErrorState` | Icon + Text + Button | 에러 상태 표시 |
| `Toast` | Icon + Text + CloseButton | 토스트 알림 |
| `SectionHeader` | Title + Description + Action | 섹션 헤더 |
| `Tabs` | TabButton[] | 탭 네비게이션 |

### Organisms (5개)

Molecules를 조합하여 특정 섹션이나 기능을 구현하는 컴포넌트입니다.

| 컴포넌트 | 설명 |
|----------|------|
| `Dialog` | 모달 다이얼로그 (ConfirmDialog 포함) |
| `ToastProvider` | 토스트 컨텍스트 및 컨테이너 |
| `LoadingOverlay` | 로딩 오버레이 |
| `DataTable` | 데이터 테이블 (로딩, 빈 상태 처리 포함) |
| `Pagination` | 페이지네이션 |

## 📖 사용 예시

### Atoms 사용

```tsx
import { Button, Input, Badge, Spinner } from "@/components/atoms";

function Example() {
  return (
    <div className="flex gap-4">
      <Button variant="primary" size="md">저장</Button>
      <Button variant="outline" isLoading>로딩 중...</Button>
      <Input placeholder="이름 입력" inputSize="md" />
      <Badge variant="success">완료</Badge>
      <Spinner size="sm" />
    </div>
  );
}
```

### Molecules 사용

```tsx
import { Card, CardHeader, FormField, Tabs, EmptyState } from "@/components/molecules";

function Example() {
  return (
    <Card hover>
      <CardHeader 
        title="사용자 정보"
        description="기본 정보를 입력하세요"
        action={<Button variant="ghost">편집</Button>}
      />
      <FormField 
        label="이름"
        name="name"
        required
        error="필수 입력입니다"
      />
      <Tabs
        tabs={[
          { id: "info", label: "기본 정보" },
          { id: "settings", label: "설정" },
        ]}
        activeTab="info"
        onChange={setActiveTab}
      />
      <EmptyState
        title="데이터가 없습니다"
        description="새로운 항목을 추가해주세요"
        actionLabel="추가"
        actionHref="/new"
      />
    </Card>
  );
}
```

### Organisms 사용

```tsx
import { Dialog, ConfirmDialog, ToastProvider, useToast, DataTable, Pagination } from "@/components/organisms";

// ToastProvider 설정
function App() {
  return (
    <ToastProvider position="bottom-right">
      <MyComponent />
    </ToastProvider>
  );
}

// Toast 사용
function MyComponent() {
  const { showSuccess, showError } = useToast();

  const handleSave = async () => {
    try {
      await save();
      showSuccess("저장되었습니다");
    } catch {
      showError("저장에 실패했습니다");
    }
  };

  return (
    <>
      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="삭제 확인"
        description="정말 삭제하시겠습니까?"
        onConfirm={handleDelete}
        variant="destructive"
      />
      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onRowClick={handleRowClick}
      />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}
```

## 🔄 마이그레이션 가이드

### 기존 컴포넌트에서 새 컴포넌트로

| 기존 | 새 위치 |
|------|---------|
| `components/ui/Badge.tsx` | `components/atoms/Badge.tsx` |
| `components/ui/Card.tsx` | `components/molecules/Card.tsx` |
| `components/ui/Dialog.tsx` | `components/organisms/Dialog.tsx` |
| `components/ui/EmptyState.tsx` | `components/molecules/EmptyState.tsx` |
| `components/ui/ErrorState.tsx` | `components/molecules/ErrorState.tsx` |
| `components/ui/FormInput.tsx` | `components/molecules/FormField.tsx` |
| `components/ui/LoadingSkeleton.tsx` | `components/atoms/Skeleton.tsx` |
| `components/ui/ProgressBar.tsx` | `components/atoms/ProgressBar.tsx` |
| `components/ui/SectionHeader.tsx` | `components/molecules/SectionHeader.tsx` |
| `components/ui/Toast.tsx` | `components/molecules/Toast.tsx` |
| `components/ui/ToastProvider.tsx` | `components/organisms/ToastContainer.tsx` |

### Import 변경

```tsx
// Before
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";

// After
import { Badge } from "@/components/atoms";
import { Card, CardHeader } from "@/components/molecules";
import { Dialog } from "@/components/organisms";

// 또는 전체 import
import { Badge, Card, CardHeader, Dialog } from "@/components";
```

## 📊 변경 통계

| 카테고리 | 새 컴포넌트 | 비고 |
|----------|-------------|------|
| Atoms | 8개 | Button, Input, Select 신규 추가 |
| Molecules | 7개 | FormField, Tabs 신규 추가 |
| Organisms | 5개 | DataTable, Pagination, LoadingOverlay 신규 추가 |
| **총계** | **20개** | |

## ✅ 개선 사항

1. **Button 컴포넌트**: 일관된 variant와 size, 로딩 상태 지원
2. **Input/Select 컴포넌트**: 표준화된 폼 요소
3. **FormField 컴포넌트**: Label + Input + Error 통합
4. **Tabs 컴포넌트**: 범용 탭 네비게이션
5. **DataTable 컴포넌트**: 로딩/빈 상태 통합 처리
6. **Pagination 컴포넌트**: 재사용 가능한 페이지네이션

## 🔜 향후 작업

1. **점진적 마이그레이션**: 기존 `components/ui/` 사용처를 새 컴포넌트로 변경
2. **도메인별 컴포넌트**: `app/*/_components/`의 도메인 특화 컴포넌트 정리
3. **스토리북 추가**: 컴포넌트 문서화 및 시각적 테스트
4. **테스트 추가**: 유닛 테스트 및 접근성 테스트

