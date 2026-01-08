# 관리자 플래너-플랜 관리 플로우 분석

## 📋 개요

관리자 영역에서 학생 대상 플랜 생성 플로우 중 **플래너 - 플랜 관리 흐름**이 원페이지 원액션 형태를 갖추지 않아 화면 구성 요소가 많은 문제점을 분석하고, **플랜 관리 화면이 플래너 선택 후 보이는 구조**로 개선할 때를 기준으로 현재 코드를 분석한 문서입니다.

**작성일**: 2026-01-15  
**분석 범위**: 관리자 학생별 플랜 관리 페이지 (`/admin/students/[id]/plans`)

---

## 🎯 개선 목표

### 현재 문제점

1. **원페이지 원액션 미준수**: 플래너 선택과 플랜 관리가 같은 페이지에 함께 표시되어 화면 구성 요소가 과다
2. **정보 밀도 과다**: 플래너 목록, 플래너 통계, 플랜 관리 UI가 모두 한 화면에 노출
3. **사용자 흐름 불명확**: 플래너 선택 후 플랜 관리를 시작하는 흐름이 직관적이지 않음

### 개선 방향

- **플래너 선택 단계**: 플래너 목록만 표시하는 전용 페이지/섹션
- **플랜 관리 단계**: 플래너 선택 후 플랜 관리 화면으로 이동하는 구조
- **원페이지 원액션**: 각 단계에서 하나의 주요 액션에 집중

---

## 📁 현재 코드 구조

### 파일 구조

```
app/(admin)/admin/students/[id]/plans/
├── page.tsx                          # 서버 컴포넌트 (진입점)
└── _components/
    ├── StudentPlansPageClient.tsx    # 메인 클라이언트 컴포넌트
    ├── PlannerManagement.tsx          # 플래너 관리 컴포넌트
    ├── AdminPlanManagement.tsx       # 플랜 관리 컴포넌트
    ├── PlannerStats.tsx              # 플래너 통계
    ├── PlannerCreationModal.tsx      # 플래너 생성 모달
    └── ... (기타 컴포넌트들)
```

---

## 🔍 현재 구현 분석

### 1. 페이지 진입점 (`page.tsx`)

```29:72:app/(admin)/admin/students/[id]/plans/page.tsx
export default async function StudentPlansPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;

  const student = await getStudentInfo(id);

  if (!student) {
    notFound();
  }

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  // 활성 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId: id,
    status: 'active',
  });
  const activePlanGroupId = activePlanGroups[0]?.id ?? null;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          학생의 학습 플랜을 관리하고 재분배할 수 있습니다
        </p>
      </div>

      {/* 플래너 & 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <StudentPlansPageClient
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
        />
      </Suspense>
    </div>
  );
}
```

**특징**:
- 서버 컴포넌트로 학생 정보 및 활성 플랜 그룹 조회
- `StudentPlansPageClient`에 모든 로직 위임

---

### 2. 메인 클라이언트 컴포넌트 (`StudentPlansPageClient.tsx`)

