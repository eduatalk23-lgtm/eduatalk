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
  relatedPlans: Plan[];
};

export function PlanExecutionForm({
  plan,
  content,
  activeSession,
  unitLabel,
  relatedPlans,
}: PlanExecutionFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
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

    setIsCompleting(true);
    setIsLoading(true);
    try {
      const result = await completePlan(plan.id, {
        startPageOrTime: start,
        endPageOrTime: end,
        memo: memo || null,
      });

      if (result.success) {
        const params = new URLSearchParams();
        if (plan.plan_date) {
          params.set("date", plan.plan_date);
        }
        const query = params.toString();
        router.push(query ? `/today?${query}` : "/today");
        router.refresh();
      } else {
        alert(result.error || "플랜 완료에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsCompleting(false);
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
        const params = new URLSearchParams();
        if (plan.plan_date) {
          params.set("date", plan.plan_date);
        }
        const query = params.toString();
        router.push(query ? `/today?${query}` : "/today");
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
      {!plan.actual_end_time && !isCompleting && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">타이머 · 일정 제어</h2>
              <p className="text-sm text-gray-500">타이머를 다시 실행하거나 일정 조정이 필요할 때 사용하세요.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!activeSession && (
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  타이머 다시 실행
                </button>
              )}
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
        </div>
      )}

      {!plan.actual_end_time && !isCompleting && relatedPlans.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">연결된 학습 블록</h3>
              <p className="text-sm text-gray-500">같은 플랜 번호로 묶인 블록들을 한눈에 확인하세요.</p>
            </div>
            <div className="flex flex-col gap-2">
              {relatedPlans.map((relatedPlan) => {
                const isCurrent = relatedPlan.id === plan.id;
                return (
                  <div
                    key={relatedPlan.id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">
                        블록 #{relatedPlan.sequence ?? relatedPlan.block_index ?? 0}
                      </span>
                      <span className="text-xs text-gray-500">
                        {relatedPlan.planned_start_page_or_time ?? "-"} ~{" "}
                        {relatedPlan.planned_end_page_or_time ?? "-"} {unitLabel}
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                        현재 블록
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500">
                        {relatedPlan.actual_end_time ? "완료됨" : relatedPlan.actual_start_time ? "진행 중" : "대기"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isCompleting && (
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50 p-4 text-center text-sm font-semibold text-indigo-700">
          완료 데이터를 정리하고 있어요...
        </div>
      )}

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
        <button
          onClick={handleComplete}
          disabled={isLoading || !startPageOrTime || !endPageOrTime}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          확인 완료
        </button>
      </div>
    </div>
  );
}

