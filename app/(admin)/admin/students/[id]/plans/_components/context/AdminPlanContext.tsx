"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { useAdminPlanRealtime } from "@/lib/realtime";
import { useInvalidateAllDockQueries } from "@/lib/hooks/useAdminDockQueries";
import {
  modalReducer,
  initialModalState,
  type ModalType,
  type ModalState,
} from "../types/modalState";
import { useModalSetters } from "../hooks/useModalSetters";
import type { DailyScheduleInfo } from "@/lib/types/plan";

// 콘텐츠 유형 필터 타입
export type ContentTypeFilter = "all" | "book" | "lecture" | "custom";

// 플랜 그룹 요약 정보 타입
export interface PlanGroupSummary {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
}

// 플래너 제외일 타입
export interface PlannerExclusion {
  exclusionDate: string;
  exclusionType: string;
  reason?: string | null;
}

// Context 값 타입
export interface AdminPlanContextValue {
  // 기본 정보
  studentId: string;
  studentName: string;
  tenantId: string;
  selectedPlannerId?: string;
  activePlanGroupId: string | null;

  // 플랜 그룹 선택
  allPlanGroups: PlanGroupSummary[];
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;

  // 날짜 상태
  selectedDate: string;
  handleDateChange: (date: string) => void;

  // 새로고침
  handleRefresh: () => void;
  isPending: boolean;

  // 콘텐츠 필터
  contentTypeFilter: ContentTypeFilter;
  setContentTypeFilter: (filter: ContentTypeFilter) => void;

  // 모달 상태 및 핸들러
  modals: ModalState;
  openModal: (type: ModalType) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;

  // 모달 개별 setter (기존 API 호환)
  showAddContentModal: boolean;
  setShowAddContentModal: (show: boolean) => void;
  showAddAdHocModal: boolean;
  setShowAddAdHocModal: (show: boolean) => void;
  showRedistributeModal: boolean;
  setShowRedistributeModal: (show: boolean) => void;
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (show: boolean) => void;
  showAIPlanModal: boolean;
  setShowAIPlanModal: (show: boolean) => void;
  showCreateWizard: boolean;
  setShowCreateWizard: (show: boolean) => void;
  showOptimizationPanel: boolean;
  setShowOptimizationPanel: (show: boolean) => void;
  showQuickPlanModal: boolean;
  setShowQuickPlanModal: (show: boolean) => void;
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  showReorderModal: boolean;
  setShowReorderModal: (show: boolean) => void;
  showConditionalDeleteModal: boolean;
  setShowConditionalDeleteModal: (show: boolean) => void;
  showTemplateModal: boolean;
  setShowTemplateModal: (show: boolean) => void;
  showMoveToGroupModal: boolean;
  setShowMoveToGroupModal: (show: boolean) => void;
  showCopyModal: boolean;
  setShowCopyModal: (show: boolean) => void;
  showStatusModal: boolean;
  setShowStatusModal: (show: boolean) => void;
  showBulkEditModal: boolean;
  setShowBulkEditModal: (show: boolean) => void;
  showUnifiedAddModal: boolean;
  setShowUnifiedAddModal: (show: boolean) => void;
  showPlanGroupManageModal: boolean;
  setShowPlanGroupManageModal: (show: boolean) => void;
  showContentDependencyModal: boolean;
  setShowContentDependencyModal: (show: boolean) => void;
  showBatchOperationsModal: boolean;
  setShowBatchOperationsModal: (show: boolean) => void;
  showBlockSetCreateModal: boolean;
  setShowBlockSetCreateModal: (show: boolean) => void;

  // 통합 모달 모드
  unifiedModalMode: "quick" | "content";
  openUnifiedModal: (mode: "quick" | "content") => void;

