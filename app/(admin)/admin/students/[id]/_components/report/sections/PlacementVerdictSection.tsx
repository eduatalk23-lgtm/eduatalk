"use client";

import { Target } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from "@/lib/domains/admission";
import type { PlacementLevel, PlacementAnalysisResult } from "@/lib/domains/admission";

interface Props {
  /** 가장 최근 배치 분석 스냅샷 결과 */
  result: PlacementAnalysisResult;
  /** 분석에 사용된 시험 일자 (ISO) */
  examDate?: string | null;
  /** 시험 유형 (가채점/실채점/파이프라인 자동) */
  examType?: string | null;
}

const ALL_LEVELS: PlacementLevel[] = ["safe", "possible", "bold", "unstable", "danger"];

/** 레벨별 진한 색상 (게이지 바용) */
const LEVEL_BAR_COLORS: Record<PlacementLevel, string> = {
  safe: "bg-emerald-500",
  possible: "bg-blue-500",
  bold: "bg-amber-500",
  unstable: "bg-orange-500",
  danger: "bg-red-500",
};

const EXAM_TYPE_LABEL: Record<string, string> = {
  estimated: "가채점",
  actual: "실채점",
  pipeline_auto: "파이프라인 자동",
};

/**
 * 정시 5단계 배치 결과를 리포트용으로 표시.
 *
 * - 상단: 5색 게이지 바 + 요약 범례
 * - 본문: 레벨별 그룹화된 학과 카드 (레벨당 상위 5개)
 *
 * 대화형 필터는 제외 (리포트는 정적 출력이 목적).
 */
export function PlacementVerdictSection({ result, examDate, examType }: Props) {
  const total = result.verdicts.length;

  if (total === 0) {
    return (
      <div>
        <ReportSectionHeader
          icon={Target}
          title="정시 합격 예측"
          subtitle="배치 분석 결과 없음"
        />
        <p className="text-sm text-gray-500">
          분석 가능한 학과가 없습니다. 모의고사 점수를 입력하면 자동으로 계산됩니다.
        </p>
      </div>
    );
  }

  const grouped = ALL_LEVELS.reduce(
    (acc, level) => {
      acc[level] = result.verdicts.filter((v) => v.level === level);
      return acc;
    },
    {} as Record<PlacementLevel, typeof result.verdicts>,
  );

  const subtitleParts: string[] = [];
  if (examDate) subtitleParts.push(`${examDate} 시험 기준`);
  if (examType && EXAM_TYPE_LABEL[examType]) subtitleParts.push(EXAM_TYPE_LABEL[examType]);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "최신 모의고사 기준";

  return (
    <div>
      <ReportSectionHeader icon={Target} title="정시 합격 예측" subtitle={subtitle} />

      {/* 요약 헤더 */}
      <div className="mb-3 flex items-center gap-3 text-sm text-gray-600">
        <span>총 {result.summary.total}개 학과 분석</span>
        {result.summary.disqualified > 0 && (
          <span className="text-red-600">결격 {result.summary.disqualified}개</span>
        )}
      </div>

      {/* 5색 게이지 바 */}
      <div className="mb-2 flex h-4 overflow-hidden rounded-full border border-gray-200">
        {ALL_LEVELS.map((level) => {
          const count = result.summary.byLevel[level];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={level}
              className={cn(LEVEL_BAR_COLORS[level], "transition-all")}
              style={{ width: `${pct}%` }}
              title={`${PLACEMENT_LABELS[level]}: ${count}개 (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mb-6 flex flex-wrap gap-3 text-xs">
        {ALL_LEVELS.map((level) => {
          const count = result.summary.byLevel[level];
          if (count === 0) return null;
          return (
            <span key={level} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-full", LEVEL_BAR_COLORS[level])} />
              <span className="text-gray-700">
                {PLACEMENT_LABELS[level]}{" "}
                <span className="font-semibold">{count}</span>
              </span>
            </span>
          );
        })}
      </div>

      {/* 레벨별 그룹 (각 레벨 상위 5개) */}
      <div className="space-y-4">
        {ALL_LEVELS.map((level) => {
          const verdicts = grouped[level];
          if (verdicts.length === 0) return null;
          const colors = PLACEMENT_COLORS[level];
          const topVerdicts = verdicts.slice(0, 5);
          const hasMore = verdicts.length > 5;

          return (
            <div key={level}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    colors.bg,
                    colors.text,
                  )}
                >
                  {PLACEMENT_LABELS[level]}
                </span>
                <span className="text-xs text-gray-500">
                  {verdicts.length}개{hasMore && " (상위 5개)"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {topVerdicts.map((v, idx) => (
                  <VerdictCard key={`${v.universityName}-${v.departmentName}-${idx}`} verdict={v} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VerdictCardProps {
  verdict: PlacementAnalysisResult["verdicts"][number];
}

function VerdictCard({ verdict }: VerdictCardProps) {
  const { universityName, departmentName, studentScore, admissionAvg, scoreDiff, region } = verdict;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-xs font-medium text-gray-900">{universityName}</p>
      <p className="text-xs text-gray-600">{departmentName}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
        {region && <span>{region}</span>}
        <span>
          내 {studentScore.toFixed(1)}
          {admissionAvg != null && ` / 입결 ${admissionAvg.toFixed(1)}`}
        </span>
        {scoreDiff != null && (
          <span
            className={cn(
              "font-semibold",
              scoreDiff >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            ({scoreDiff >= 0 ? "+" : ""}
            {scoreDiff.toFixed(1)})
          </span>
        )}
      </div>
    </div>
  );
}