```29:125:app/(admin)/admin/students/[id]/plans/_components/StudentPlansPageClient.tsx
export function StudentPlansPageClient({
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
}: StudentPlansPageClientProps) {
  const searchParams = useSearchParams();

  // URL 파라미터 추출
  const openWizard = searchParams.get("openWizard") === "true";
  const batchStudentIds = useMemo(() => {
    const ids = searchParams.get("batchStudentIds");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // 플래너 관련 상태
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);
  const [isPlannerSectionOpen, setIsPlannerSectionOpen] = useState(true);

  // 플래너 선택 핸들러
  const handlePlannerSelect = useCallback((planner: Planner | null) => {
    setSelectedPlanner(planner);
  }, []);

  return (
    <div className="space-y-6">
      {/* 배치 모드 안내 (다중 학생 선택 시) */}
      {batchStudentIds.length > 1 && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <Users className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-indigo-900">
              배치 모드: {batchStudentIds.length}명의 학생이 선택됨
            </p>
            <p className="text-xs text-indigo-700 mt-0.5">
              현재 학생의 플랜 생성을 완료한 후, 다음 학생으로 이동할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 플래너 관리 섹션 (접을 수 있음) */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* 섹션 헤더 */}
        <button
          onClick={() => setIsPlannerSectionOpen(!isPlannerSectionOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">플래너 관리</span>
            {selectedPlanner && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {selectedPlanner.name}
              </span>
            )}
          </div>
          {isPlannerSectionOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {/* 플래너 관리 콘텐츠 */}
        <div
          className={cn(
            "transition-all duration-200 ease-in-out",
            isPlannerSectionOpen
              ? "max-h-[600px] opacity-100 p-4"
              : "max-h-0 opacity-0 overflow-hidden"
          )}
        >
          <PlannerManagement
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onPlannerSelect={handlePlannerSelect}
            selectedPlannerId={selectedPlanner?.id}
          />
        </div>
      </div>

      {/* 플랜 관리 섹션 */}
      <AdminPlanManagement
        studentId={studentId}
        studentName={studentName}
        tenantId={tenantId}
        initialDate={initialDate}
        activePlanGroupId={activePlanGroupId}
        selectedPlannerId={selectedPlanner?.id}
        autoOpenWizard={openWizard && !!selectedPlanner}
      />
    </div>
  );
}
```

**현재 구조의 특징**:

1. **플래너 관리 섹션** (접을 수 있는 형태)
   - `PlannerManagement` 컴포넌트 포함
   - 접기/펼치기 기능 (`isPlannerSectionOpen`)
   - 선택된 플래너 표시

2. **플랜 관리 섹션**
   - `AdminPlanManagement` 컴포넌트
   - `selectedPlannerId`를 prop으로 전달

3. **문제점**:
   - 두 섹션이 같은 페이지에 함께 표시됨
   - 플래너 선택 후에도 플래너 목록이 계속 표시됨
   - 화면 구성 요소가 과다하여 정보 밀도가 높음

---

### 3. 플래너 관리 컴포넌트 (`PlannerManagement.tsx`)

