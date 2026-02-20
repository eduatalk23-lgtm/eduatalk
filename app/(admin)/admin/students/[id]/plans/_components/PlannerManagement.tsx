"use client";

/**
 * PlannerManagement
 *
 * 학생별 플래너 목록 관리 컴포넌트
 * - 플래너 생성, 조회, 수정, 삭제
 * - 플래너 상태 관리
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlannerManagement
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Archive,
  Play,
  Pause,
  ChevronRight,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Clock,
  FolderOpen,
  Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getStudentPlannersAction,
  updatePlannerStatusAction,
  deletePlannerAction,
  type Planner,
  type PlannerStatus,
} from "@/lib/domains/admin-plan/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { PlannerStatusBadge } from "@/components/planner/PlannerStatusBadge";
import { PlannerCreationModal } from "./PlannerCreationModal";
import { PlannerStats } from "./PlannerStats";

// ============================================
// 타입 정의
// ============================================

/** 뷰 모드 타입 */
type ViewMode = 'admin' | 'student';

interface PlannerManagementProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  onPlannerSelect?: (planner: Planner | null) => void;
  selectedPlannerId?: string;
  /**
   * 컴포넌트 모드
   * - 'selection': 플래너 선택 전용 페이지 (PlannerStats 숨김)
   * - 'inline': 기존 인라인 모드 (기본값)
   */
  mode?: 'selection' | 'inline';
  /**
   * 뷰 모드
   * - 'admin': 관리자 모드 (모든 기능 표시)
   * - 'student': 학생 모드 (Admin 전용 기능 숨김)
   */
  viewMode?: ViewMode;
}

// ============================================
// 생성자 뱃지 컴포넌트
// ============================================

function CreatorBadge({ isStudentCreated }: { isStudentCreated: boolean }) {
  if (isStudentCreated) {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-700">
        내가 만든 플래너
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
      관리자 생성
    </span>
  );
}

// ============================================
// 플래너 카드 컴포넌트
// ============================================

