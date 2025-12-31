"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordGoalProgressAction as recordGoalProgress, getAllGoalsAction } from "@/lib/domains/goal";

type AttachGoalButtonProps = {
  goalId?: string;
  planId?: string;
};

export function AttachGoalButton({ goalId, planId }: AttachGoalButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [goals, setGoals] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = async () => {
    setShowModal(true);
    setError(null);
    setLoading(true);

    try {
      // 목표 목록 불러오기 (서버 액션 사용)
      const allGoals = await getAllGoalsAction();
      setGoals(allGoals.map((g) => ({ id: g.id, title: g.title })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "목표 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGoal = (selectedGoalId: string) => {
    if (!planId) {
      setError("플랜 ID가 필요합니다.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await recordGoalProgress(selectedGoalId, planId);
        if (result.success) {
          setShowModal(false);
          router.refresh();
        } else {
          setError(result.error || "목표 연결에 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "목표 연결에 실패했습니다.");
      }
    });
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        {goalId ? "목표 연결" : "+ 목표 연결"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-xl max-w-md w-full px-4">
            <h3 className="text-lg font-semibold text-gray-900">목표 선택</h3>
            {loading ? (
              <p className="text-sm text-gray-500">목표 목록을 불러오는 중...</p>
            ) : error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 목표가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => handleSelectGoal(goal.id)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">{goal.title}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

