"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getChartColor } from "@/lib/constants/colors";

type Student = {
  id: string;
  name: string;
  grade: string | null;
  studyTimeMinutes: number;
  planCompletionRate: number;
};

type ComparePageClientProps = {
  students: Student[];
};

export function ComparePageClient({ students }: ComparePageClientProps) {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectedData = students.filter((s) => selectedStudents.includes(s.id));

  const chartData = selectedData.map((student) => ({
    name: student.name,
    학습시간: student.studyTimeMinutes,
    플랜실행률: student.planCompletionRate,
  }));

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">학생 비교 분석</h1>
        <p className="mt-2 text-sm text-gray-600">
          여러 학생의 학습 데이터를 비교하여 분석할 수 있습니다.
        </p>
      </div>

      {/* 학생 선택 */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">학생 선택</h2>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">비교할 학생이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => toggleStudent(student.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedStudents.includes(student.id)
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {student.name}
                {student.grade && ` (${student.grade}학년)`}
              </button>
            ))}
          </div>
        )}
        {selectedStudents.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setSelectedStudents([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              전체 해제
            </button>
          </div>
        )}
      </div>

      {/* 비교 차트 */}
      {selectedData.length > 0 ? (
        <div className="space-y-6">
          {/* 학습시간 비교 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">이번주 학습시간 비교</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="학습시간" fill={getChartColor(0)} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 플랜 실행률 비교 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">이번주 플랜 실행률 비교</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="플랜실행률" fill={getChartColor(4)} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 비교 테이블 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">상세 비교</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      이름
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      학습시간 (분)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      플랜 실행률 (%)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedData.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {student.studyTimeMinutes}분
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {student.planCompletionRate}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">비교할 학생을 선택해주세요.</p>
        </div>
      )}
    </div>
  );
}

