"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
  borderInput,
} from "@/lib/utils/darkMode";
import {
  getRevenueSummaryAction,
  getMonthlyRevenueAction,
  getProgramRevenueAction,
  getProgramsForFilterAction,
  exportRevenueCSVAction,
} from "@/lib/domains/revenue/actions/reports";
import type {
  RevenueSummary,
  MonthlyRevenue,
  ProgramRevenue,
} from "@/lib/domains/revenue/types";
import { MonthlyRevenueChart } from "./MonthlyRevenueChart";
import { ProgramRevenueChart } from "./ProgramRevenueChart";

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR");
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 5);
  const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  return { start: `${startMonth}-01`, end: `${endMonth}-31` };
}

export function RevenueReportClient() {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start.slice(0, 7));
  const [endDate, setEndDate] = useState(defaultRange.end.slice(0, 7));
  const [programId, setProgramId] = useState<string>("");

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [programRevenue, setProgramRevenue] = useState<ProgramRevenue[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(() => {
    const sDate = `${startDate}-01`;
    const eDate = `${endDate}-31`;

    startTransition(async () => {
      const [summaryRes, monthlyRes, programRes] = await Promise.all([
        getRevenueSummaryAction({
          startDate: sDate,
          endDate: eDate,
          programId: programId || undefined,
        }),
        getMonthlyRevenueAction(sDate, eDate, programId || undefined),
        getProgramRevenueAction(sDate, eDate),
      ]);

      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (monthlyRes.success && monthlyRes.data) setMonthly(monthlyRes.data);
      if (programRes.success && programRes.data)
        setProgramRevenue(programRes.data);
    });
  }, [startDate, endDate, programId]);

  // 프로그램 목록 초기 로드
  useEffect(() => {
    getProgramsForFilterAction().then((res) => {
      if (res.success && res.data) setPrograms(res.data);
    });
  }, []);

  // 필터 변경 시 데이터 로드
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    startTransition(async () => {
      const result = await exportRevenueCSVAction({
        startDate: `${startDate}-01`,
        endDate: `${endDate}-31`,
        programId: programId || undefined,
      });

      if (result.success && result.data) {
        const blob = new Blob([result.data], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `매출리포트_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.showSuccess("CSV 파일이 다운로드되었습니다.");
      } else {
        toast.showError(result.error ?? "CSV 내보내기에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 필터 */}
      <div
        className={cn(
          "flex flex-wrap items-end gap-4 rounded-xl border p-4",
          bgSurface,
          borderDefault
        )}
      >
        <div className="flex flex-col gap-1">
          <label className={cn("text-xs font-medium", textSecondary)}>
            시작월
          </label>
          <input
            type="month"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              borderInput,
              textPrimary,
              bgSurface
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={cn("text-xs font-medium", textSecondary)}>
            종료월
          </label>
          <input
            type="month"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              borderInput,
              textPrimary,
              bgSurface
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={cn("text-xs font-medium", textSecondary)}>
            프로그램
          </label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              borderInput,
              textPrimary,
              bgSurface
            )}
          >
            <option value="">전체</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isPending}>
          CSV 다운로드
        </Button>
      </div>

      {/* KPI 카드 */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="총 청구액"
            value={`₩${formatKRW(summary.total_billed)}`}
          />
          <StatCard
            label="총 수납액"
            value={`₩${formatKRW(summary.total_paid)}`}
            accent="green"
          />
          <StatCard
            label="미수금"
            value={`₩${formatKRW(summary.total_unpaid)}`}
            accent={summary.total_unpaid > 0 ? "red" : undefined}
          />
          <StatCard
            label="수납률"
            value={`${summary.collection_rate}%`}
            accent={summary.collection_rate >= 80 ? "green" : summary.collection_rate >= 50 ? undefined : "red"}
          />
        </div>
      )}

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 월별 매출 막대차트 */}
        <div
          className={cn(
            "rounded-xl border p-5",
            bgSurface,
            borderDefault
          )}
        >
          <h3 className={cn("pb-4 text-base font-semibold", textPrimary)}>
            월별 매출 추이
          </h3>
          <MonthlyRevenueChart data={monthly} />
        </div>

        {/* 프로그램별 파이차트 */}
        <div
          className={cn(
            "rounded-xl border p-5",
            bgSurface,
            borderDefault
          )}
        >
          <h3 className={cn("pb-4 text-base font-semibold", textPrimary)}>
            프로그램별 매출 비율
          </h3>
          <ProgramRevenueChart data={programRevenue} />
        </div>
      </div>

      {/* 월별 상세 테이블 */}
      {monthly.length > 0 && (
        <div
          className={cn(
            "overflow-hidden rounded-xl border",
            bgSurface,
            borderDefault
          )}
        >
          <div className="px-5 py-4">
            <h3 className={cn("text-base font-semibold", textPrimary)}>
              월별 상세
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t bg-gray-50 dark:bg-gray-800/50">
                  <th
                    className={cn(
                      "px-5 py-2.5 text-left font-medium",
                      textSecondary
                    )}
                  >
                    월
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    청구액
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    수납액
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    미수금
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    수납률
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr
                    key={m.month}
                    className={cn("border-t", borderDefault)}
                  >
                    <td className={cn("px-5 py-2.5 font-medium", textPrimary)}>
                      {m.month}
                    </td>
                    <td className={cn("px-5 py-2.5 text-right", textPrimary)}>
                      ₩{formatKRW(m.billed)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-green-600 dark:text-green-400">
                      ₩{formatKRW(m.paid)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-2.5 text-right",
                        m.unpaid > 0
                          ? "text-red-600 dark:text-red-400"
                          : textPrimary
                      )}
                    >
                      ₩{formatKRW(m.unpaid)}
                    </td>
                    <td className={cn("px-5 py-2.5 text-right", textPrimary)}>
                      {m.rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 프로그램별 상세 테이블 */}
      {programRevenue.length > 0 && (
        <div
          className={cn(
            "overflow-hidden rounded-xl border",
            bgSurface,
            borderDefault
          )}
        >
          <div className="px-5 py-4">
            <h3 className={cn("text-base font-semibold", textPrimary)}>
              프로그램별 상세
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t bg-gray-50 dark:bg-gray-800/50">
                  <th
                    className={cn(
                      "px-5 py-2.5 text-left font-medium",
                      textSecondary
                    )}
                  >
                    프로그램
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    청구액
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    수납액
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    수강건수
                  </th>
                  <th
                    className={cn(
                      "px-5 py-2.5 text-right font-medium",
                      textSecondary
                    )}
                  >
                    비율
                  </th>
                </tr>
              </thead>
              <tbody>
                {programRevenue.map((p) => (
                  <tr
                    key={p.program_id}
                    className={cn("border-t", borderDefault)}
                  >
                    <td className={cn("px-5 py-2.5 font-medium", textPrimary)}>
                      {p.program_name}
                    </td>
                    <td className={cn("px-5 py-2.5 text-right", textPrimary)}>
                      ₩{formatKRW(p.total_billed)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-green-600 dark:text-green-400">
                      ₩{formatKRW(p.total_paid)}
                    </td>
                    <td className={cn("px-5 py-2.5 text-right", textPrimary)}>
                      {p.enrollment_count}건
                    </td>
                    <td className={cn("px-5 py-2.5 text-right", textPrimary)}>
                      {p.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 로딩 */}
      {isPending && (
        <div className={cn("py-8 text-center text-sm", textSecondary)}>
          데이터를 불러오는 중...
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4",
        bgSurface,
        borderDefault
      )}
    >
      <p className={cn("text-xs font-medium", textSecondary)}>{label}</p>
      <p
        className={cn(
          "pt-1 text-xl font-bold",
          accent === "green"
            ? "text-green-600 dark:text-green-400"
            : accent === "red"
              ? "text-red-600 dark:text-red-400"
              : textPrimary
        )}
      >
        {value}
      </p>
    </div>
  );
}