```331:525:app/(admin)/admin/students/[id]/plans/_components/PlannerManagement.tsx
export function PlannerManagement({
  studentId,
  tenantId,
  studentName,
  onPlannerSelect,
  selectedPlannerId,
}: PlannerManagementProps) {
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editPlanner, setEditPlanner] = useState<Planner | undefined>();
  const [duplicatePlanner, setDuplicatePlanner] = useState<Planner | undefined>();

  // 선택된 플래너 객체 계산
  const selectedPlanner = useMemo(
    () => planners.find((p) => p.id === selectedPlannerId),
    [planners, selectedPlannerId]
  );

  // 플래너 목록 로드
  const loadPlanners = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getStudentPlannersAction(studentId, {
        includeArchived: showArchived,
      });

      if (result && "data" in result) {
        setPlanners(result.data);
      }
    } catch (err) {
      console.error("[PlannerManagement] 플래너 목록 로드 실패:", err);
      setError(err instanceof Error ? err.message : "플래너 목록을 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId, showArchived]);

  useEffect(() => {
    loadPlanners();
  }, [loadPlanners]);

  // 플래너 상태 변경
  const handleStatusChange = async (plannerId: string, status: PlannerStatus) => {
    try {
      await updatePlannerStatusAction(plannerId, status);
      loadPlanners();
    } catch (err) {
      console.error("[PlannerManagement] 상태 변경 실패:", err);
      alert(err instanceof Error ? err.message : "상태 변경에 실패했습니다.");
    }
  };

  // 플래너 삭제
  const handleDelete = async (plannerId: string, plannerName: string) => {
    const confirmed = confirm(`"${plannerName}" 플래너를 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      await deletePlannerAction(plannerId);
      loadPlanners();
      if (selectedPlannerId === plannerId) {
        onPlannerSelect?.(undefined as unknown as Planner);
      }
    } catch (err) {
      console.error("[PlannerManagement] 삭제 실패:", err);
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  // 플래너 생성/수정/복제 완료
  const handlePlannerSaved = (planner: Planner) => {
    setCreateModalOpen(false);
    setEditPlanner(undefined);
    setDuplicatePlanner(undefined);
    loadPlanners();
    onPlannerSelect?.(planner);
  };

  // 모달 닫기
  const handleModalClose = () => {
    setCreateModalOpen(false);
    setEditPlanner(undefined);
    setDuplicatePlanner(undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {studentName}의 플래너
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            보관됨 포함
          </label>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            새 플래너
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* 빈 상태 - 첫 플래너 만들기 강조 */}
      {!isLoading && !error && planners.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            플래너를 시작해보세요
          </h4>
          <p className="text-sm text-gray-600 mb-6 max-w-xs">
            플래너를 생성하면 학생의 학습 플랜을 체계적으로 관리할 수 있습니다.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30"
          >
            <Plus className="w-5 h-5" />
            첫 플래너 만들기
          </button>
        </div>
      )}

      {/* 플래너 목록 */}
      {!isLoading && planners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planners.map((planner) => (
            <PlannerCard
              key={planner.id}
              planner={planner}
              isSelected={selectedPlannerId === planner.id}
              onSelect={() => onPlannerSelect?.(planner)}
              onStatusChange={(status) => handleStatusChange(planner.id, status)}
              onDelete={() => handleDelete(planner.id, planner.name)}
              onEdit={() => setEditPlanner(planner)}
              onDuplicate={() => setDuplicatePlanner(planner)}
            />
          ))}
        </div>
      )}

      {/* 선택된 플래너 통계 및 타임라인 */}
      {selectedPlanner && (
        <PlannerStats
          planner={selectedPlanner}
          studentId={studentId}
          className="mt-4 p-4 bg-white rounded-lg border border-gray-200"
        />
      )}

      {/* 플래너 생성/수정/복제 모달 */}
      <PlannerCreationModal
        open={createModalOpen || !!editPlanner || !!duplicatePlanner}
        onClose={handleModalClose}
        onSuccess={handlePlannerSaved}
        studentId={studentId}
        tenantId={tenantId}
        studentName={studentName}
        editPlanner={editPlanner}
        duplicateFrom={duplicatePlanner}
      />
    </div>
  );
}
```

**주요 기능**:

1. **플래너 목록 조회**: `getStudentPlannersAction`으로 플래너 목록 로드
2. **플래너 선택**: `onPlannerSelect` 콜백으로 선택된 플래너 전달
3. **플래너 CRUD**: 생성, 수정, 삭제, 복제, 상태 변경
4. **선택된 플래너 통계**: `PlannerStats` 컴포넌트로 통계 표시

**문제점**:
- 플래너 선택 후에도 목록과 통계가 계속 표시됨
- 플래너 선택이 단순히 상태 변경에 그치고, 플랜 관리 화면으로 이동하지 않음

---

### 4. 플랜 관리 컴포넌트 (`AdminPlanManagement.tsx`)

```113:477:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
export function AdminPlanManagement({
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
  selectedPlannerId,
  autoOpenWizard = false,
}: AdminPlanManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 모달 상태 관리 (useReducer 패턴)
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);

  // 모달 열기/닫기 헬퍼 함수들 (기존 API 호환성 유지)
  const openModal = useCallback((type: ModalType) => {
    dispatchModal({ type: 'OPEN_MODAL', payload: type });
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    dispatchModal({ type: 'CLOSE_MODAL', payload: type });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatchModal({ type: 'CLOSE_ALL' });
  }, []);

  // 기존 API와의 호환성을 위한 래퍼 (점진적 마이그레이션)
  const showAddContentModal = modals.addContent;
  const setShowAddContentModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'addContent' });
  }, []);

  const showAddAdHocModal = modals.addAdHoc;
  const setShowAddAdHocModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'addAdHoc' });
  }, []);

  const showRedistributeModal = modals.redistribute;
  const setShowRedistributeModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'redistribute' });
  }, []);

  const showShortcutsHelp = modals.shortcutsHelp;
  const setShowShortcutsHelp = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'shortcutsHelp' });
  }, []);

  const showAIPlanModal = modals.aiPlan;
  const setShowAIPlanModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'aiPlan' });
  }, []);

  const showCreateWizard = modals.createWizard;
  const setShowCreateWizard = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'createWizard' });
  }, []);

  const showOptimizationPanel = modals.optimization;
  const setShowOptimizationPanel = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'optimization' });
  }, []);

  const showQuickPlanModal = modals.quickPlan;
  const setShowQuickPlanModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'quickPlan' });
  }, []);

  const showEditModal = modals.edit;
  const setShowEditModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'edit' });
  }, []);

  const showReorderModal = modals.reorder;
  const setShowReorderModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'reorder' });
  }, []);

  const showConditionalDeleteModal = modals.conditionalDelete;
  const setShowConditionalDeleteModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'conditionalDelete' });
  }, []);

  const showTemplateModal = modals.template;
  const setShowTemplateModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'template' });
  }, []);

  const showMoveToGroupModal = modals.moveToGroup;
  const setShowMoveToGroupModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'moveToGroup' });
  }, []);

  const showCopyModal = modals.copy;
  const setShowCopyModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'copy' });
  }, []);

  const showStatusModal = modals.status;
  const setShowStatusModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'status' });
  }, []);

  const showBulkEditModal = modals.bulkEdit;
  const setShowBulkEditModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'bulkEdit' });
  }, []);

  // 모달 관련 추가 상태 (데이터)
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] = useState<string | null>(null);
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(null);
  const [reorderContainerType, setReorderContainerType] = useState<'daily' | 'weekly' | 'unfinished'>('daily');
  const [templatePlanIds, setTemplatePlanIds] = useState<string[]>([]);
  const [selectedPlansForMove, setSelectedPlansForMove] = useState<string[]>([]);
  const [currentGroupIdForMove, setCurrentGroupIdForMove] = useState<string | null>(null);
  const [selectedPlansForCopy, setSelectedPlansForCopy] = useState<string[]>([]);
  const [selectedPlanForStatus, setSelectedPlanForStatus] = useState<{
    id: string;
    status: string;
    title: string;
  } | null>(null);
  const [selectedPlansForBulkEdit, setSelectedPlansForBulkEdit] = useState<string[]>([]);

  // 위저드 자동 오픈 (URL 파라미터로 트리거)
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (autoOpenWizard && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setShowCreateWizard(true);
    }
  }, [autoOpenWizard, setShowCreateWizard]);

  // 날짜 변경 핸들러
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      router.push(`/admin/students/${studentId}/plans?date=${date}`);
    });
  }, [router, studentId]);

  // 재분배 모달 열기
  const handleOpenRedistribute = (planId: string) => {
    setSelectedPlanForRedistribute(planId);
    setShowRedistributeModal(true);
  };

  // 편집 모달 열기
  const handleOpenEdit = (planId: string) => {
    setSelectedPlanForEdit(planId);
    setShowEditModal(true);
  };

  // 순서 변경 모달 열기
  const handleOpenReorder = (containerType: 'daily' | 'weekly' | 'unfinished') => {
    setReorderContainerType(containerType);
    setShowReorderModal(true);
  };

  // 템플릿 모달 열기 (선택된 플랜으로)
  const handleOpenTemplateWithPlans = (planIds: string[]) => {
    setTemplatePlanIds(planIds);
    setShowTemplateModal(true);
  };

  // 그룹 이동 모달 열기
  const handleOpenMoveToGroup = (planIds: string[], currentGroupId?: string | null) => {
    setSelectedPlansForMove(planIds);
    setCurrentGroupIdForMove(currentGroupId ?? null);
    setShowMoveToGroupModal(true);
  };

  // 복사 모달 열기
  const handleOpenCopy = (planIds: string[]) => {
    setSelectedPlansForCopy(planIds);
    setShowCopyModal(true);
  };

  // 상태 변경 모달 열기
  const handleOpenStatusChange = (planId: string, currentStatus: string, title: string) => {
    setSelectedPlanForStatus({ id: planId, status: currentStatus, title });
    setShowStatusModal(true);
  };

  // 일괄 수정 모달 열기
  const handleOpenBulkEdit = (planIds: string[]) => {
    setSelectedPlansForBulkEdit(planIds);
    setShowBulkEditModal(true);
  };

  // React Query 캐시 무효화 (Dock 컴포넌트용)
  const invalidateAllDocks = useInvalidateAllDockQueries();

  // 새로고침 (React Query 캐시 + Next.js router)
  const handleRefresh = useCallback(() => {
    // React Query 캐시 무효화 (Dock 컴포넌트 즉시 갱신)
    invalidateAllDocks();
    // Next.js router refresh (Server Component 데이터 갱신)
    startTransition(() => {
      router.refresh();
    });
  }, [router, invalidateAllDocks]);

  // 실시간 업데이트 구독
  useAdminPlanRealtime({
    studentId,
    onRefresh: handleRefresh,
    debounceMs: 1000, // 1초 debounce로 빈번한 새로고침 방지
  });

  // DnD 이동 핸들러 (이벤트 로깅 포함)
  // targetDate: 날짜 기반 드롭 시 캘린더에서 드롭한 날짜
  const handleMoveItem = useCallback(
    async (
      itemId: string,
      itemType: 'plan' | 'adhoc',
      fromContainer: ContainerType,
      toContainer: ContainerType,
      targetDate?: string
    ) => {
      // 날짜 기반 드롭인 경우 해당 날짜 사용, 아니면 현재 선택된 날짜 사용
      const effectiveTargetDate = targetDate ?? selectedDate;

      // 확장된 컨테이너 타입을 기본 타입으로 변환 (movePlanToContainer용)
      const fromBaseType = getBaseContainerType(fromContainer);
      const toBaseType = getBaseContainerType(toContainer);

      const result = await movePlanToContainer({
        planId: itemId,
        planType: itemType,
        fromContainer: fromBaseType,
        toContainer: toBaseType,
        studentId,
        tenantId,
        targetDate: toBaseType === 'daily' ? effectiveTargetDate : undefined,
      });

      if (!result.success) {
        console.error('Failed to move plan:', result.error);
      }

      // 날짜 기반 드롭이고 현재 선택 날짜와 다른 경우 해당 날짜로 이동
      if (targetDate && targetDate !== selectedDate) {
        handleDateChange(targetDate);
      } else {
        handleRefresh();
      }
    },
    [studentId, tenantId, selectedDate, handleRefresh, handleDateChange]
  );

  // 날짜 이동 헬퍼
  const navigateDate = useCallback((days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    handleDateChange(current.toISOString().split('T')[0]);
  }, [selectedDate, handleDateChange]);

  // 플래너 선택 여부 확인 (플랜 생성 기능 활성화 조건)
  const canCreatePlans = !!selectedPlannerId;

  // 키보드 단축키 설정
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      // 탐색
      {
        key: 'ArrowLeft',
        action: () => navigateDate(-1),
        description: '이전 날짜',
        category: 'navigation',
      },
      {
        key: 'ArrowRight',
        action: () => navigateDate(1),
        description: '다음 날짜',
        category: 'navigation',
      },
      {
        key: 't',
        action: () => handleDateChange(new Date().toISOString().split('T')[0]),
        description: '오늘로 이동',
        category: 'navigation',
      },
      // 작업
      {
        key: 'r',
        action: handleRefresh,
        description: '새로고침',
        category: 'action',
      },
      // 모달 (플래너 선택 필요)
      {
        key: 'n',
        action: () => canCreatePlans && setShowAddContentModal(true),
        description: '플랜 추가',
        category: 'modal',
      },
      {
        key: 'a',
        action: () => canCreatePlans && setShowAddAdHocModal(true),
        description: '단발성 추가',
        category: 'modal',
      },
      {
        key: '?',
        shift: true,
        action: () => setShowShortcutsHelp(true),
        description: '단축키 도움말',
        category: 'modal',
      },
      {
        key: 'Escape',
        action: closeAllModals,
        description: '모달 닫기',
        category: 'modal',
      },
      {
        key: 'q',
        action: () => canCreatePlans && setShowQuickPlanModal(true),
        description: '빠른 플랜 추가',
        category: 'modal',
      },
      {
        key: 'i',
        action: () => activePlanGroupId && setShowAIPlanModal(true),
        description: 'AI 플랜 생성',
        category: 'modal',
      },
      {
        key: 'g',
        action: () => canCreatePlans && setShowCreateWizard(true),
        description: '플랜 그룹 생성',
        category: 'modal',
      },
      {
        key: 'o',
        action: () => setShowOptimizationPanel(true),
        description: 'AI 플랜 최적화',
        category: 'modal',
      },
    ],
    [navigateDate, handleRefresh, handleDateChange, activePlanGroupId, canCreatePlans]
  );

  useKeyboardShortcuts({ shortcuts });

  return (
    <PlanToastProvider>
      <PlanDndProvider onMoveItem={handleMoveItem}>
        <div className={cn('space-y-6', isPending && 'opacity-50 pointer-events-none')}>
        {/* 플래너 미선택 경고 배너 */}
        {!selectedPlannerId && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="text-sm text-amber-700">
              플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나 선택해주세요.
            </span>
          </div>
        )}