  // 모달 데이터 상태
  selectedPlanForRedistribute: string | null;
  setSelectedPlanForRedistribute: (id: string | null) => void;
  selectedPlanForEdit: string | null;
  setSelectedPlanForEdit: (id: string | null) => void;
  reorderContainerType: "daily" | "weekly" | "unfinished";
  setReorderContainerType: (type: "daily" | "weekly" | "unfinished") => void;
  templatePlanIds: string[];
  setTemplatePlanIds: (ids: string[]) => void;
  selectedPlansForMove: string[];
  setSelectedPlansForMove: (ids: string[]) => void;
  currentGroupIdForMove: string | null;
  setCurrentGroupIdForMove: (id: string | null) => void;
  selectedPlansForCopy: string[];
  setSelectedPlansForCopy: (ids: string[]) => void;
  selectedPlanForStatus: { id: string; status: string; title: string } | null;
  setSelectedPlanForStatus: (
    data: { id: string; status: string; title: string } | null
  ) => void;
  selectedPlansForBulkEdit: string[];
  setSelectedPlansForBulkEdit: (ids: string[]) => void;
  newGroupIdForAI: string | null;
  setNewGroupIdForAI: (id: string | null) => void;

  // 콘텐츠 의존성 모달 데이터
  selectedContentForDependency: {
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    contentName: string;
  } | null;
  setSelectedContentForDependency: (
    content: {
      contentId: string;
      contentType: "book" | "lecture" | "custom";
      contentName: string;
    } | null
  ) => void;

  // 배치 작업 모달 데이터
  selectedPlansForBatch: string[];
  setSelectedPlansForBatch: (planIds: string[]) => void;
  batchOperationMode: "date" | "status" | null;
  setBatchOperationMode: (mode: "date" | "status" | null) => void;

  // 모달 열기 헬퍼
  handleOpenRedistribute: (planId: string) => void;
  handleOpenEdit: (planId: string) => void;
  handleOpenReorder: (containerType: "daily" | "weekly" | "unfinished") => void;
  handleOpenTemplateWithPlans: (planIds: string[]) => void;
  handleOpenMoveToGroup: (
    planIds: string[],
    currentGroupId?: string | null
  ) => void;
  handleOpenCopy: (planIds: string[]) => void;
  handleOpenStatusChange: (
    planId: string,
    currentStatus: string,
    title: string
  ) => void;
  handleOpenBulkEdit: (planIds: string[]) => void;
  handleOpenContentDependency: (content: {
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    contentName: string;
  }) => void;
  handleOpenBatchOperations: (
    planIds: string[],
    mode: "date" | "status"
  ) => void;

  // 플래너 데이터
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: PlannerExclusion[];

  // Toast
  toast: ReturnType<typeof useToast>;

  // 플랜 생성 가능 여부
  canCreatePlans: boolean;
}

const AdminPlanContext = createContext<AdminPlanContextValue | null>(null);

// Provider Props
interface AdminPlanProviderProps {
  children: ReactNode;
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
  allPlanGroups?: PlanGroupSummary[];
  selectedPlannerId?: string;
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: PlannerExclusion[];
}

