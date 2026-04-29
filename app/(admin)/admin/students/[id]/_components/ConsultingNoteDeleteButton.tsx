"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteConsultingNote } from "@/lib/domains/student";

export function ConsultingNoteDeleteButton({
  noteId,
  studentId,
}: {
  noteId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteConsultingNote(noteId, studentId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "삭제에 실패했습니다.");
        setIsDeleting(false);
        setShowConfirm(false);
      }
    } catch (error) {
      console.error("[ConsultingNoteDeleteButton] 삭제 실패", error);
      alert("삭제 중 오류가 발생했습니다.");
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isDeleting}
          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "삭제 중..." : "삭제"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded px-2 py-1 text-xs text-text-tertiary hover:bg-bg-tertiary hover:text-red-600 disabled:opacity-50"
      title="삭제"
    >
      🗑️
    </button>
  );
}

