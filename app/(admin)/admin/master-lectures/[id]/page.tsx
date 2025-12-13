import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  getMasterLectureById,
  deleteMasterLecture,
} from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { ContentActionButtons } from "@/app/(student)/contents/_components/ContentActionButtons";
import { LectureEpisodesDisplay } from "@/app/(student)/contents/_components/LectureEpisodesDisplay";
import { secondsToMinutes } from "@/lib/utils/duration";

export default async function MasterLectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getCurrentUserRole();

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

  // 삭제 액션
  const deleteAction = async () => {
    "use server";
    await deleteMasterLecture(id);
    redirect("/admin/master-lectures");
  };

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
            { label: "교과", value: lecture.subject_category },
            { label: "과목", value: lecture.subject },
            { label: "플랫폼", value: lecture.platform_name || lecture.platform },
            { label: "강의 유형", value: (lecture as any).lecture_type },
            { label: "콘텐츠 카테고리", value: lecture.content_category },
            { label: "강사명", value: (lecture as any).instructor_name },
            { label: "대상 학년", value: (lecture as any).grade_level },
            { label: "총 회차", value: lecture.total_episodes ? `${lecture.total_episodes}회` : null },
            {
              label: "총 강의시간",
              value: lecture.total_duration
                ? `${secondsToMinutes(lecture.total_duration)}분`
                : null,
            },
            { label: "난이도", value: lecture.difficulty_level },
            {
              label: "연결된 교재",
              value: linkedBook ? linkedBook.title : null,
            },
            {
              label: "출처 URL",
              value: (lecture as any).lecture_source_url,
              isUrl: !!(lecture as any).lecture_source_url,
            },
            { label: "부제목", value: (lecture as any).subtitle },
            { label: "시리즈명", value: (lecture as any).series_name },
            { label: "설명", value: (lecture as any).description },
            { label: "메모", value: lecture.notes },
          ]}
        />

        {/* 강의 회차 정보 */}
        {episodes.length > 0 && <LectureEpisodesDisplay episodes={episodes} />}

        {/* 액션 버튼 (관리자/컨설턴트만 표시) */}
        {(role === "admin" || role === "consultant") && (
          <div className="flex flex-col gap-4 border-t pt-8">
            <ContentActionButtons
              editHref={`/admin/master-lectures/${lecture.id}/edit`}
              deleteAction={deleteAction}
              listHref="/admin/master-lectures"
            />
          </div>
        )}
      </div>
    </section>
  );
}