export function AdminPlanProvider({
  children,
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
  allPlanGroups: initialPlanGroups,
  selectedPlannerId,
  plannerDailySchedules,
  plannerExclusions,
}: AdminPlanProviderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [contentTypeFilter, setContentTypeFilter] =
    useState<ContentTypeFilter>("all");

  // 플랜 그룹 선택 상태 (null = 전체 보기, 초기값은 활성 그룹)
  const allPlanGroups = initialPlanGroups ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    activePlanGroupId
  );

  // 모달 상태 관리 (useReducer 패턴)
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);

  // 모달 열기/닫기 헬퍼
  const openModal = useCallback((type: ModalType) => {
    dispatchModal({ type: "OPEN_MODAL", payload: type });
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    dispatchModal({ type: "CLOSE_MODAL", payload: type });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatchModal({ type: "CLOSE_ALL" });
  }, []);

  // 기존 API 호환 모달 상태 및 setter
  const modalSetters = useModalSetters(modals, dispatchModal);

  // 통합 모달 모드
  const [unifiedModalMode, setUnifiedModalMode] = useState<"quick" | "content">(
    "quick"
  );

  const openUnifiedModal = useCallback(
    (mode: "quick" | "content") => {
      setUnifiedModalMode(mode);
      modalSetters.setShowUnifiedAddModal(true);
    },
    [modalSetters]
  );

  // 모달 관련 데이터 상태
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] =
    useState<string | null>(null);
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
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);

  // 콘텐츠 의존성 모달 상태
  const [selectedContentForDependency, setSelectedContentForDependency] =
    useState<{
      contentId: string;
      contentType: "book" | "lecture" | "custom";
      contentName: string;
    } | null>(null);

  // 배치 작업 모달 상태
  const [selectedPlansForBatch, setSelectedPlansForBatch] = useState<string[]>(
    []
  );
  const [batchOperationMode, setBatchOperationMode] = useState<
    "date" | "status" | null
  >(null);

  // React Query 캐시 무효화
  const invalidateAllDocks = useInvalidateAllDockQueries();

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

  // 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    invalidateAllDocks();
    startTransition(() => {
      router.refresh();
    });
  }, [router, invalidateAllDocks]);

  // 실시간 업데이트 구독
  useAdminPlanRealtime({
    studentId,
    onRefresh: handleRefresh,
    debounceMs: 1000,
  });

  // 모달 열기 헬퍼 함수들
  const handleOpenRedistribute = useCallback(
    (planId: string) => {
      setSelectedPlanForRedistribute(planId);
      modalSetters.setShowRedistributeModal(true);
    },
    [modalSetters]
  );

  const handleOpenEdit = useCallback(
    (planId: string) => {
      setSelectedPlanForEdit(planId);
      modalSetters.setShowEditModal(true);
    },
    [modalSetters]
  );

  const handleOpenReorder = useCallback(
    (containerType: "daily" | "weekly" | "unfinished") => {
      setReorderContainerType(containerType);
      modalSetters.setShowReorderModal(true);
    },
    [modalSetters]
  );

  const handleOpenTemplateWithPlans = useCallback(
    (planIds: string[]) => {
      setTemplatePlanIds(planIds);
      modalSetters.setShowTemplateModal(true);
    },
    [modalSetters]
  );

  const handleOpenMoveToGroup = useCallback(
    (planIds: string[], currentGroupId?: string | null) => {
      setSelectedPlansForMove(planIds);
      setCurrentGroupIdForMove(currentGroupId ?? null);
      modalSetters.setShowMoveToGroupModal(true);
    },
    [modalSetters]
  );

  const handleOpenCopy = useCallback(
    (planIds: string[]) => {
      setSelectedPlansForCopy(planIds);
      modalSetters.setShowCopyModal(true);
    },
    [modalSetters]
  );

  const handleOpenStatusChange = useCallback(
    (planId: string, currentStatus: string, title: string) => {
      setSelectedPlanForStatus({ id: planId, status: currentStatus, title });
      modalSetters.setShowStatusModal(true);
    },
    [modalSetters]
  );

  const handleOpenBulkEdit = useCallback(
    (planIds: string[]) => {
      setSelectedPlansForBulkEdit(planIds);
      modalSetters.setShowBulkEditModal(true);
    },
    [modalSetters]
  );

  const handleOpenContentDependency = useCallback(
    (content: {
      contentId: string;
      contentType: "book" | "lecture" | "custom";
      contentName: string;
    }) => {
      setSelectedContentForDependency(content);
      modalSetters.setShowContentDependencyModal(true);
    },
    [modalSetters]
  );

  const handleOpenBatchOperations = useCallback(
    (planIds: string[], mode: "date" | "status") => {
      setSelectedPlansForBatch(planIds);
      setBatchOperationMode(mode);
      modalSetters.setShowBatchOperationsModal(true);
    },
    [modalSetters]
  );

  // 플랜 생성 가능 여부
  const canCreatePlans = !!selectedPlannerId;

  const value = useMemo<AdminPlanContextValue>(
    () => ({
      // 기본 정보
      studentId,
      studentName,
      tenantId,
      selectedPlannerId,
      activePlanGroupId,

      // 플랜 그룹 선택
      allPlanGroups,
      selectedGroupId,
      setSelectedGroupId,

      // 날짜 상태
      selectedDate,
      handleDateChange,

      // 새로고침
      handleRefresh,
      isPending,

      // 콘텐츠 필터
      contentTypeFilter,
      setContentTypeFilter,

      // 모달 상태 및 핸들러
      modals,
      openModal,
      closeModal,
      closeAllModals,

      // 모달 개별 setter
      ...modalSetters,

      // 통합 모달 모드
      unifiedModalMode,
      openUnifiedModal,

      // 모달 데이터 상태
      selectedPlanForRedistribute,
      setSelectedPlanForRedistribute,
      selectedPlanForEdit,
      setSelectedPlanForEdit,
      reorderContainerType,
      setReorderContainerType,
      templatePlanIds,
      setTemplatePlanIds,
      selectedPlansForMove,
      setSelectedPlansForMove,
      currentGroupIdForMove,
      setCurrentGroupIdForMove,
      selectedPlansForCopy,
      setSelectedPlansForCopy,
      selectedPlanForStatus,
      setSelectedPlanForStatus,
      selectedPlansForBulkEdit,
      setSelectedPlansForBulkEdit,
      newGroupIdForAI,
      setNewGroupIdForAI,

      // 콘텐츠 의존성 모달 데이터
      selectedContentForDependency,
      setSelectedContentForDependency,

      // 배치 작업 모달 데이터
      selectedPlansForBatch,
      setSelectedPlansForBatch,
      batchOperationMode,
      setBatchOperationMode,

      // 모달 열기 헬퍼
      handleOpenRedistribute,
      handleOpenEdit,
      handleOpenReorder,
      handleOpenTemplateWithPlans,
      handleOpenMoveToGroup,
      handleOpenCopy,
      handleOpenStatusChange,
      handleOpenBulkEdit,
      handleOpenContentDependency,
      handleOpenBatchOperations,

      // 플래너 데이터
      plannerDailySchedules,
      plannerExclusions,

      // Toast
      toast,

      // 플랜 생성 가능 여부
      canCreatePlans,
    }),
    [
      studentId,
      studentName,
      tenantId,
      selectedPlannerId,
      activePlanGroupId,
      allPlanGroups,
      selectedGroupId,
      selectedDate,
      handleDateChange,
      handleRefresh,
      isPending,
      contentTypeFilter,
      modals,
      openModal,
      closeModal,
      closeAllModals,
      modalSetters,
      unifiedModalMode,
      openUnifiedModal,
      selectedPlanForRedistribute,
      selectedPlanForEdit,
      reorderContainerType,
      templatePlanIds,
      selectedPlansForMove,
      currentGroupIdForMove,
      selectedPlansForCopy,
      selectedPlanForStatus,
      selectedPlansForBulkEdit,
      newGroupIdForAI,
      handleOpenRedistribute,
      handleOpenEdit,
      handleOpenReorder,
      handleOpenTemplateWithPlans,
      handleOpenMoveToGroup,
      handleOpenCopy,
      handleOpenStatusChange,
      handleOpenBulkEdit,
      handleOpenContentDependency,
      handleOpenBatchOperations,
      selectedContentForDependency,
      selectedPlansForBatch,
      batchOperationMode,
      plannerDailySchedules,
      plannerExclusions,
      toast,
      canCreatePlans,
    ]
  );

  return (
    <AdminPlanContext.Provider value={value}>
      {children}
    </AdminPlanContext.Provider>
  );
}

// Hook to use the context
export function useAdminPlan() {
  const context = useContext(AdminPlanContext);
  if (!context) {
    throw new Error("useAdminPlan must be used within AdminPlanProvider");
  }
  return context;
}
