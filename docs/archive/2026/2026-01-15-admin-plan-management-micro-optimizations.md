# AdminPlanManagement 컴포넌트 최적화 및 리팩토링 가능 영역 분석

**작성일**: 2026-01-15  
**대상 파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`  
**파일 크기**: 1,287줄

---

## 📋 개요

`AdminPlanManagement.tsx`는 관리자 플랜 관리의 핵심 컴포넌트로, 17개의 모달과 다양한 상태를 관리하는 대규모 컴포넌트입니다. 이 문서는 **가장 작은 단위의 최적화 및 리팩토링 가능한 영역**을 식별하고 우선순위를 제시합니다.

---

## ✅ 현재 프로젝트 상태 점검 (2026-01-15)

### 빌드 및 타입 체크

- ✅ **TypeScript 타입 체크**: 통과 (0 errors)
- ✅ **Next.js 빌드**: 성공 (모든 라우트 정상 생성)
- ⚠️ **ESLint**: 31개 경고 (0개 에러)

### ESLint 경고 상세

#### 1. 사용되지 않는 변수 (4개)

- `openModal` (243줄): 정의되었으나 사용되지 않음
- `closeModal` (247줄): 정의되었으나 사용되지 않음
- `handleOpenTemplateWithPlans` (479줄): 정의되었으나 사용되지 않음
- `handleOpenBulkEdit` (511줄): 정의되었으나 사용되지 않음

**영향**: 최적화 작업 시 이 변수들을 제거하거나 실제 사용처를 확인 필요

#### 2. React Hook 의존성 경고 (1개)

- `useMemo` (670줄): `shortcuts` 배열 생성 시 의존성 누락
  - 누락된 의존성: `closeAllModals`, `setShowAIPlanModal`, `setShowCreateWizard`, `setShowOptimizationPanel`, `setShowShortcutsHelp`

**영향**: 최적화 작업 시 의존성 배열 수정 필요

#### 3. 디자인 시스템 정책 경고 (20개)

- 하드코딩된 색상 클래스 사용 (예: `bg-amber-50`, `text-amber-700` 등)
- 위치: 693-839줄 (경고 배너, 필터 드롭다운, 버튼 등)

**영향**: 최적화 작업과 별개이지만, 리팩토링 시 함께 개선 가능

#### 4. Spacing-First 정책 경고 (6개)

- `margin` 클래스 사용 (예: `mt-1`)
- 위치: 732, 821, 836줄

**영향**: 최적화 작업과 별개이지만, 리팩토링 시 함께 개선 가능

### 결론

**✅ 최적화 작업 진행 가능**: 현재 프로젝트는 빌드 및 타입 체크를 모두 통과하고 있으며, ESLint 경고는 모두 비치명적입니다. 최적화 작업을 안전하게 진행할 수 있습니다.

**⚠️ 작업 시 주의사항**:

1. 사용되지 않는 변수(`openModal`, `closeModal` 등)는 최적화 과정에서 자연스럽게 제거될 예정
2. React Hook 의존성 경고는 최적화 작업(특히 항목 1, 6)에서 해결 예정
3. 디자인 시스템 및 Spacing 정책 경고는 별도 작업으로 분리 권장

---

## 🎯 최적화 우선순위

### 🔴 High Priority (즉시 개선 가능, 큰 영향)

1. **모달 상태 관리 래퍼 함수 중복 제거** (256-390줄)
2. **동적 import 패턴 통합** (84-196줄)
3. **모달 렌더링 패턴 통합** (950-1271줄)

### 🟡 Medium Priority (점진적 개선)

4. **상수 정의 외부화** (68-81줄)
5. **모달 데이터 상태 통합 관리** (407-433줄)
6. **useCallback 의존성 최적화** (여러 위치)

### 🟢 Low Priority (장기 개선)

7. **타입 안전성 개선** (1236-1242줄)
8. **조건부 렌더링 최적화** (692-700줄, 814-844줄)

---

## 🔍 상세 분석

### 1. 모달 상태 관리 래퍼 함수 중복 제거

**위치**: 256-390줄  
**문제점**: 17개의 모달마다 동일한 패턴의 setter 함수가 반복됨

```256:390:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
  // 기존 API와의 호환성을 위한 래퍼 (점진적 마이그레이션)
  const showAddContentModal = modals.addContent;
  const setShowAddContentModal = useCallback((show: boolean) => {
    dispatchModal({
      type: show ? "OPEN_MODAL" : "CLOSE_MODAL",
      payload: "addContent",
    });
  }, []);

  const showAddAdHocModal = modals.addAdHoc;
  const setShowAddAdHocModal = useCallback((show: boolean) => {
    dispatchModal({
      type: show ? "OPEN_MODAL" : "CLOSE_MODAL",
      payload: "addAdHoc",
    });
  }, []);

  // ... 15개 더 반복
