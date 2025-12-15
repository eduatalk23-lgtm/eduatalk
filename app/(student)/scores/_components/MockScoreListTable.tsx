"use client";

import Link from "next/link";
import { useState, useMemo, memo } from "react";
import { getGradeColor } from "@/lib/constants/colors";
import { Card } from "@/components/molecules/Card";
import { Badge } from "@/components/atoms";
import { cn } from "@/lib/cn";
import {
  inlineButtonBase,
  tableRowBase,
  divideDefault,
  textSecondary,
  textPrimary,
  textTertiary,
  textMuted,
  bgSurface,
  borderDefault,
  borderInput,
  bgStyles,
  bgHover,
  tableHeaderBase,
} from "@/lib/utils/darkMode";

type MockScoreRow = {
  id: string;
  grade: number;
  subject_group: string;
  exam_type: string;
  subject_name: string | null;
  raw_score: number | null;
  percentile: number | null;
  grade_score: number | null;
  exam_round: string | null;
  created_at: string | null;
};

type MockScoreListTableProps = {
  scores: MockScoreRow[];
  grade: string;
  subjectGroup: string;
  examType: string;
  DeleteButton: React.ComponentType<{ id: string }>;
};

type SortField = "grade" | "exam_round" | "grade_score" | "raw_score" | "percentile";
type SortOrder = "asc" | "desc";