```

**주요 기능**:

1. **플랜 관리 UI**: Daily Dock, Weekly Dock, Unfinished Dock, Weekly Calendar 등
2. **플랜 생성 모달들**: 플랜 그룹 생성, 콘텐츠 추가, 단발성 추가, 빠른 추가 등
3. **플랜 편집 기능**: 재분배, 편집, 순서 변경, 그룹 이동, 복사, 상태 변경 등
4. **플래너 의존성**: `selectedPlannerId`가 없으면 플랜 생성 기능 비활성화

**문제점**:
- 플래너 미선택 시 경고 배너만 표시하고, 플래너 선택으로 이동하는 명확한 액션이 없음
- 플래너 선택 상태가 로컬 상태로 관리되어 페이지 새로고침 시 초기화됨

---

## 🔄 현재 플로우 분석

### 현재 사용자 플로우

```
1. /admin/students/[id]/plans 접속
   └── StudentPlansPageClient 렌더링
   
2. 플래너 관리 섹션 표시 (접을 수 있음)
   └── PlannerManagement 컴포넌트
   └── 플래너 목록 조회 및 표시
   
3. 플래너 선택
   └── onPlannerSelect 콜백 호출
   └── selectedPlanner 상태 업데이트
   └── AdminPlanManagement에 selectedPlannerId 전달
   
