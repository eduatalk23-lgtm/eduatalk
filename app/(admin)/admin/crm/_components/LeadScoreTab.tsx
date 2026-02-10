"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
  divideDefaultVar,
} from "@/lib/utils/darkMode";
import { adjustLeadScore } from "@/lib/domains/crm/actions/scoring";
import type {
  SalesLeadWithRelations,
  LeadScoreLog,
  ScoreType,
  QualityLevel,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";
import { QualityBadge } from "./QualityBadge";

type LeadScoreTabProps = {
  lead: SalesLeadWithRelations;
  scoreLogs: CrmPaginatedResult<LeadScoreLog>;
};

export function LeadScoreTab({ lead, scoreLogs }: LeadScoreTabProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [scoreType, setScoreType] = useState<ScoreType>("fit");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const totalScore = (lead.fit_score ?? 0) + (lead.engagement_score ?? 0);

  const inputClass = cn(
    "rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handleAdjust = () => {
    const deltaNum = parseInt(delta, 10);
    if (isNaN(deltaNum) || deltaNum === 0) {
      showError("유효한 변동값을 입력해주세요.");
      return;
    }
    if (!reason.trim()) {
      showError("사유를 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await adjustLeadScore(
        lead.id,
        scoreType,
        deltaNum,
        reason.trim()
      );
      if (result.success) {
        showSuccess("스코어가 조정되었습니다.");
        setDelta("");
        setReason("");
      } else {
        showError(result.error ?? "스코어 조정에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 현재 점수 */}
      <div
        className={cn(
          "rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <h3 className={cn("text-sm font-semibold mb-3", textPrimaryVar)}>
          현재 스코어
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textSecondaryVar)}>적합도</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${lead.fit_score ?? 0}%` }}
                />
              </div>
              <span className={cn("text-sm font-semibold", textPrimaryVar)}>
                {lead.fit_score ?? 0}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textSecondaryVar)}>참여도</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${lead.engagement_score ?? 0}%` }}
                />
              </div>
              <span className={cn("text-sm font-semibold", textPrimaryVar)}>
                {lead.engagement_score ?? 0}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textSecondaryVar)}>종합 점수</span>
            <span className={cn("text-h2", textPrimaryVar)}>{totalScore}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={cn("text-xs", textSecondaryVar)}>품질</span>
            <QualityBadge level={lead.quality_level as QualityLevel | null} />
          </div>
        </div>
      </div>

      {/* 수동 조정 */}
      <div
        className={cn(
          "rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <h3 className={cn("text-sm font-semibold mb-3", textPrimaryVar)}>
          수동 점수 조정
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className={cn("text-xs", textSecondary)}>유형</label>
            <select
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value as ScoreType)}
              className={inputClass}
            >
              <option value="fit">적합도</option>
              <option value="engagement">참여도</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={cn("text-xs", textSecondary)}>변동값</label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className={cn(inputClass, "w-24")}
              placeholder="+10 / -5"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className={cn("text-xs", textSecondary)}>사유</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              placeholder="조정 사유를 입력하세요"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdjust}
            isLoading={isPending}
          >
            조정
          </Button>
        </div>
      </div>

      {/* 변동 이력 */}
      {scoreLogs.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <table className="w-full">
            <thead className={getGrayBgClasses("tableHeader")}>
              <tr>
                <th className={tableHeaderBase}>일시</th>
                <th className={tableHeaderBase}>유형</th>
                <th className={tableHeaderBase}>변동</th>
                <th className={tableHeaderBase}>이전</th>
                <th className={tableHeaderBase}>이후</th>
                <th className={tableHeaderBase}>사유</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
              {scoreLogs.items.map((log) => (
                <tr key={log.id} className={tableRowBase}>
                  <td className={cn(tableCellBase, textSecondary)}>
                    {new Date(log.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className={tableCellBase}>
                    <span className={cn("text-xs font-medium", textPrimary)}>
                      {log.score_type === "fit" ? "적합도" : "참여도"}
                    </span>
                  </td>
                  <td className={tableCellBase}>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        log.delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </span>
                  </td>
                  <td className={cn(tableCellBase, textSecondary)}>
                    {log.previous_score}
                  </td>
                  <td className={cn(tableCellBase, textPrimary)}>
                    {log.new_score}
                  </td>
                  <td className={cn(tableCellBase, textSecondary)}>
                    {log.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
