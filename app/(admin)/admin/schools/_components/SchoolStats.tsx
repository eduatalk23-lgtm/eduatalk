"use client";

import type { School } from "@/lib/data/schools";

type SchoolStatsProps = {
  schools: School[];
};

export default function SchoolStats({ schools }: SchoolStatsProps) {
  const stats = {
    total: schools.length,
    byType: {
      중학교: schools.filter((s) => s.type === "중학교").length,
      고등학교: schools.filter((s) => s.type === "고등학교").length,
      대학교: schools.filter((s) => s.type === "대학교").length,
    },
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">통계</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">전체 학교</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-indigo-600">
            {stats.byType.중학교}
          </div>
          <div className="text-sm text-gray-600">중학교</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-indigo-600">
            {stats.byType.고등학교}
          </div>
          <div className="text-sm text-gray-600">고등학교</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold text-indigo-600">
            {stats.byType.대학교}
          </div>
          <div className="text-sm text-gray-600">대학교</div>
        </div>
      </div>
    </div>
  );
}