4. 플랜 관리 섹션 표시
   └── AdminPlanManagement 컴포넌트
   └── 플래너 미선택 시 경고 배너 표시
   └── 플래너 선택 시 플랜 생성 버튼 활성화
```

### 문제점

1. **원페이지 원액션 미준수**
   - 플래너 선택과 플랜 관리가 같은 페이지에 함께 표시
   - 사용자가 한 번에 여러 작업을 수행할 수 있어 집중도 저하

2. **정보 밀도 과다**
   - 플래너 목록, 플래너 통계, 플랜 관리 UI가 모두 표시
   - 화면 스크롤이 길어짐

3. **사용자 흐름 불명확**
   - 플래너 선택 후에도 플래너 목록이 계속 표시됨
   - 플래너 선택이 단순히 상태 변경에 그치고, 플랜 관리 화면으로 이동하지 않음

4. **상태 관리 문제**
   - 플래너 선택 상태가 로컬 상태로 관리되어 페이지 새로고침 시 초기화
   - URL에 플래너 ID가 포함되지 않아 북마크/공유 불가

---

## 🎯 개선 방향 (플래너 선택 후 플랜 관리 화면으로 이동)

### 목표 구조

```
1. 플래너 선택 페이지/섹션
   └── 플래너 목록만 표시
   └── 플래너 선택 시 플랜 관리 화면으로 이동
   
