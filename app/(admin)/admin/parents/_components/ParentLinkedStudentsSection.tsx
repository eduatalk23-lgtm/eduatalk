"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Link2, Unlink, Plus } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { getLinkedStudentsByParentAction } from "@/lib/domains/parent/actions/linkedStudents";
import { deleteParentStudentLink } from "@/lib/domains/student/actions/parentLinks";
import { PARENT_RELATION_LABELS } from "@/lib/constants/parents";
import type { ParentRelation } from "@/lib/domains/parent/types";
import { ParentStudentLinkModal } from "./ParentStudentLinkModal";

type ParentLinkedStudentsSectionProps = {
  parentId: string;
};

export function ParentLinkedStudentsSection({
  parentId,
}: ParentLinkedStudentsSectionProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ linkId: string; name: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["parentLinkedStudents", parentId],
    queryFn: () => getLinkedStudentsByParentAction(parentId),
    staleTime: 1000 * 30,
  });

  const students = data?.data ?? [];

  const handleUnlink = () => {
    if (!unlinkTarget) return;
    startTransition(async () => {
      const result = await deleteParentStudentLink(unlinkTarget.linkId);
      if (result.success) {
        showSuccess("학생 연결이 해제되었습니다.");
        queryClient.invalidateQueries({ queryKey: ["parentLinkedStudents", parentId] });
        queryClient.invalidateQueries({ queryKey: ["parentSearch"] });
      } else {
        showError(result.error ?? "연결 해제에 실패했습니다.");
      }
      setUnlinkTarget(null);
    });
  };

  const handleLinkCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["parentLinkedStudents", parentId] });
    queryClient.invalidateQueries({ queryKey: ["parentSearch"] });
    setShowLinkModal(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">연결 학생</h3>
          <span className="text-xs text-gray-400">({students.length}명)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
        >
          <Plus className="h-3.5 w-3.5" />
          학생 연결
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : students.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">
          연결된 학생이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student) => (
            <div
              key={student.linkId}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {student.name ?? "이름 없음"}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                    {PARENT_RELATION_LABELS[student.relation as ParentRelation] ?? student.relation}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {student.grade && <span>{student.grade}학년</span>}
                  {student.class && <span>{student.class}반</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnlinkTarget({ linkId: student.linkId, name: student.name })}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Unlink className="h-3 w-3" />
                해제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 학생 연결 모달 */}
      <ParentStudentLinkModal
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        parentId={parentId}
        onLinkCreated={handleLinkCreated}
      />

      {/* 연결 해제 확인 */}
      <ConfirmDialog
        open={!!unlinkTarget}
        onOpenChange={(open) => !open && setUnlinkTarget(null)}
        title="학생 연결 해제"
        description={`${unlinkTarget?.name ?? "이 학생"}과의 연결을 해제하시겠습니까?`}
        confirmLabel="해제"
        cancelLabel="취소"
        onConfirm={handleUnlink}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
