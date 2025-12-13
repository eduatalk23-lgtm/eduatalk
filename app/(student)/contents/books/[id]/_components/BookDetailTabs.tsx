"use client";

import { useSearchParams } from "next/navigation";
import { ContentTabs } from "@/app/(student)/contents/_components/ContentTabs";
import { BookInfoSection } from "./BookInfoSection";
import { BookDetailsSection } from "./BookDetailsSection";
import { Book } from "@/app/types/content";
import { BookDetail } from "@/lib/types/plan";

type BookDetailTabsProps = {
  book: Book;
  deleteAction: () => void;
  initialDetails: BookDetail[];
  isFromMaster: boolean;
};

export function BookDetailTabs({
  book,
  deleteAction,
  initialDetails,
  isFromMaster,
}: BookDetailTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const tabs = [
    { key: "info", label: "교재 정보" },
    { key: "details", label: "목차 정보" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 상단 액션 버튼 */}
      <div className="flex items-center justify-between border-b pb-4">
        <a
          href="/contents?tab=books"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          ← 목록으로
        </a>
        <div className="flex gap-2">
          <form action={deleteAction}>
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm("정말 삭제하시겠습니까?")) {
                  e.preventDefault();
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              삭제하기
            </button>
          </form>
        </div>
      </div>

      <ContentTabs tabs={tabs} defaultTab="info" />

      {activeTab === "info" && (
        <BookInfoSection book={book} deleteAction={deleteAction} isFromMaster={isFromMaster} />
      )}

      {activeTab === "details" && (
        <BookDetailsSection
          bookId={book.id}
          initialDetails={initialDetails}
          isFromMaster={isFromMaster}
        />
      )}
    </div>
  );
}

