"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { PlanExclusion } from "@/lib/types/plan/domain";
import {
  addStudentExclusionForAdmin,
  deleteStudentExclusionForAdmin,
  updateStudentExclusionForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface AdminExclusionManagementProps {
  studentId: string;
  initialExclusions: PlanExclusion[];
}

const EXCLUSION_TYPES = [
  { value: "holiday", label: "휴일지정" },
  { value: "vacation", label: "휴가" },
  { value: "personal", label: "개인사정" },
  { value: "custom", label: "기타" },
];

const KOREAN_TYPE_MAP: Record<string, string> = {
  "휴일지정": "holiday",
  "휴가": "vacation",
  "개인사정": "personal",
  "기타": "custom",
};

export function AdminExclusionManagement({
  studentId,
  initialExclusions,
}: AdminExclusionManagementProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [exclusions, setExclusions] = useState(initialExclusions);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);

  // 추가 폼 상태
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("holiday");
  const [newReason, setNewReason] = useState("");

  // 수정 폼 상태
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState("");
  const [editReason, setEditReason] = useState("");

  // 다중 선택 핸들러
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(exclusions.map((e) => e.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isAllSelected = exclusions.length > 0 && selectedIds.length === exclusions.length;
  const hasSelection = selectedIds.length > 0;

  // 배치 삭제 핸들러
  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setBatchDeleteConfirmOpen(true);
  };

  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    startTransition(async () => {
      const results = await Promise.all(
        selectedIds.map((id) => deleteStudentExclusionForAdmin(id))
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        showError(`${failCount}개 항목 삭제 실패`);
      }

      if (successCount > 0) {
        showSuccess(`${successCount}개 제외일이 삭제되었습니다.`);
        setExclusions((prev) =>
          prev.filter((e) => !selectedIds.includes(e.id) || !results[selectedIds.indexOf(e.id)]?.success)
        );
      }

      setSelectedIds([]);
      setBatchDeleteConfirmOpen(false);
    });
  };

  const handleAdd = async () => {
    if (!newDate) {
      showError("날짜를 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await addStudentExclusionForAdmin(studentId, {
        exclusion_date: newDate,
        exclusion_type: newType,
        reason: newReason || undefined,
      });

      if (result.success) {
        showSuccess("제외일이 추가되었습니다.");
        setIsAdding(false);
        setNewDate("");
        setNewType("holiday");
        setNewReason("");
        router.refresh();
      } else {
        showError(result.error || "제외일 추가에 실패했습니다.");
      }
    });
  };

  const handleEdit = (exclusion: PlanExclusion) => {
    setEditingId(exclusion.id);
    setEditDate(exclusion.exclusion_date);
    setEditType(KOREAN_TYPE_MAP[exclusion.exclusion_type] || "custom");
    setEditReason(exclusion.reason || "");
  };

  const handleUpdate = async () => {
    if (!editingId || !editDate) return;

    startTransition(async () => {
      const result = await updateStudentExclusionForAdmin(editingId, {
        exclusion_date: editDate,
        exclusion_type: editType,
        reason: editReason || undefined,
      });

      if (result.success) {
        showSuccess("제외일이 수정되었습니다.");
        setEditingId(null);
        router.refresh();
      } else {
        showError(result.error || "제외일 수정에 실패했습니다.");
      }
    });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;

    startTransition(async () => {
      const result = await deleteStudentExclusionForAdmin(deleteTargetId);

      if (result.success) {
        showSuccess("제외일이 삭제되었습니다.");
        setExclusions((prev) => prev.filter((e) => e.id !== deleteTargetId));
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTargetId));
      } else {
        showError(result.error || "제외일 삭제에 실패했습니다.");
      }

      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy년 M월 d일 (EEE)", { locale: ko });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">학습 제외일</h3>
          {hasSelection && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {selectedIds.length}개 선택
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSelection ? (
            <>
              <button
                onClick={clearSelection}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                선택 해제
              </button>
              <button
                onClick={handleBatchDeleteClick}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {selectedIds.length}개 삭제
              </button>
            </>
          ) : (
            !isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                추가
              </button>
            )
          )}
        </div>
      </div>

      {/* 추가 폼 */}
      {isAdding && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  날짜
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  유형
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {EXCLUSION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  사유
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="선택사항"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewDate("");
                  setNewType("holiday");
                  setNewReason("");
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={isPending || !newDate}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제외일 목록 */}
      {exclusions.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          등록된 제외일이 없습니다.
        </p>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {/* 전체 선택 헤더 */}
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => (isAllSelected ? clearSelection() : selectAll())}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">
              {isAllSelected ? "전체 선택 해제" : "전체 선택"}
            </span>
          </div>
          {exclusions.map((exclusion) => (
            <div
              key={exclusion.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={selectedIds.includes(exclusion.id)}
                onChange={() => toggleSelection(exclusion.id)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />

              {editingId === exclusion.id ? (
                // 수정 모드
                <div className="flex flex-1 flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {EXCLUSION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="사유 (선택)"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={isPending}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isPending ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                // 보기 모드
                <>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(exclusion.exclusion_date)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {exclusion.exclusion_type}
                      </span>
                      {exclusion.reason && (
                        <span className="text-xs text-gray-500">
                          {exclusion.reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(exclusion)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteClick(exclusion.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 개별 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="제외일 삭제"
        description="이 제외일을 삭제하시겠습니까?"
        confirmLabel={isPending ? "삭제 중..." : "삭제"}
        cancelLabel="취소"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isPending}
      />

      {/* 배치 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={batchDeleteConfirmOpen}
        onOpenChange={setBatchDeleteConfirmOpen}
        title={`제외일 ${selectedIds.length}개 삭제`}
        description={`선택한 ${selectedIds.length}개의 제외일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel={isPending ? "삭제 중..." : `${selectedIds.length}개 삭제`}
        cancelLabel="취소"
        onConfirm={handleBatchDeleteConfirm}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