```

**개선 방안**:

#### Option A: useMemo로 동적 생성 (권장)

```typescript
// 모달 상태 및 setter를 동적으로 생성
const modalState = useMemo(() => {
  const state: Record<string, boolean> = {};
  const setters: Record<string, (show: boolean) => void> = {};

  const modalTypes: ModalType[] = [
    "addContent",
    "addAdHoc",
    "redistribute",
    "shortcutsHelp",
    "aiPlan",
    "createWizard",
    "optimization",
    "quickPlan",
    "edit",
    "reorder",
    "conditionalDelete",
    "template",
    "moveToGroup",
    "copy",
    "status",
    "bulkEdit",
    "unifiedAdd",
  ];

  modalTypes.forEach((type) => {
    state[`show${type.charAt(0).toUpperCase() + type.slice(1)}Modal`] =
      modals[type];
    setters[`setShow${type.charAt(0).toUpperCase() + type.slice(1)}Modal`] =
      useCallback((show: boolean) => {
        dispatchModal({
          type: show ? "OPEN_MODAL" : "CLOSE_MODAL",
          payload: type,
        });
      }, []);
  });

  return { state, setters };
}, [modals]);

// 사용: modalState.state.showAddContentModal
//      modalState.setters.setShowAddContentModal(true)
```

#### Option B: 커스텀 훅으로 분리

```typescript
// hooks/useModalState.ts
export function useModalState() {
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);

  const createModalState = useCallback(
    (type: ModalType) => {
      return {
        isOpen: modals[type],
        open: () => dispatchModal({ type: "OPEN_MODAL", payload: type }),
        close: () => dispatchModal({ type: "CLOSE_MODAL", payload: type }),
      };
    },
    [modals]
  );

  return {
    modals,
    createModalState,
    closeAll: () => dispatchModal({ type: "CLOSE_ALL" }),
  };
}

// 사용
const addContentModal = createModalState("addContent");
// addContentModal.isOpen, addContentModal.open(), addContentModal.close()
```

**예상 효과**:

- 코드 라인 수: **-135줄** (17개 × 8줄)
- 유지보수성: 새로운 모달 추가 시 1줄만 추가
- 가독성: 중복 제거로 핵심 로직에 집중

**작업 시간**: 30-45분

---

### 2. 동적 import 패턴 통합

**위치**: 84-196줄  
**문제점**: 모든 dynamic import가 동일한 패턴 반복

```84:196:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
const AddContentWizard = dynamic(
  () =>
    import("./add-content-wizard").then((mod) => ({
      default: mod.AddContentWizard,
    })),
  { ssr: false }
);
const AddAdHocModal = dynamic(
  () =>
    import("./AddAdHocModal").then((mod) => ({ default: mod.AddAdHocModal })),
  { ssr: false }
);
// ... 15개 더 반복
```

**개선 방안**:

```typescript
// utils/dynamicImports.ts
type DynamicImportConfig = {
  path: string;
  exportName?: string; // default export인 경우 생략
};

