"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { DeleteContentButton } from "./DeleteContentButton";

type TabKey = "books" | "lectures";

type ContentCardProps = {
  item: {
    id: string;
    title: string;
    master_content_id?: string | null;
    [key: string]: any;
  };
  activeTab: TabKey;
  onDelete: (id: string) => Promise<void>;
  detailRows: Array<{ label: string; value: string | number | null }>;
  subText: string;
  linkedBook?: { id: string; title: string } | null;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
};

export function ContentCard({
  item,
  activeTab,
  onDelete,
  detailRows,
  subText,
  linkedBook,
  isSelected = false,
  onSelect,
}: ContentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 중요 정보만 먼저 표시 (처음 3개)
  const primaryInfo = detailRows.slice(0, 3);
  const secondaryInfo = detailRows.slice(3);

  return (
    <li className={`rounded-lg border bg-white p-4 shadow-sm ${isSelected ? "ring-2 ring-indigo-500" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        {/* 체크박스 */}
        {onSelect && (
          <div className="flex items-start pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="flex-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-semibold text-gray-900">{item.title}</p>
              {item.master_content_id && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  📦 마스터에서 가져옴
                </span>
              )}
              {linkedBook && (
                <Link
                  href={`/contents/books/${linkedBook.id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  📚 {linkedBook.title}
                </Link>
              )}
            </div>
            <p className="text-sm text-gray-500">{subText}</p>
          </div>

          {/* 주요 정보 (항상 표시) */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {primaryInfo.map((row) => (
              <span key={row.label} className="flex items-center gap-1">
                <span className="font-medium text-gray-500">{row.label}:</span>
                <span className="text-gray-900">{row.value ?? "—"}</span>
              </span>
            ))}
          </div>

          {/* 상세 정보 (토글) */}
          {secondaryInfo.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-indigo-600 hover:text-indigo-700 transition"
              >
                {isExpanded ? "▲ 상세 정보 접기" : "▼ 상세 정보 보기"}
              </button>
              {isExpanded && (
                <dl className="mt-2 grid gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
                  {secondaryInfo.map((row) => (
                    <Fragment key={row.label}>
                      <dt className="font-medium text-gray-500">{row.label}</dt>
                      <dd className="text-gray-900">{row.value ?? "—"}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            href={`/contents/${activeTab}/${item.id}`}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            상세보기
          </Link>
          <DeleteContentButton
            id={item.id}
            contentType={activeTab}
            onDelete={onDelete}
          />
        </div>
      </div>
    </li>
  );
}

