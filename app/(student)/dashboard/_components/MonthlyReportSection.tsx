"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { MonthlyReport } from "@/lib/reports/monthly";
import { cn, textPrimary, textTertiary } from "@/lib/utils/darkMode";

type MonthlyReportSectionProps = {
  studentId: string;
  monthDate: Date;
};

export function MonthlyReportSection({
  studentId,
  monthDate,
}: MonthlyReportSectionProps) {
  const [data, setData] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // monthDate를 YYYY-MM-DD 형식으로 변환
        const monthDateStr = monthDate.toISOString().slice(0, 10);
        const response = await fetch(
          `/api/dashboard/monthly-report?monthDate=${monthDateStr}`
        );

        if (!response.ok) {
          throw new Error("월간 리포트 조회 실패");
        }

        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error?.message || "월간 리포트 조회 실패");
        }
      } catch (err) {
        console.error("[MonthlyReportSection] 로드 실패", err);
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId, monthDate]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className={cn("text-h2", textPrimary)}>이번 달 요약</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/report/monthly"
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              상세 리포트 보기 →
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-6 shadow-[var(--elevation-1)]">
          <div className="flex items-center justify-center py-8">
            <p className={cn("text-sm", textTertiary)}>월간 리포트 로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className={cn("text-h2", textPrimary)}>이번 달 요약</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/report/monthly"
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              상세 리포트 보기 →
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-6 shadow-[var(--elevation-1)]">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || "월간 리포트를 불러올 수 없습니다."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-h2", textPrimary)}>이번 달 요약</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/report/monthly"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            상세 리포트 보기 →
          </Link>
        </div>
      </div>
      <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiary)}>
              총 학습시간
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Math.floor(data.totals.studyMinutes / 60)}시간{" "}
              {data.totals.studyMinutes % 60}분
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiary)}>
              플랜 실행률
            </div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.totals.completionRate}%
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiary)}>
              목표 달성률
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.totals.goalRate}%
            </div>
          </div>
          <div className="text-center">
            <Link
              href="/report/monthly"
              className="inline-block rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-base hover:bg-indigo-700 dark:hover:bg-indigo-600"
            >
              월간 리포트 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

