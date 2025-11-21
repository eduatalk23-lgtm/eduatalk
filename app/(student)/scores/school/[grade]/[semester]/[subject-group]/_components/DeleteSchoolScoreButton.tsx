"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSchoolScore } from "@/app/actions/scores/school";

type DeleteSchoolScoreButtonProps = {
  id: string;
};

export function DeleteSchoolScoreButton({ id }: DeleteSchoolScoreButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteSchoolScore(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      } finally {
        setShowConfirm(false);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        삭제
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">성적 삭제 확인</h3>
            <p className="mt-2 text-sm text-gray-600">
              정말로 이 성적을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            {error && (
              <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