const createDynamicImport = <T extends React.ComponentType<any>>(
  config: DynamicImportConfig
) => {
  return dynamic(
    () =>
      import(config.path).then((mod) => ({
        default: config.exportName ? mod[config.exportName] : mod.default,
      })),
    { ssr: false }
  ) as React.ComponentType<T>;
};

// 사용
const MODAL_IMPORTS = {
  AddContentWizard: {
    path: "./add-content-wizard",
    exportName: "AddContentWizard",
  },
  AddAdHocModal: { path: "./AddAdHocModal", exportName: "AddAdHocModal" },
  RedistributeModal: {
    path: "./RedistributeModal",
    exportName: "RedistributeModal",
  },
  // ...
} as const;

export const Modals = Object.entries(MODAL_IMPORTS).reduce(
  (acc, [name, config]) => {
    acc[name] = createDynamicImport(config);
    return acc;
  },
  {} as Record<string, React.ComponentType<any>>
);
```

**예상 효과**:

- 코드 라인 수: **-100줄** (17개 × 6줄)
- 유지보수성: 새로운 모달 추가 시 설정만 추가
- 일관성: 모든 모달이 동일한 방식으로 로드

**작업 시간**: 20-30분

---

### 3. 모달 렌더링 패턴 통합

**위치**: 950-1271줄  
**문제점**: 모든 모달이 비슷한 패턴으로 조건부 렌더링됨

```950:1271:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
{showAddContentModal && selectedPlannerId && (
  <AddContentWizard
    studentId={studentId}
    tenantId={tenantId}
    targetDate={selectedDate}
    plannerId={selectedPlannerId}
    onClose={() => setShowAddContentModal(false)}
    onSuccess={() => {
      setShowAddContentModal(false);
      handleRefresh();
    }}
  />
)}

{showAddAdHocModal && selectedPlannerId && (
  <AddAdHocModal
    studentId={studentId}
    tenantId={tenantId}
    plannerId={selectedPlannerId}
    planGroupId={activePlanGroupId ?? undefined}
    targetDate={selectedDate}
    onClose={() => setShowAddAdHocModal(false)}
    onSuccess={() => {
      setShowAddAdHocModal(false);
      handleRefresh();
    }}
  />
)}
// ... 15개 더 반복
```

**개선 방안**:

```typescript
// 모달 설정 타입 정의
type ModalConfig = {
  type: ModalType;
  component: React.ComponentType<any>;
  condition?: () => boolean;
  props?: (state: ModalState) => Record<string, any>;
};

const MODAL_CONFIGS: ModalConfig[] = [
  {
    type: 'addContent',
    component: Modals.AddContentWizard,
    condition: () => !!selectedPlannerId,
    props: () => ({
      studentId,
      tenantId,
      targetDate: selectedDate,
      plannerId: selectedPlannerId,
      onClose: () => closeModal('addContent'),
      onSuccess: () => {
        closeModal('addContent');
        handleRefresh();
      },
    }),
  },
  {
    type: 'addAdHoc',
    component: Modals.AddAdHocModal,
    condition: () => !!selectedPlannerId,
    props: () => ({
      studentId,
      tenantId,
      plannerId: selectedPlannerId,
      planGroupId: activePlanGroupId ?? undefined,
      targetDate: selectedDate,
      onClose: () => closeModal('addAdHoc'),
      onSuccess: () => {
        closeModal('addAdHoc');
        handleRefresh();
      },
    }),
  },
  // ...
];

