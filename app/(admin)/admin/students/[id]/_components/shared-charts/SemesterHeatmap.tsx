"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { SemesterHeatmapData } from "@/lib/domains/student-record/chart-data";

const AREA_LABELS: Record<string, string> = {
  academic: "학업역량",
  career: "진로역량",
  community: "공동체역량",
};

const AREA_TEXT_CLASSES: Record<string, string> = {
  academic: "text-indigo-700",
  career: "text-purple-700",
  community: "text-emerald-700",
};

const AREA_BG_CLASSES: Record<string, string> = {
  academic: "bg-indigo-50",
  career: "bg-purple-50",
  community: "bg-emerald-50",
};

function heatCellColor(score: number | null, isDesign: boolean): string {
  if (score === null) return "bg-white";
  if (isDesign) return "bg-blue-50";
  if (score >= 4) return "bg-emerald-300";
  if (score >= 3) return "bg-emerald-100";
  if (score >= 2) return "bg-amber-100";
  if (score >= 1) return "bg-orange-100";
  if (score > 0) return "bg-red-100";
  return "bg-gray-200"; // score=0: 데이터 있으나 긍정 0건
}

function heatCellTextColor(score: number | null, isDesign: boolean): string {
  if (score === null) return "text-gray-300";
  if (isDesign) return "text-blue-500";
  if (score >= 4) return "text-emerald-900";
  if (score >= 3) return "text-emerald-700";
  if (score >= 2) return "text-amber-800";
  if (score >= 1) return "text-orange-800";
  if (score > 0) return "text-red-600";
  return "text-gray-500";
}

interface Props {
  data: SemesterHeatmapData;
  /** 설계 모드 학년 (해당 학기 셀에 점선 + 반투명 표시) */
  designGrades?: number[];
  className?: string;
}

export function SemesterHeatmap({ data, designGrades = [], className }: Props) {
  const areas = ["academic", "career", "community"] as const;
  const designGradeSet = new Set(designGrades);

  const isDesignSemester = (sem: string) => {
    const grade = Number(sem.split("-")[0]);
    return designGradeSet.has(grade);
  };

  return (
    <div className={cn("print-avoid-break", className)}>
      <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">학기별 역량 변화</h4>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "30%" }} />
            {data.semesters.map((sem) => (
              <col key={sem} style={{ width: `${70 / data.semesters.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="whitespace-nowrap border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-1.5 py-1 text-left text-xs font-medium">
                역량 항목
              </th>
              {data.semesters.map((sem) => (
                <th
                  key={sem}
                  className={cn(
                    "border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-1 py-1 text-center font-medium",
                    isDesignSemester(sem) && "border-dashed",
                  )}
                >
                  {sem}
                  {isDesignSemester(sem) && (
                    <span className="ml-0.5 text-xs text-blue-500">*</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => {
              const areaItems = data.items.filter((i) => i.area === area);
              return (
                <Fragment key={area}>
                  <tr>
                    <td
                      colSpan={data.semesters.length + 1}
                      className={cn(
                        "border border-[var(--border-primary)] px-2 py-0.5 text-xs font-semibold",
                        AREA_TEXT_CLASSES[area] ?? "text-gray-700",
                        AREA_BG_CLASSES[area] ?? "bg-gray-50",
                      )}
                    >
                      {AREA_LABELS[area]}
                    </td>
                  </tr>
                  {areaItems.map((item) => (
                    <tr key={item.code}>
                      <td className="whitespace-nowrap border border-[var(--border-primary)] px-1.5 py-1 text-left text-xs">
                        {item.label}
                      </td>
                      {data.semesters.map((sem) => {
                        const cell = item.cells[sem];
                        const isDesign = isDesignSemester(sem);
                        return (
                          <td
                            key={sem}
                            className={cn(
                              "border px-1 py-1 text-center tabular-nums",
                              isDesign ? "border-dashed border-blue-300" : "border-[var(--border-primary)]",
                              heatCellColor(cell?.score ?? null, isDesign),
                              heatCellTextColor(cell?.score ?? null, isDesign),
                            )}
                            title={cell ? `positive ${cell.positive}/${cell.total}` : "데이터 없음"}
                          >
                            {cell ? cell.score.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex gap-3 text-xs text-[var(--text-tertiary)]">
        <span>점수 = (긍정 태그 / 전체 태그) × 5</span>
        {designGrades.length > 0 && (
          <span className="text-blue-500">* 설계 모드 (예상)</span>
        )}
      </div>
    </div>
  );
}
