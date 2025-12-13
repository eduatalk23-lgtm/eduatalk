"use client";

type AttendanceFiltersProps = {
  startDateFilter?: string;
  endDateFilter?: string;
  statusFilter?: string;
};

export function AttendanceFilters({
  startDateFilter,
  endDateFilter,
  statusFilter,
}: AttendanceFiltersProps) {
  return (
    <form method="get" className="flex flex-col gap-4 md:flex-row">
      <input
        type="date"
        name="start_date"
        placeholder="시작 날짜"
        defaultValue={startDateFilter}
        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <input
        type="date"
        name="end_date"
        placeholder="종료 날짜"
        defaultValue={endDateFilter}
        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <select
        name="status"
        defaultValue={statusFilter}
        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">전체 상태</option>
        <option value="present">출석</option>
        <option value="absent">결석</option>
        <option value="late">지각</option>
        <option value="early_leave">조퇴</option>
        <option value="excused">공결</option>
      </select>
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        검색
      </button>
      {(startDateFilter || endDateFilter || statusFilter) && (
        <a
          href="/admin/attendance"
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          초기화
        </a>
      )}
    </form>
  );
}

