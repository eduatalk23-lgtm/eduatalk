"use client";

import Link from "next/link";
import { ContentCard } from "./ContentCard";
import { Pagination } from "./Pagination";
import { useSelection } from "./SelectionContext";
import {
  deleteBook,
  deleteLecture,
  deleteCustomContent,
} from "@/lib/domains/content";
import type { ContentListItem } from "./ContentsList";

type TabKey = "books" | "lectures" | "custom";

type Row = { label: string; value: string | number | null };

type ContentsListClientProps = {
  list: ContentListItem[];
  activeTab: TabKey;
  deleteBook: (id: string) => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
  deleteCustomContent: (id: string) => Promise<void>;
};

function getDetailRows(tab: TabKey, item: ContentListItem): Row[] {
  if (tab === "books") {
    return [
      { label: "개정교육과정", value: item.revision ?? null },
      { label: "학년/학기", value: item.semester ?? null },
      { label: "교과", value: item.subject_category ?? null },
      { label: "과목", value: item.subject ?? null },
      { label: "출판사", value: item.publisher ?? null },
      { label: "난이도", value: item.difficulty_level ?? null },
      {
        label: "총 페이지",
        value: item.total_pages ? `${item.total_pages}p` : null,
      },
    ];
  }

  if (tab === "lectures") {
    return [
      { label: "개정교육과정", value: item.revision ?? null },
      { label: "학년/학기", value: item.semester ?? null },
      { label: "교과", value: item.subject_category ?? null },
      { label: "과목", value: item.subject ?? null },
      { label: "플랫폼", value: item.platform ?? null },
      { label: "난이도", value: item.difficulty_level ?? null },
      {
        label: "총 회차",
        value: item.total_episodes ? `${item.total_episodes}회` : null,
      },
      {
        label: "재생 시간",
        value: item.duration ? `${Math.round(item.duration / 60)}분` : null,
      },
    ];
  }

  if (tab === "custom") {
    return [
      { label: "콘텐츠 유형", value: item.content_type ?? null },
      { label: "과목", value: item.subject ?? null },
      {
        label: item.content_type === "book" ? "총 페이지" : "총 시간",
        value: item.total_page_or_time
          ? item.content_type === "book"
            ? `${item.total_page_or_time}p`
            : `${item.total_page_or_time}분`
          : null,
      },
    ];
  }

  return [];
}

function getSubText(tab: TabKey, item: ContentListItem): string {
  if (tab === "books") return item.publisher || "출판사 정보 없음";
  if (tab === "lectures") return item.platform || "플랫폼 정보 없음";
  if (tab === "custom") return item.content_type || "유형 정보 없음";
  return "";
}

export function ContentsListClient({
  list,
  activeTab,
  deleteBook,
  deleteLecture,
  deleteCustomContent,
}: ContentsListClientProps) {
  const { selectedIds, select, selectAll } = useSelection();

  const allIds = list.map((item) => item.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  const getDeleteHandler = () => {
    if (activeTab === "books") return deleteBook;
    if (activeTab === "lectures") return deleteLecture;
    if (activeTab === "custom") return deleteCustomContent;
    return deleteBook;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 전체 선택 체크박스 */}
      {list.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = someSelected && !allSelected;
              }
            }}
            onChange={(e) => selectAll(e.target.checked, allIds)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label 
            className="text-sm font-medium text-gray-700 cursor-pointer"
            onClick={() => selectAll(!allSelected, allIds)}
          >
            전체 선택
          </label>
        </div>
      )}

      <ul className="grid gap-4">
        {list.map((item) => (
          <ContentCard
            key={item.id}
            item={item as { id: string; title: string; master_content_id?: string | null; master_lecture_id?: string | null; [key: string]: string | number | boolean | null | undefined; }}
            activeTab={activeTab}
            onDelete={getDeleteHandler()}
            detailRows={getDetailRows(activeTab, item)}
            subText={getSubText(activeTab, item)}
            linkedBook={item.linkedBook}
            isSelected={selectedIds.has(item.id)}
            onSelect={(checked) => select(item.id, checked)}
          />
        ))}
      </ul>
    </div>
  );
}

