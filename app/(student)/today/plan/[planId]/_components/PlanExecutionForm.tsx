"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { StudySession } from "@/lib/data/studentSessions";
import { startPlan, completePlan, postponePlan } from "@/app/(student)/today/actions/todayActions";

type PlanExecutionFormProps = {
  plan: Plan;
  content: Book | Lecture | CustomContent;
  activeSession: StudySession | null;
  unitLabel: string;
};

export function PlanExecutionForm({
  plan,
  content,
  activeSession,
  unitLabel,
}: PlanExecutionFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [startPageOrTime, setStartPageOrTime] = useState<string>(
    plan.planned_start_page_or_time?.toString() || ""
  );
  const [endPageOrTime, setEndPageOrTime] = useState<string>(
    plan.planned_end_page_or_time?.toString() || ""
  );
  const [memo, setMemo] = useState("");

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const result = await startPlan(plan.id);
      if (result.success) {
        // 집중 타이머 페이지로 이동
        router.push("/focus");
      } else {
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!startPageOrTime || !endPageOrTime) {
      alert("시작과 종료 값을 입력해주세요.");
      return;
    }

    const start = Number(startPageOrTime);
    const end = Number(endPageOrTime);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      alert("올바른 값을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await completePlan(plan.id, {
        startPageOrTime: start,
        endPageOrTime: end,
        memo: memo || null,
      });

      if (result.success) {
        router.push("/today");
        router.refresh();
      } else {
        alert(result.error || "플랜 완료에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostpone = async () => {
    if (!confirm("이 플랜을 내일로 미루시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await postponePlan(plan.id);
      if (result.success) {
        router.push("/today");
        router.refresh();
      } else {
        alert(result.error || "플랜 미루기에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">학습 기록</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              시작 {unitLabel}
            </label>
            <input
              type="number"
              value={startPageOrTime}
              onChange={(e) => setStartPageOrTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="시작 값을 입력하세요"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              종료 {unitLabel}
            </label>
            <input
              type="number"
              value={endPageOrTime}
              onChange={(e) => setEndPageOrTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="종료 값을 입력하세요"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="학습 메모를 입력하세요"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!activeSession && (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            시작하기
          </button>
        )}
        {activeSession && (
          <button
            onClick={() => router.push("/focus")}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            집중 타이머로 이동
          </button>
        )}
        <button
          onClick={handleComplete}
          disabled={isLoading || !startPageOrTime || !endPageOrTime}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          완료하기
        </button>
        {plan.is_reschedulable && (
          <button
            onClick={handlePostpone}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            오늘 일정 미루기
          </button>
        )}
      </div>
    </div>
  );
}