// 렌더링
{MODAL_CONFIGS.map((config) => {
  const ModalComponent = config.component;
  const isOpen = modals[config.type];
  const shouldRender = config.condition?.() ?? true;

  if (!isOpen || !shouldRender) return null;

  return (
    <ModalComponent
      key={config.type}
      {...(config.props?.(modals) ?? {})}
    />
  );
})}
```

**예상 효과**:

- 코드 라인 수: **-200줄** (17개 × 12줄)
- 유지보수성: 모달 추가/수정이 설정만 변경
- 일관성: 모든 모달이 동일한 패턴으로 관리

**작업 시간**: 45-60분

---

### 4. 상수 정의 외부화

**위치**: 68-81줄  
**문제점**: 컴포넌트 내부에 상수 정의로 인한 불필요한 재생성

```68:81:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
// 필터 옵션 정의
const CONTENT_TYPE_FILTERS: {
  value: ContentTypeFilter;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "all", label: "전체", icon: null },
  { value: "book", label: "교재", icon: <Book className="w-3 h-3" /> },
  { value: "lecture", label: "강의", icon: <Video className="w-3 h-3" /> },
  {
    value: "custom",
    label: "직접입력",
    icon: <FileText className="w-3 h-3" />,
  },
];
```

**개선 방안**:

```typescript
// constants/contentTypeFilters.ts
import { Book, Video, FileText } from "lucide-react";
import type { ContentTypeFilter } from "../AdminPlanManagement";

export const CONTENT_TYPE_FILTERS: {
  value: ContentTypeFilter;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "all", label: "전체", icon: null },
  { value: "book", label: "교재", icon: <Book className="w-3 h-3" /> },
  { value: "lecture", label: "강의", icon: <Video className="w-3 h-3" /> },
  {
    value: "custom",
    label: "직접입력",
    icon: <FileText className="w-3 h-3" />,
  },
];
```

**예상 효과**:

- 성능: 컴포넌트 재렌더링 시 상수 재생성 방지
- 재사용성: 다른 컴포넌트에서도 사용 가능
- 테스트 용이성: 상수만 독립적으로 테스트 가능

**작업 시간**: 5-10분

---

### 5. 모달 데이터 상태 통합 관리

**위치**: 407-433줄  
**문제점**: 모달별로 분산된 데이터 상태 관리

```407:433:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
  // 모달 관련 추가 상태 (데이터)
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] =
    useState<string | null>(null);
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(
    null
  );
  const [reorderContainerType, setReorderContainerType] = useState<
    "daily" | "weekly" | "unfinished"
  >("daily");
  const [templatePlanIds, setTemplatePlanIds] = useState<string[]>([]);
  const [selectedPlansForMove, setSelectedPlansForMove] = useState<string[]>(
    []
  );
  const [currentGroupIdForMove, setCurrentGroupIdForMove] = useState<
    string | null
  >(null);
  const [selectedPlansForCopy, setSelectedPlansForCopy] = useState<string[]>(
    []
  );
  const [selectedPlanForStatus, setSelectedPlanForStatus] = useState<{
    id: string;
    status: string;
    title: string;
  } | null>(null);
  const [selectedPlansForBulkEdit, setSelectedPlansForBulkEdit] = useState<
    string[]
  >([]);
```

**개선 방안**:

```typescript
// 모달 데이터 상태 타입 정의
type ModalDataState = {
  redistribute: { planId: string | null };
  aiPlan: { groupId: string | null };
  edit: { planId: string | null };
  reorder: { containerType: "daily" | "weekly" | "unfinished" };
  template: { planIds: string[] };
  moveToGroup: { planIds: string[]; currentGroupId: string | null };
  copy: { planIds: string[] };
  status: { planId: string; status: string; title: string } | null;
  bulkEdit: { planIds: string[] };
};

const initialModalData: ModalDataState = {
  redistribute: { planId: null },
  aiPlan: { groupId: null },
  edit: { planId: null },
  reorder: { containerType: "daily" },
  template: { planIds: [] },
  moveToGroup: { planIds: [], currentGroupId: null },
  copy: { planIds: [] },
  status: null,
  bulkEdit: { planIds: [] },
};

