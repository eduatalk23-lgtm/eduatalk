"use client";

import { useSearchParams } from "next/navigation";
import { ContentTabs } from "@/app/(student)/contents/_components/ContentTabs";
import { LectureInfoSection } from "./LectureInfoSection";
import { LectureEpisodesSection } from "./LectureEpisodesSection";
import { LectureLinkedBookSection } from "./LectureLinkedBookSection";
import { Lecture } from "@/app/types/content";

type LectureDetailTabsProps = {
  lecture: Lecture & { linked_book_id?: string | null; total_episodes?: number | null };
  deleteAction: () => void;
  linkedBook: { id: string; title: string } | null;
  studentBooks: Array<{ id: string; title: string }>;
  initialEpisodes: Array<{
    id: string;
    lecture_id: string;
    episode_number: number;
    episode_title: string | null;
    duration: number | null;
    display_order: number;
    created_at: string;
  }>;
  isFromMaster: boolean;
};

export function LectureDetailTabs({
  lecture,
  deleteAction,
  linkedBook,
  studentBooks,
  initialEpisodes,
  isFromMaster,
}: LectureDetailTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const tabs = [
    { key: "info", label: "강의 정보" },
    { key: "episodes", label: "회차 정보" },
    { key: "linked-book", label: "강의 교재 정보" },
  ];

  return (
    <div>
      {/* 상단 액션 버튼 */}
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <a
          href="/contents?tab=lectures"
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

      <ContentTabs tabs={tabs} defaultTab="info" className="mb-6" />

      {activeTab === "info" && (
        <LectureInfoSection
          lecture={lecture}
          deleteAction={deleteAction}
          linkedBook={linkedBook}
          studentBooks={studentBooks}
          isFromMaster={isFromMaster}
        />
      )}

      {activeTab === "episodes" && (
        <LectureEpisodesSection
          lectureId={lecture.id}
          initialEpisodes={initialEpisodes}
          isFromMaster={isFromMaster}
        />
      )}

      {activeTab === "linked-book" && (
        <LectureLinkedBookSection
          lectureId={lecture.id}
          linkedBook={linkedBook}
          studentBooks={studentBooks}
        />
      )}
    </div>
  );
}

