"use client";

import { useState, useMemo } from "react";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";

type InternalSubjectTableProps = {
  scores: InternalScoreWithRelations[];
  ranking: Array<{
    subject_id: string;
    subject_name: string;
    subject_group_name: string;
    average_grade: number;
    count: number;
  }>;
};

type SortKey = "subject_name" | "average_grade" | "count";
type SortOrder = "asc" | "desc";

export default function InternalSubjectTable({
  scores,
  ranking,
}: InternalSubjectTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("average_grade");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // 정렬된 데이터
  const sortedRanking = useMemo(() => {
    return [...ranking].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "subject_name") {
        comparison = a.subject_name.localeCompare(b.subject_name);
      } else if (sortKey === "average_grade") {
        comparison = a.average_grade - b.average_grade;
      } else if (sortKey === "count") {
        comparison = a.count - b.count;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [ranking, sortKey, sortOrder]);

  // 정렬 토글
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  if (ranking.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">과목별 성적 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              순위
            </th>
            <th
              className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleSort("subject_name")}
            >
              과목명 {sortKey === "subject_name" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              교과군
            </th>
            <th
              className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleSort("average_grade")}
            >
              평균 등급 {sortKey === "average_grade" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleSort("count")}
            >
              시험 횟수 {sortKey === "count" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRanking.map((subject, index) => (
            <tr key={subject.subject_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">
                {index + 1}
              </td>
              <td className="px-4 py-3 text-gray-900">
                {subject.subject_name}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {subject.subject_group_name}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    subject.average_grade <= 2
                      ? "bg-green-100 text-green-800"
                      : subject.average_grade <= 4
                      ? "bg-blue-100 text-blue-800"
                      : subject.average_grade <= 6
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {subject.average_grade.toFixed(1)}등급
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {subject.count}회
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