2. 플랜 관리 페이지/섹션
   └── 선택된 플래너 정보 표시
   └── 플랜 관리 UI만 표시
   └── 플래너 변경 버튼으로 플래너 선택 화면으로 이동
```

### 개선 방안

#### 옵션 1: URL 기반 라우팅 (권장)

**구조**:
- `/admin/students/[id]/plans` - 플래너 선택 페이지
- `/admin/students/[id]/plans/[plannerId]` - 플랜 관리 페이지

**장점**:
- URL에 플래너 ID 포함으로 북마크/공유 가능
- 브라우저 뒤로가기 지원
- 서버 컴포넌트에서 플래너 정보 조회 가능

**구현 예시**:
```typescript
// app/(admin)/admin/students/[id]/plans/page.tsx
// 플래너 선택 페이지

// app/(admin)/admin/students/[id]/plans/[plannerId]/page.tsx
// 플랜 관리 페이지
```

#### 옵션 2: 쿼리 파라미터 기반

**구조**:
- `/admin/students/[id]/plans` - 플래너 선택 (plannerId 없음)
- `/admin/students/[id]/plans?plannerId=xxx` - 플랜 관리 (plannerId 있음)

**장점**:
- 기존 라우팅 구조 유지
- 구현이 간단

**단점**:
- URL이 길어질 수 있음
- 서버 컴포넌트에서 쿼리 파라미터 처리 필요

#### 옵션 3: 클라이언트 상태 기반 (현재 구조 개선)

**구조**:
- 같은 페이지에서 클라이언트 상태로 화면 전환
- `view` 상태: `'planner-selection' | 'plan-management'`

**장점**:
- 기존 구조 최소 변경
- 빠른 화면 전환

**단점**:
- URL에 상태가 포함되지 않아 북마크/공유 불가
- 페이지 새로고침 시 초기화

---

## 📊 컴포넌트 의존성 분석

### 현재 의존성 구조

```
StudentPlansPageClient
├── PlannerManagement
│   ├── PlannerCard
│   ├── PlannerStats
│   └── PlannerCreationModal
└── AdminPlanManagement
    ├── PlanStatsCards
    ├── PlanTypeStats
    ├── UnfinishedDock
    ├── DailyDock
    ├── WeeklyDock
    ├── WeeklyCalendar
    ├── SummaryDashboard
    ├── PlanHistoryViewer
    ├── PlanQualityDashboard
    └── (다양한 모달들)
