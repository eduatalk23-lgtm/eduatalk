"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type FilterBarProps = {
  currentPlanPurpose?: string;
  currentSortOrder?: string;
};

const planPurposeOptions = [
  { value: "", label: "전체" },
  { value: "내신대비", label: "내신대비" },
  { value: "모의고사", label: "모의고사" },
  { value: "수능", label: "수능" },
  { value: "기타", label: "기타" },
];

export function FilterBar({ currentPlanPurpose, currentSortOrder = "desc" }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const createQueryString = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    return params.toString();
  };

  const handlePlanPurposeChange = (value: string) => {
    const queryString = createQueryString("planPurpose", value);
    router.push(`/plan${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <form className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">플랜 목적</span>
        <select
          name="planPurpose"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          value={currentPlanPurpose || ""}
          onChange={(e) => handlePlanPurposeChange(e.target.value)}
        >
          {planPurposeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">생성일 정렬</span>
        <div className="flex gap-2">
          <Link
            href={`/plan?${createQueryString("sortOrder", "desc")}`}
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:shadow-sm ${
              currentSortOrder === "desc"
                ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            최신순
          </Link>
          <Link
            href={`/plan?${createQueryString("sortOrder", "asc")}`}
            className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:shadow-sm ${
              currentSortOrder === "asc"
                ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
            }`}
          >
            오래된순
          </Link>
        </div>
      </div>
    </form>
  );
}

