"use client";

import { Plus } from "lucide-react";

type SchoolTypeTabsProps = {
  selectedType: "중학교" | "고등학교" | "대학교";
  onTypeChange: (type: "중학교" | "고등학교" | "대학교") => void;
  onCreateClick: () => void;
};

export default function SchoolTypeTabs({
  selectedType,
  onTypeChange,
  onCreateClick,
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
        <button
          onClick={onCreateClick}
          className="ml-auto flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
        >
          <Plus className="h-4 w-4" />
          학교 등록
        </button>
      </nav>
    </div>
  );
}









