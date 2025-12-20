"use client";

import { Plus } from "lucide-react";

type SchoolTypeTabsProps = {
  selectedType: "중학교" | "고등학교" | "대학교";
  onTypeChange: (type: "중학교" | "고등학교" | "대학교") => void;
};

/**
 * 학교 타입 탭 컴포넌트 (Read-Only)
 * 
 * 학교 데이터는 외부 데이터 기반으로 읽기 전용입니다.
 * 학교 등록 기능은 제거되었습니다.
 */
export default function SchoolTypeTabs({
  selectedType,
  onTypeChange,
}: SchoolTypeTabsProps) {
  const types: Array<"중학교" | "고등학교" | "대학교"> = [
    "중학교",
    "고등학교",
    "대학교",
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
              selectedType === type
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {type}
          </button>
        ))}
      </nav>
    </div>
  );
}









