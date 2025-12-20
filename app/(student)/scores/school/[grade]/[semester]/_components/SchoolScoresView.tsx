"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SchoolScore } from "@/lib/data/studentScores";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { ScoreCardGrid } from "@/app/(student)/scores/_components/ScoreCardGrid";
import { ScoreFormModal } from "@/app/(student)/scores/_components/ScoreFormModal";
import { Dialog } from "@/components/ui/Dialog";
import { deleteInternalScore } from "@/app/actions/scores-internal";
import { useToast } from "@/components/ui/ToastProvider";

type SchoolScoresViewProps = {
  initialGrade?: number;
  initialSemester?: number;
  scores: SchoolScore[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  subjectTypes: SubjectType[];
};

export function SchoolScoresView({
  initialGrade,
  initialSemester,
  scores,
  subjectGroups,
  subjectTypes,
}: SchoolScoresViewProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<SchoolScore | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingScoreId, setDeletingScoreId] = useState<string | null>(null);

  const handleAddClick = () => {
    setEditingScore(null);
    setIsModalOpen(true);
  };

  const handleEdit = (score: SchoolScore) => {
    setEditingScore(score);
    setIsModalOpen(true);
  };

  const handleDelete = (scoreId: string) => {
    setDeletingScoreId(scoreId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingScoreId) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        await deleteInternalScore(deletingScoreId);
        showSuccess("성적이 성공적으로 삭제되었습니다.");
        setDeleteConfirmOpen(false);
        setDeletingScoreId(null);
        router.refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "삭제에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingScore(null);
  };

  return (
    <>
      <ScoreCardGrid
        initialGrade={initialGrade}
        initialSemester={initialSemester}
        scores={scores}
        subjectGroups={subjectGroups}
        subjectTypes={subjectTypes}
        onAddClick={handleAddClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* 추가/수정 모달 */}
      <ScoreFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialGrade={initialGrade}
        initialSemester={initialSemester}
        subjectGroups={subjectGroups}
        subjectTypes={subjectTypes}
        editingScore={editingScore}
        onSuccess={handleModalSuccess}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="성적 삭제 확인"
        description="정말로 이 성적을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        variant="destructive"
        maxWidth="sm"
      >
        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeletingScoreId(null);
            }}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleDeleteConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

