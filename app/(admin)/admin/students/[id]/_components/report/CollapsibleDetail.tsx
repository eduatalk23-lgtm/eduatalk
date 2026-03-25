"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleDetailProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleDetail({
  title,
  defaultOpen = false,
  children,
}: CollapsibleDetailProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-4">
      {/* 토글 버튼 — 인쇄 시 숨김 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 print:hidden"
      >
        <ChevronDown
          className={`h-4 w-4 text-indigo-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        <span className="report-caption font-semibold text-gray-700">{title}</span>
      </button>

      {/* 콘텐츠 — 화면: 접힘/펼침, 인쇄: 항상 표시 */}
      <div
        className={`overflow-hidden transition-all duration-300 print:!max-h-none print:!opacity-100 ${
          open ? "mt-3 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>

      {/* 인쇄 시 항상 표시 */}
      <div className="mt-3 hidden print:block">
        <p className="report-caption mb-2 font-semibold text-gray-600">{title}</p>
        {children}
      </div>
    </div>
  );
}
