"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { getGradeColor } from "@/lib/scores/gradeColors";
import { Card } from "@/components/ui/Card";

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

export function MockScoreListTable({
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
      return <span className="text-gray-400">↕</span>;
    }
    return sortOrder === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 및 정렬 컨트롤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-700">회차:</label>
          <select
            value={filterRound}
            onChange={(e) => setFilterRound(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">전체</option>
            {examRounds.map((round) => (
              <option key={round} value={round}>
                {round}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>정렬:</span>
          <button
            onClick={() => handleSort("grade")}
            className={`rounded px-2 py-1 text-xs transition hover:bg-gray-100 ${
              sortField === "grade" ? "bg-gray-100 font-medium" : ""
            }`}
          >
            학년 <SortIcon field="grade" />
          </button>
          <button
            onClick={() => handleSort("exam_round")}
            className={`rounded px-2 py-1 text-xs transition hover:bg-gray-100 ${
              sortField === "exam_round" ? "bg-gray-100 font-medium" : ""
            }`}
          >
            회차 <SortIcon field="exam_round" />
          </button>
          <button
            onClick={() => handleSort("grade_score")}
            className={`rounded px-2 py-1 text-xs transition hover:bg-gray-100 ${
              sortField === "grade_score" ? "bg-gray-100 font-medium" : ""
            }`}
          >
            등급 <SortIcon field="grade_score" />
          </button>
          <button
            onClick={() => handleSort("percentile")}
            className={`rounded px-2 py-1 text-xs transition hover:bg-gray-100 ${
              sortField === "percentile" ? "bg-gray-100 font-medium" : ""
            }`}
          >
            백분위 <SortIcon field="percentile" />
          </button>
        </div>
      </div>

      {/* 데스크톱 테이블 뷰 */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  세부 과목명
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  회차
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort("raw_score")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    원점수 <SortIcon field="raw_score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort("percentile")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    백분위 <SortIcon field="percentile" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort("grade_score")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    등급 <SortIcon field="grade_score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedScores.map((score) => {
                const gradeColor = getGradeColor(score.grade_score);
                return (
                  <tr key={score.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {score.subject_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {score.exam_round || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {score.raw_score !== null ? score.raw_score : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {score.percentile !== null ? `${score.percentile}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {score.grade_score !== null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${gradeColor.badge}`}
                        >
                          {score.grade_score}등급
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/scores/mock/${grade}/${encodeURIComponent(subjectGroup)}/${encodeURIComponent(examType)}/${score.id}/edit`}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
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
                      <span className="text-sm font-semibold text-gray-900">
                        {score.subject_name || "-"}
                      </span>
                      {score.exam_round && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                          {score.exam_round}
                        </span>
                      )}
                    </div>
                  </div>
                  {score.grade_score !== null && (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${gradeColor.badge}`}
                    >
                      {score.grade_score}등급
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-xs text-gray-500">원점수</p>
                    <p className="text-sm font-medium text-gray-900">
                      {score.raw_score !== null ? score.raw_score : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">백분위</p>
                    <p className="text-sm font-medium text-indigo-600">
                      {score.percentile !== null ? `${score.percentile}%` : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <Link
                    href={`/scores/mock/${grade}/${encodeURIComponent(subjectGroup)}/${encodeURIComponent(examType)}/${score.id}/edit`}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
            <p className="text-sm text-gray-500">
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