// useReducer로 통합 관리
const [modalData, dispatchModalData] = useReducer(
  (state: ModalDataState, action: ModalDataAction) => {
    switch (action.type) {
      case "SET_REDISTRIBUTE_PLAN":
        return { ...state, redistribute: { planId: action.payload } };
      case "SET_EDIT_PLAN":
        return { ...state, edit: { planId: action.payload } };
      // ...
      case "RESET_MODAL_DATA":
        return initialModalData;
      default:
        return state;
    }
  },
  initialModalData
);
```

**예상 효과**:

- 코드 라인 수: **-20줄**
- 상태 관리 일관성: 모든 모달 데이터가 동일한 패턴
- 모달 닫기 시 자동 초기화 가능

**작업 시간**: 30-40분

---

### 6. useCallback 의존성 최적화

**위치**: 여러 위치  
**문제점**: 일부 useCallback이 불필요하게 재생성됨

**예시 1**: `handleDateChange` (445-456줄)

```445:456:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
  // 날짜 변경 핸들러
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      startTransition(() => {
        const basePath = selectedPlannerId
          ? `/admin/students/${studentId}/plans/${selectedPlannerId}`
          : `/admin/students/${studentId}/plans`;
        router.push(`${basePath}?date=${date}`);
      });
    },
    [router, studentId, selectedPlannerId]
  );
```

**개선**: `basePath`를 useMemo로 분리

```typescript
const basePath = useMemo(
  () =>
    selectedPlannerId
      ? `/admin/students/${studentId}/plans/${selectedPlannerId}`
      : `/admin/students/${studentId}/plans`,
  [studentId, selectedPlannerId]
);

const handleDateChange = useCallback(
  (date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      router.push(`${basePath}?date=${date}`);
    });
  },
  [router, basePath]
);
```

**예시 2**: `shortcuts` useMemo (591-678줄)

```591:678:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
  // 키보드 단축키 설정
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      // 탐색
      {
        key: "ArrowLeft",
        action: () => navigateDate(-1),
        description: "이전 날짜",
        category: "navigation",
      },
      // ...
    ],
    [
      navigateDate,
      handleRefresh,
      handleDateChange,
      activePlanGroupId,
      canCreatePlans,
      openUnifiedModal,
    ]
  );
```

**개선**: 각 단축키의 action을 useCallback으로 분리

```typescript
const navigateDateBack = useCallback(() => navigateDate(-1), [navigateDate]);
const navigateDateForward = useCallback(() => navigateDate(1), [navigateDate]);
const goToToday = useCallback(
  () => handleDateChange(new Date().toISOString().split("T")[0]),
  [handleDateChange]
);

const shortcuts: ShortcutConfig[] = useMemo(
  () => [
    { key: "ArrowLeft", action: navigateDateBack, ... },
    { key: "ArrowRight", action: navigateDateForward, ... },
    { key: "t", action: goToToday, ... },
    // ...
  ],
  [navigateDateBack, navigateDateForward, goToToday, ...]
);
```

**예상 효과**:

- 성능: 불필요한 함수 재생성 방지
- 메모리: 함수 참조 안정성 향상

**작업 시간**: 20-30분

---

### 7. 타입 안전성 개선

**위치**: 1236-1242줄  
**문제점**: 타입 단언 사용

```1236:1242:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
              currentStatus={
                selectedPlanForStatus.status as
                  | "pending"
                  | "in_progress"
                  | "completed"
                  | "skipped"
                  | "cancelled"
              }
```

**개선 방안**:

```typescript
// 타입 정의
type PlanStatus = "pending" | "in_progress" | "completed" | "skipped" | "cancelled";

// 타입 가드 함수
function isValidPlanStatus(status: string): status is PlanStatus {
  return ["pending", "in_progress", "completed", "skipped", "cancelled"].includes(status);
}

// 사용
{showStatusModal && selectedPlanForStatus && isValidPlanStatus(selectedPlanForStatus.status) && (
  <PlanStatusModal
    currentStatus={selectedPlanForStatus.status}
    // ...
  />
)}
```

**예상 효과**:

- 타입 안전성: 런타임 타입 검증
- 버그 예방: 잘못된 상태 값 전달 방지

**작업 시간**: 10-15분

---

### 8. 조건부 렌더링 최적화

**위치**: 692-700줄, 814-844줄  
**문제점**: 복잡한 조건부 렌더링

**예시 1**: 플래너 미선택 경고 (692-700줄)

```692:700:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
          {/* 플래너 미선택 경고 배너 */}
          {!selectedPlannerId && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <span className="text-sm text-amber-700">
                플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나
                선택해주세요.
              </span>
            </div>
          )}
