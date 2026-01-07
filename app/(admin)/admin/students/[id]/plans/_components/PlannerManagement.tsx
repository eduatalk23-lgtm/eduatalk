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

import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getStudentPlannersAction,
  updatePlannerStatusAction,
  deletePlannerAction,
  type Planner,
  type PlannerStatus,
} from "@/lib/domains/admin-plan/actions";
import { PlannerCreationModal } from "./PlannerCreationModal";

// ============================================
// 타입 정의
// ============================================

interface PlannerManagementProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  onPlannerSelect?: (planner: Planner) => void;
  selectedPlannerId?: string;
}

// ============================================
// 상태 표시 컴포넌트
// ============================================

function StatusBadge({ status }: { status: PlannerStatus }) {
  const config = {
    draft: { label: "초안", bg: "bg-gray-100", text: "text-gray-700" },
    active: { label: "활성", bg: "bg-green-100", text: "text-green-700" },
    paused: { label: "일시정지", bg: "bg-yellow-100", text: "text-yellow-700" },
    archived: { label: "보관됨", bg: "bg-slate-100", text: "text-slate-700" },
    completed: { label: "완료", bg: "bg-blue-100", text: "text-blue-700" },
  }[status];

  return (
    <span
      className={cn(
        "px-2 py-0.5 text-xs font-medium rounded",
        config.bg,
        config.text
      )}
    >
      {config.label}
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
}: {
  planner: Planner;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: PlannerStatus) => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleStatusAction = (status: PlannerStatus) => {
    setMenuOpen(false);
    onStatusChange(status);
  };

  return (
    <div
      className={cn(
        "relative p-4 bg-white border rounded-lg transition-all cursor-pointer",
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      )}
      onClick={onSelect}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{planner.name}</h4>
          {planner.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
              {planner.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={planner.status} />

          {/* 메뉴 버튼 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>

            {/* 드롭다운 메뉴 */}
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {/* 수정 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4" />
                    수정
                  </button>
                  {/* 복제 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDuplicate();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                  >
                    <Copy className="w-4 h-4" />
                    복제
                  </button>
                  <hr className="my-1" />
                  {/* 상태 변경 */}
                  {planner.status === "draft" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusAction("active");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                    >
                      <Play className="w-4 h-4" />
                      재개
                    </button>
                  )}
                  {planner.status !== "completed" && planner.status !== "archived" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusAction("completed");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
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
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                  >
                    <Archive className="w-4 h-4" />
                    보관
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 기간 정보 */}
      <div className="flex items-center gap-1 mt-3 text-sm text-gray-600">
        <Calendar className="w-4 h-4" />
        <span>
          {formatDate(planner.periodStart)} ~ {formatDate(planner.periodEnd)}
        </span>
      </div>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {planner.planGroupCount !== undefined && (
          <span className="text-xs text-gray-500">
            플랜그룹 {planner.planGroupCount}개
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
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
}: PlannerManagementProps) {
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editPlanner, setEditPlanner] = useState<Planner | undefined>();
  const [duplicatePlanner, setDuplicatePlanner] = useState<Planner | undefined>();

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

      {/* 빈 상태 */}
      {!isLoading && !error && planners.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">아직 생성된 플래너가 없습니다.</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
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

export default PlannerManagement;