```

### 개선 후 의존성 구조 (옵션 1 기준)

```
// 플래너 선택 페이지
PlannerSelectionPage
├── PlannerManagement
│   ├── PlannerCard
│   └── PlannerCreationModal
└── (플래너 선택 후 라우팅)

// 플랜 관리 페이지
PlanManagementPage
├── PlannerHeader (선택된 플래너 정보)
├── AdminPlanManagement
│   ├── PlanStatsCards
│   ├── PlanTypeStats
│   ├── UnfinishedDock
│   ├── DailyDock
│   ├── WeeklyDock
│   ├── WeeklyCalendar
│   └── (다양한 모달들)
└── ChangePlannerButton (플래너 변경)
```

---

## 🔧 개선 시 필요한 변경 사항

### 1. 라우팅 구조 변경

**현재**:
```
/admin/students/[id]/plans
```

**개선 후 (옵션 1)**:
```
/admin/students/[id]/plans              # 플래너 선택
/admin/students/[id]/plans/[plannerId]  # 플랜 관리
```

### 2. 컴포넌트 분리

**현재**:
- `StudentPlansPageClient`: 플래너 선택 + 플랜 관리 통합

**개선 후**:
- `PlannerSelectionPage`: 플래너 선택 전용
- `PlanManagementPage`: 플랜 관리 전용

### 3. 상태 관리 변경

**현재**:
- 로컬 상태 (`useState`)로 플래너 선택 관리

**개선 후**:
- URL 파라미터로 플래너 ID 관리
- 서버 컴포넌트에서 플래너 정보 조회

### 4. 네비게이션 추가

**개선 후 추가 필요**:
- 플래너 선택 → 플랜 관리: 라우팅
- 플랜 관리 → 플래너 변경: 라우팅 또는 모달

---

## 📝 주요 코드 변경 포인트

### 1. `StudentPlansPageClient.tsx` 분리

**현재**:
```typescript
export function StudentPlansPageClient({ ... }) {
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);
  
  return (
    <div>
      <PlannerManagement onPlannerSelect={handlePlannerSelect} />
      <AdminPlanManagement selectedPlannerId={selectedPlanner?.id} />
    </div>
  );
}
```

**개선 후**:
```typescript
// PlannerSelectionPage.tsx
export function PlannerSelectionPage({ studentId, ... }) {
  const router = useRouter();
  
  const handlePlannerSelect = (planner: Planner) => {
    router.push(`/admin/students/${studentId}/plans/${planner.id}`);
  };
  
  return <PlannerManagement onPlannerSelect={handlePlannerSelect} />;
}

