import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMasterLectureById,
} from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { LectureEpisodesDisplay } from "@/app/(student)/contents/_components/LectureEpisodesDisplay";
import { CopyMasterLectureButton } from "./_components/CopyMasterLectureButton";

export default async function StudentMasterLectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  // 강의 조회
  const { lecture, episodes } = await getMasterLectureById(id);

  if (!lecture) notFound();

  // 연결된 교재 조회 (있는 경우)
  let linkedBook = null;
  if (lecture.linked_book_id) {
    const { data: book } = await supabase
      .from("master_books")
      .select("id, title")
      .eq("id", lecture.linked_book_id)
      .maybeSingle();
    linkedBook = book;
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <ContentHeader
          title={lecture.title}
          subtitle={lecture.platform || ""}
          icon="🎧 강의"
          createdAt={lecture.created_at}
        />

        <ContentDetailTable
          rows={[
            { label: "개정교육과정", value: lecture.revision },
            { label: "학년/학기", value: lecture.semester },
            { label: "교과", value: lecture.subject_category },
            { label: "과목", value: lecture.subject },
            { label: "플랫폼", value: lecture.platform },
            { label: "총 회차", value: `${lecture.total_episodes}회` },
            {
              label: "총 강의시간",
              value: lecture.total_duration
                ? `${lecture.total_duration}분`
                : null,
            },
            { label: "난이도", value: lecture.difficulty_level },
            {
              label: "연결된 교재",
              value: linkedBook ? (
                <Link
                  href={`/contents/master-books/${linkedBook.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {linkedBook.title}
                </Link>
              ) : null,
            },
            { label: "메모", value: lecture.notes },
          ]}
        />

        {/* 강의 회차 정보 */}
        {episodes.length > 0 && <LectureEpisodesDisplay episodes={episodes} />}

        {/* 액션 버튼 */}
        <div className="mt-8 flex flex-col gap-4 border-t pt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contents/master-lectures"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              목록으로
            </Link>
            <CopyMasterLectureButton masterLectureId={id} />
          </div>
        </div>
      </div>
    </section>
  );
}

