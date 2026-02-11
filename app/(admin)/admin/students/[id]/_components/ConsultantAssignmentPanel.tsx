"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
  borderInput,
} from "@/lib/utils/darkMode";
import {
  getStudentAssignmentsAction,
  createConsultantAssignmentAction,
  deleteConsultantAssignmentAction,
  getConsultantsAction,
} from "@/lib/domains/consultant/actions/assignments";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  type ConsultantAssignmentWithDetails,
  type ConsultantRole,
} from "@/lib/domains/consultant/types";

type ConsultantAssignmentPanelProps = {
  studentId: string;
};

export function ConsultantAssignmentPanel({
  studentId,
}: ConsultantAssignmentPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [assignments, setAssignments] = useState<
    ConsultantAssignmentWithDetails[]
  >([]);
  const [consultants, setConsultants] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // 추가 폼 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConsultantId, setNewConsultantId] = useState("");
  const [newRole, setNewRole] = useState<ConsultantRole>("primary");
  const [newNotes, setNewNotes] = useState("");

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadData = async () => {
    const [assignmentResult, consultantResult] = await Promise.all([
      getStudentAssignmentsAction(studentId),
      getConsultantsAction(),
    ]);

    if (assignmentResult.success && assignmentResult.data) {
      setAssignments(assignmentResult.data);
    }
    if (consultantResult.success && consultantResult.data) {
      setConsultants(consultantResult.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  const handleAdd = () => {
    if (!newConsultantId) {
      toast.showError("컨설턴트를 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createConsultantAssignmentAction({
        student_id: studentId,
        consultant_id: newConsultantId,
        role: newRole,
        notes: newNotes || undefined,
      });

      if (result.success) {
        toast.showSuccess("컨설턴트가 배정되었습니다.");
        setShowAddForm(false);
        setNewConsultantId("");
        setNewRole("primary");
        setNewNotes("");
        loadData();
        router.refresh();
      } else {
        toast.showError(result.error ?? "배정에 실패했습니다.");
      }
    });
  };

  const handleDelete = (assignmentId: string) => {
    startTransition(async () => {
      const result = await deleteConsultantAssignmentAction(assignmentId);
      if (result.success) {
        toast.showSuccess("배정이 삭제되었습니다.");
        setDeleteTarget(null);
        loadData();
        router.refresh();
      } else {
        toast.showError(result.error ?? "삭제에 실패했습니다.");
      }
    });
  };

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  if (loading) {
    return (
      <div className={cn("rounded-lg border p-6", borderDefault, bgSurface)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-6", borderDefault, bgSurface)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cn("text-lg font-semibold", textPrimary)}>
          컨설턴트 배정
        </h3>
        {!showAddForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            + 배정 추가
          </Button>
        )}
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div
          className={cn(
            "mb-4 rounded-lg border p-4",
            borderDefault,
            "bg-gray-50 dark:bg-gray-800/50"
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newConsultantId}
                onChange={(e) => setNewConsultantId(e.target.value)}
                disabled={isPending}
                className={inputClass}
              >
                <option value="">컨설턴트 선택</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === "admin" ? "관리자" : "컨설턴트"})
                  </option>
                ))}
              </select>

              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as ConsultantRole)}
                disabled={isPending}
                className={inputClass}
              >
                <option value="primary">주담당</option>
                <option value="secondary">부담당</option>
                <option value="assistant">보조</option>
              </select>
            </div>

            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              disabled={isPending}
              placeholder="메모 (선택)"
              className={inputClass}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewConsultantId("");
                  setNewRole("primary");
                  setNewNotes("");
                }}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={isPending || !newConsultantId}
                isLoading={isPending}
              >
                배정
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 배정 목록 */}
      {assignments.length === 0 ? (
        <p className={cn("text-sm", textSecondary)}>
          배정된 컨설턴트가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3",
                borderDefault,
                "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    ROLE_COLORS[a.role]
                  )}
                >
                  {ROLE_LABELS[a.role]}
                </span>
                <span className={cn("text-sm font-medium", textPrimary)}>
                  {a.consultant_name}
                </span>
                {a.program_name && (
                  <span className={cn("text-xs", textSecondary)}>
                    · {a.program_name}
                  </span>
                )}
                {a.notes && (
                  <span className={cn("text-xs", textSecondary)}>
                    · {a.notes}
                  </span>
                )}
              </div>

              <button
                onClick={() => setDeleteTarget(a.id)}
                className="text-xs text-red-500 hover:text-red-700"
                disabled={isPending}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="컨설턴트 배정 삭제"
        description="이 배정을 삭제하시겠습니까?"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        confirmLabel="삭제"
        variant="destructive"
      />
    </div>
  );
}