// PlanManagementPage.tsx
export function PlanManagementPage({ studentId, plannerId, ... }) {
  const router = useRouter();
  
  const handleChangePlanner = () => {
    router.push(`/admin/students/${studentId}/plans`);
  };
  
  return (
    <div>
      <PlannerHeader plannerId={plannerId} onChangePlanner={handleChangePlanner} />
      <AdminPlanManagement selectedPlannerId={plannerId} />
    </div>
  );
}
```

### 2. `PlannerManagement.tsx` 수정

**현재**:
- 플래너 선택 시 `onPlannerSelect` 콜백만 호출

**개선 후**:
- 플래너 선택 시 라우팅 또는 명확한 액션 수행

### 3. `AdminPlanManagement.tsx` 수정

**현재**:
- `selectedPlannerId`가 없으면 경고 배너만 표시

**개선 후**:
- `selectedPlannerId`가 없으면 플래너 선택 페이지로 리다이렉트 또는 명확한 액션 버튼 제공

---

## ✅ 체크리스트

### 분석 완료 항목

- [x] 현재 코드 구조 분석
- [x] 컴포넌트 의존성 분석
- [x] 사용자 플로우 분석
- [x] 문제점 도출
- [x] 개선 방향 제시

### 개선 구현 시 필요 항목

- [ ] 라우팅 구조 변경 (옵션 선택)
- [ ] 컴포넌트 분리
- [ ] 상태 관리 변경
- [ ] 네비게이션 추가
- [ ] 플래너 헤더 컴포넌트 생성
- [ ] 플래너 변경 기능 구현
- [ ] 테스트 및 검증

---

## 📚 참고 문서

- [관리자 플랜 생성 구조 분석](./2026-01-15-admin-plan-creation-structure-analysis-and-improvements.md)
- [관리자 학생 선택 플래너 생성 플로우 분석](./2026-01-15-admin-student-selection-planner-creation-flow-analysis.md)
- [관리자 플랜 생성 플로우 중앙화 분석](./2026-01-15-admin-plan-creation-flow-centralization-analysis.md)

---

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**버전**: 1.0