function PlannerCard({
  planner,
  isSelected,
  onSelect,
  onStatusChange,
  onDelete,
  onEdit,
  onDuplicate,
  viewMode = 'admin',
  studentId,
  navigable = true,
}: {
  planner: Planner;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: PlannerStatus) => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  viewMode?: ViewMode;
  studentId?: string;
  /** 카드 클릭으로 상세 페이지 이동 가능 여부 */
  navigable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape 키로 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // 학생 모드: 관리자 생성 플래너는 메뉴 숨김
  const isStudentMode = viewMode === 'student';
  const isStudentCreated = isStudentMode && planner.createdBy === studentId;
  const showMenu = !isStudentMode || isStudentCreated;

  // 메뉴 열기 (스마트 위치 계산)
  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const menuWidth = 160;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      if (spaceBelow >= menuHeight) {
        top = rect.bottom + 4;
      } else if (spaceAbove >= menuHeight) {
        top = rect.top - menuHeight - 4;
      } else {
        top =
          spaceBelow > spaceAbove
            ? Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8)
            : Math.max(8, rect.top - menuHeight - 4);
      }

      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }

      setMenuPosition({ top, left });
    }
    setMenuOpen(!menuOpen);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  const formatFullDate = (date: string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 남은 일수 계산
  const getDaysRemaining = () => {
    const end = new Date(planner.periodEnd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysRemaining = getDaysRemaining();

  const handleStatusAction = (status: PlannerStatus) => {
    setMenuOpen(false);
    onStatusChange(status);
  };

  // 상태별 배경색
  const statusBgColors = {
    draft: "from-gray-50 to-gray-100/50",
    active: "from-emerald-50 to-teal-50/50",
    paused: "from-amber-50 to-yellow-50/50",
    archived: "from-slate-50 to-gray-50/50",
    completed: "from-blue-50 to-indigo-50/50",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 transition-all duration-200",
        "bg-gradient-to-br",
        statusBgColors[planner.status],
        navigable ? "cursor-pointer" : "cursor-default",
        navigable && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/20"
          : navigable
            ? "border-transparent hover:border-gray-300 hover:shadow-md"
            : "border-transparent",
        menuOpen && "z-30"
      )}
      role={navigable ? "button" : undefined}
      tabIndex={navigable ? 0 : undefined}
      onClick={navigable ? onSelect : undefined}
      onKeyDown={navigable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
    >
      {/* 상단 컬러 바 */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 rounded-t-xl",
          planner.status === "active" && "bg-gradient-to-r from-emerald-500 to-teal-500",
          planner.status === "draft" && "bg-gradient-to-r from-gray-400 to-gray-500",
          planner.status === "paused" && "bg-gradient-to-r from-amber-500 to-yellow-500",
          planner.status === "archived" && "bg-gradient-to-r from-slate-400 to-gray-400",
          planner.status === "completed" && "bg-gradient-to-r from-blue-500 to-indigo-500"
        )}
      />

      <div className="p-5">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PlannerStatusBadge status={planner.status} variant={isStudentMode ? "student" : "admin"} />
              {isStudentMode && (
                <CreatorBadge isStudentCreated={planner.createdBy === studentId} />
              )}
              {planner.status === "active" && daysRemaining >= 0 && daysRemaining <= 7 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                  D-{daysRemaining}
                </span>
              )}
            </div>
            <h4 className={cn("text-lg font-semibold text-gray-900 truncate transition-colors", navigable && "group-hover:text-blue-600")}>
              {planner.name}
            </h4>
            {planner.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {planner.description}
              </p>
            )}
          </div>

          {/* 메뉴 버튼 (학생 모드 + 관리자 생성 플래너: 숨김) */}
          {showMenu && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleMenuOpen(e);
              }}
              className={cn(
                "p-2 rounded-lg transition-all shrink-0",
                "text-gray-400 hover:text-gray-600",
                menuOpen ? "bg-gray-200 text-gray-600" : "hover:bg-gray-200/70"
              )}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 기간 정보 */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 shadow-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <div className="text-xs text-gray-400">학습 기간</div>
              <div className="font-medium">
                {formatDate(planner.periodStart)} ~ {formatDate(planner.periodEnd)}
              </div>
            </div>
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-2.5 bg-white/60 rounded-lg">
            <FolderOpen className="w-4 h-4 text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {planner.planGroupCount ?? 0}
            </span>
            <span className="text-xs text-gray-500">{isStudentMode ? "학습 계획" : "플랜그룹"}</span>
          </div>
          <div className="flex flex-col items-center p-2.5 bg-white/60 rounded-lg">
            <Clock className="w-4 h-4 text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {(planner.defaultSchedulerOptions as { study_days?: number } | null)?.study_days ?? 6}
            </span>
            <span className="text-xs text-gray-500">주간 학습일</span>
          </div>
          <div className="flex flex-col items-center p-2.5 bg-white/60 rounded-lg">
            <Target className="w-4 h-4 text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900">
              {daysRemaining >= 0 ? daysRemaining : 0}
            </span>
            <span className="text-xs text-gray-500">남은 일수</span>
          </div>
        </div>

        {/* 하단 CTA */}
        <div className="mt-4 pt-3 border-t border-gray-200/50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {formatFullDate(planner.periodStart)} 시작
          </span>
          {navigable ? (
            <div className="flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
              <span>{isStudentMode ? "학습하기" : "관리하기"}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          ) : (
            <span className="text-sm text-gray-400">
              {isStudentMode ? "선생님이 관리하는 플래너예요" : "열람 전용"}
            </span>
          )}
        </div>
      </div>

      {/* 드롭다운 메뉴 */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            className="fixed z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 max-h-[300px] overflow-y-auto"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {/* 수정/복제: 관리자 전용 */}
            {!isStudentMode && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-4 h-4 text-gray-400" />
                  수정
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDuplicate();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-400" />
                  복제
                </button>
                <hr className="my-1.5 mx-3" />
              </>
            )}
            {/* 상태 변경: 활성화/일시정지/재개 */}
            {planner.status === "draft" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusAction("active");
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-emerald-50 text-emerald-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                활성화
              </button>
            )}
            {planner.status === "active" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusAction("paused");
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-amber-50 text-amber-600 transition-colors"
              >
                <Pause className="w-4 h-4" />
                일시정지
              </button>
            )}
            {planner.status === "paused" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusAction("active");
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-emerald-50 text-emerald-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                재개
              </button>
            )}
            {/* 완료 처리/보관: 관리자 전용 */}
            {!isStudentMode && (
              <>
                {planner.status !== "completed" && planner.status !== "archived" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusAction("completed");
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-blue-50 text-blue-600 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    완료 처리
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusAction("archived");
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Archive className="w-4 h-4 text-gray-400" />
                  보관
                </button>
              </>
            )}
            <hr className="my-1.5 mx-3" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PlannerManagement({
  studentId,
  tenantId,
  studentName,
  onPlannerSelect,
  selectedPlannerId,
  mode = 'inline',
  viewMode = 'admin',
}: PlannerManagementProps) {
  const isAdminMode = viewMode === 'admin';
  const toast = useToast();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editPlanner, setEditPlanner] = useState<Planner | undefined>();
  const [duplicatePlanner, setDuplicatePlanner] = useState<Planner | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      toast.showError(err instanceof Error ? err.message : "상태 변경에 실패했습니다.");
    }
  };

  // 플래너 삭제 확인 다이얼로그 열기
  const handleDeleteRequest = (plannerId: string, plannerName: string) => {
    setDeleteTarget({ id: plannerId, name: plannerName });
  };

  // 플래너 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deletePlannerAction(deleteTarget.id);
      loadPlanners();
      if (selectedPlannerId === deleteTarget.id) {
        onPlannerSelect?.(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("[PlannerManagement] 삭제 실패:", err);
      toast.showError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 플래너 생성/수정/복제 완료
  const handlePlannerSaved = (planner: Planner) => {
    setCreateModalOpen(false);
    setEditPlanner(undefined);
    setDuplicatePlanner(undefined);

    // onPlannerSelect가 있으면 다른 페이지로 이동하므로 목록 갱신 불필요
    // 라우팅과 상태 변경의 경합 조건(race condition) 방지
    if (onPlannerSelect) {
      onPlannerSelect(planner);
    } else {
      // onPlannerSelect가 없으면 현재 페이지에 남아있으므로 목록 갱신
      loadPlanners();
    }
  };

  // 모달 닫기
  const handleModalClose = () => {
    setCreateModalOpen(false);
    setEditPlanner(undefined);
    setDuplicatePlanner(undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className={cn(
        "flex sm:items-center gap-4",
        mode === 'selection' ? "justify-end" : "flex-col sm:flex-row justify-between"
      )}>
        {mode !== 'selection' && (
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isAdminMode ? `${studentName}의 플래너` : "내 플래너"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              학습 플랜을 관리할 플래너를 선택하세요
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          {isAdminMode && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              보관됨 포함
            </label>
          )}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30"
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-8">
          {/* 배경 장식 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative flex flex-col items-center justify-center py-8 text-center">
            <div className="flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 shadow-xl">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-3">
              플래너를 시작해보세요
            </h4>
            <p className="text-base text-white/80 mb-8 max-w-md">
              {isAdminMode
                ? "플래너를 생성하면 학생의 학습 플랜을 체계적으로 관리할 수 있습니다. 목표 기간, 학습 일정, 콘텐츠를 한 곳에서 관리하세요."
                : "나의 학습 플랜을 체계적으로 관리할 수 있어요. 목표 기간, 학습 일정을 한 곳에서 관리해보세요."}
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 shadow-xl shadow-black/20 transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              첫 플래너 만들기
            </button>
          </div>
        </div>
      )}

      {/* 플래너 목록 */}
      {!isLoading && planners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {planners.map((planner) => {
            const isNavigable = viewMode !== 'student' || planner.createdBy === studentId;
            return (
              <PlannerCard
                key={planner.id}
                planner={planner}
                isSelected={selectedPlannerId === planner.id}
                onSelect={() => onPlannerSelect?.(planner)}
                onStatusChange={(status) => handleStatusChange(planner.id, status)}
                onDelete={() => handleDeleteRequest(planner.id, planner.name)}
                onEdit={() => setEditPlanner(planner)}
                onDuplicate={() => setDuplicatePlanner(planner)}
                viewMode={viewMode}
                studentId={studentId}
                navigable={isNavigable}
              />
            );
          })}
        </div>
      )}

      {/* 선택된 플래너 통계 및 타임라인 (selection 모드에서는 숨김) */}
      {mode !== 'selection' && selectedPlanner && (
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
        viewMode={viewMode}
      />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="플래너 삭제"
        description={`"${deleteTarget?.name}" 플래너를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}

export default PlannerManagement;