```

**개선**: 별도 컴포넌트로 분리

```typescript
// components/PlannerWarningBanner.tsx
export function PlannerWarningBanner() {
  return (
    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
      <span className="text-sm text-amber-700">
        플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나 선택해주세요.
      </span>
    </div>
  );
}
```

**예시 2**: 더보기 드롭다운 (814-844줄)

```814:844:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
              {/* 더보기 드롭다운 */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1 p-2 text-secondary-500 hover:bg-secondary-100 rounded-lg"
                  title="더보기"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    <ClipboardList className="h-4 w-4" />
                    플랜 템플릿
                  </button>
                  // ...
                </div>
              </div>
```

**개선**: 별도 컴포넌트로 분리

```typescript
// components/MoreActionsDropdown.tsx
export function MoreActionsDropdown({
  onTemplateClick,
  onConditionalDeleteClick,
  onShortcutsHelpClick,
}: MoreActionsDropdownProps) {
  // ...
}
```

**예상 효과**:

- 가독성: 메인 컴포넌트가 간결해짐
- 재사용성: 다른 곳에서도 사용 가능
- 테스트 용이성: 독립적으로 테스트 가능

**작업 시간**: 15-20분

---

## 📊 예상 개선 효과 요약

| 항목                   | 코드 감소  | 작업 시간   | 우선순위  |
| ---------------------- | ---------- | ----------- | --------- |
| 1. 모달 상태 관리 래퍼 | -135줄     | 30-45분     | 🔴 High   |
| 2. 동적 import 통합    | -100줄     | 20-30분     | 🔴 High   |
| 3. 모달 렌더링 통합    | -200줄     | 45-60분     | 🔴 High   |
| 4. 상수 외부화         | -13줄      | 5-10분      | 🟡 Medium |
| 5. 모달 데이터 통합    | -20줄      | 30-40분     | 🟡 Medium |
| 6. useCallback 최적화  | -10줄      | 20-30분     | 🟡 Medium |
| 7. 타입 안전성         | -5줄       | 10-15분     | 🟢 Low    |
| 8. 조건부 렌더링       | -30줄      | 15-20분     | 🟢 Low    |
| **합계**               | **-513줄** | **3-4시간** |           |

---

## 🚀 구현 로드맵

### Phase 1: High Priority (1-2일)

1. 모달 상태 관리 래퍼 함수 중복 제거
2. 동적 import 패턴 통합
3. 모달 렌더링 패턴 통합

**예상 효과**: 코드 라인 수 **-435줄** (33% 감소)

### Phase 2: Medium Priority (1일)

4. 상수 정의 외부화
5. 모달 데이터 상태 통합 관리
6. useCallback 의존성 최적화

**예상 효과**: 코드 라인 수 **-43줄**, 성능 개선

### Phase 3: Low Priority (0.5일)

7. 타입 안전성 개선
8. 조건부 렌더링 최적화

**예상 효과**: 코드 라인 수 **-35줄**, 유지보수성 향상

---

## ⚠️ 주의사항

1. **기존 API 호환성 유지**: 점진적 마이그레이션을 위해 기존 prop 이름 유지
2. **테스트 커버리지**: 리팩토링 후 기존 테스트가 모두 통과하는지 확인
3. **타입 안전성**: 타입 단언 제거 시 런타임 검증 추가
4. **성능 측정**: useCallback 최적화 후 실제 성능 개선 측정

---

## 📝 참고 자료

- [React useReducer 패턴](https://react.dev/reference/react/useReducer)
- [Next.js Dynamic Import](https://nextjs.org/docs/advanced-features/dynamic-import)
- [TypeScript 타입 가드](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

---

**작성자**: AI Assistant  
**검토 필요**: 코드 리뷰 및 테스트 계획 수립