function MockScoreListTableComponent({
  scores,
  grade,
  subjectGroup,
  examType,
  DeleteButton,
}: MockScoreListTableProps) {
  const [sortField, setSortField] = useState<SortField>("grade");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterRound, setFilterRound] = useState<string>("all");

  // 필터링 및 정렬
  const filteredAndSortedScores = useMemo(() => {
    let filtered = [...scores];

    // 회차 필터링
    if (filterRound !== "all") {
      filtered = filtered.filter((score) => score.exam_round === filterRound);
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue: number | string | null = null;
      let bValue: number | string | null = null;

      switch (sortField) {
        case "grade":
          aValue = a.grade ?? 0;
          bValue = b.grade ?? 0;
          break;
        case "exam_round":
          aValue = a.exam_round ?? "";
          bValue = b.exam_round ?? "";
          break;
        case "grade_score":
          aValue = a.grade_score ?? 999;
          bValue = b.grade_score ?? 999;
          break;
        case "raw_score":
          aValue = a.raw_score ?? 0;
          bValue = b.raw_score ?? 0;
          break;
        case "percentile":
          aValue = a.percentile ?? 0;
          bValue = b.percentile ?? 0;
          break;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [scores, sortField, sortOrder, filterRound]);

  // 고유한 회차 목록
  const examRounds = useMemo(() => {
    const rounds = new Set<string>();
    scores.forEach((score) => {
      if (score.exam_round) rounds.add(score.exam_round);
    });
    return Array.from(rounds).sort();
  }, [scores]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className={textMuted}>↕</span>;
    }
    return sortOrder === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 및 정렬 컨트롤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className={cn("text-sm font-medium", textSecondary)}>회차:</label>
          <select
            value={filterRound}
            onChange={(e) => setFilterRound(e.target.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              borderInput,
              bgSurface,
              textPrimary
            )}
          >
            <option value="all">전체</option>
            {examRounds.map((round) => (
              <option key={round} value={round}>
                {round}
              </option>
            ))}
          </select>
        </div>
        <div className={cn("flex items-center gap-2 text-sm", textTertiary)}>
          <span>정렬:</span>
          <button
            onClick={() => handleSort("grade")}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              sortField === "grade"
                ? cn("font-medium", bgStyles.gray)
                : bgHover
            )}
          >
            학년 <SortIcon field="grade" />
          </button>
          <button
            onClick={() => handleSort("exam_round")}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              sortField === "exam_round"
                ? cn("font-medium", bgStyles.gray)
                : bgHover
            )}
          >
            회차 <SortIcon field="exam_round" />
          </button>
          <button
            onClick={() => handleSort("grade_score")}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              sortField === "grade_score"
                ? cn("font-medium", bgStyles.gray)
                : bgHover
            )}
          >
            등급 <SortIcon field="grade_score" />
          </button>
          <button
            onClick={() => handleSort("percentile")}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              sortField === "percentile"
                ? cn("font-medium", bgStyles.gray)
                : bgHover
            )}
          >
            백분위 <SortIcon field="percentile" />
          </button>
        </div>
      </div>

      {/* 데스크톱 테이블 뷰 */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={bgStyles.gray}>
              <tr>
                <th className={cn(tableHeaderBase, "px-4")}>
                  세부 과목명
                </th>
                <th className={cn(tableHeaderBase, "px-4")}>
                  회차
                </th>
                <th className={cn(tableHeaderBase, "px-4")}>
                  <button
                    onClick={() => handleSort("raw_score")}
                    className={cn("flex items-center gap-1", "hover:text-primary")}
                  >
                    원점수 <SortIcon field="raw_score" />
                  </button>
                </th>
                <th className={cn(tableHeaderBase, "px-4")}>
                  <button
                    onClick={() => handleSort("percentile")}
                    className={cn("flex items-center gap-1", "hover:text-primary")}
                  >
                    백분위 <SortIcon field="percentile" />
                  </button>
                </th>
                <th className={cn(tableHeaderBase, "px-4")}>
                  <button
                    onClick={() => handleSort("grade_score")}
                    className={cn("flex items-center gap-1", "hover:text-primary")}
                  >
                    등급 <SortIcon field="grade_score" />
                  </button>
                </th>
                <th className={cn(tableHeaderBase, "px-4")}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody className={divideDefault}>
              {filteredAndSortedScores.map((score) => {
                const gradeColor = getGradeColor(score.grade_score);
                return (
                  <tr key={score.id} className={tableRowBase}>
                    <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                      {score.subject_name || "-"}
                    </td>
                    <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                      {score.exam_round || "-"}
                    </td>
                    <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                      {score.raw_score !== null ? score.raw_score : "-"}
                    </td>
                    <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                      {score.percentile !== null ? `${score.percentile}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {score.grade_score !== null ? (
                        <Badge
                          className={gradeColor.badge}
                          size="xs"
                        >
                          {score.grade_score}등급
                        </Badge>
                      ) : (
                        <span className={textMuted}>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/scores/mock/${grade}/${encodeURIComponent(subjectGroup)}/${encodeURIComponent(examType)}/${score.id}/edit`}
                          className={inlineButtonBase("px-3 py-1.5 text-xs font-semibold")}
                        >
                          수정
                        </Link>
                        <DeleteButton id={score.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 모바일 카드 뷰 */}
      <div className="flex flex-col gap-3 md:hidden">
        {filteredAndSortedScores.map((score) => {
          const gradeColor = getGradeColor(score.grade_score);
          return (
            <Card key={score.id} hover>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", textPrimary)}>
                        {score.subject_name || "-"}
                      </span>
                      {score.exam_round && (
                        <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                          {score.exam_round}
                        </span>
                      )}
                    </div>
                  </div>
                  {score.grade_score !== null && (
                    <Badge
                      className={gradeColor.badge}
                      size="sm"
                    >
                      {score.grade_score}등급
                    </Badge>
                  )}
                </div>

                <div className={cn("grid grid-cols-2 gap-3 border-t pt-3", borderDefault)}>
                  <div>
                    <p className={cn("text-xs", textMuted)}>원점수</p>
                    <p className={cn("text-sm font-medium", textPrimary)}>
                      {score.raw_score !== null ? score.raw_score : "-"}
                    </p>
                  </div>
                  <div>
                    <p className={cn("text-xs", textMuted)}>백분위</p>
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      {score.percentile !== null ? `${score.percentile}%` : "-"}
                    </p>
                  </div>
                </div>

                <div className={cn("flex gap-2 border-t pt-3", borderDefault)}>
                  <Link
                    href={`/scores/mock/${grade}/${encodeURIComponent(subjectGroup)}/${encodeURIComponent(examType)}/${score.id}/edit`}
                    className={cn(
                      "flex-1 rounded-lg border px-4 py-2 text-center text-sm font-semibold transition",
                      borderInput,
                      bgSurface,
                      textSecondary,
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    수정
                  </Link>
                  <div className="flex-1">
                    <DeleteButton id={score.id} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredAndSortedScores.length === 0 && (
        <Card>
          <div className="p-8 text-center">
            <p className={cn("text-sm", textMuted)}>
              {filterRound !== "all"
                ? "해당 조건에 맞는 성적이 없습니다."
                : "등록된 성적이 없습니다."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export const MockScoreListTable = memo(MockScoreListTableComponent, (prevProps, nextProps) => {
  // scores 배열의 길이와 주요 속성 비교
  if (prevProps.scores.length !== nextProps.scores.length) {
    return false;
  }
  
  // scores 배열의 각 항목 비교 (id와 주요 속성만)
  for (let i = 0; i < prevProps.scores.length; i++) {
    const prev = prevProps.scores[i];
    const next = nextProps.scores[i];
    if (
      prev.id !== next.id ||
      prev.grade !== next.grade ||
      prev.raw_score !== next.raw_score ||
      prev.grade_score !== next.grade_score ||
      prev.percentile !== next.percentile
    ) {
      return false;
    }
  }
  
  return (
    prevProps.grade === nextProps.grade &&
    prevProps.subjectGroup === nextProps.subjectGroup &&
    prevProps.examType === nextProps.examType &&
    prevProps.DeleteButton === nextProps.DeleteButton
  );
});

