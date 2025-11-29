import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteLecture } from "@/app/(student)/actions/contentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Lecture } from "@/app/types/content";
import { LectureDetailTabs } from "./_components/LectureDetailTabs";
import { getMasterLectureById } from "@/lib/data/contentMasters";

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const selectLecture = () =>
    supabase
      .from("lectures")
      .select(
        "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,total_episodes,notes,master_content_id,linked_book_id,created_at"
      )
      .eq("id", id);

  let { data: lecture, error } = await selectLecture()
    .eq("student_id", user.id)
    .maybeSingle<Lecture & { master_content_id?: string | null; linked_book_id?: string | null; total_episodes?: number | null }>();

  if (error && error.code === "42703") {
    ({ data: lecture, error } = await selectLecture().maybeSingle<Lecture & { master_content_id?: string | null; linked_book_id?: string | null }>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!lecture) notFound();

  // 연결된 교재 조회 (있는 경우)
  let linkedBook = null;
  if (lecture.linked_book_id) {
    const { data: book } = await supabase
      .from("books")
      .select("id, title")
      .eq("id", lecture.linked_book_id)
      .eq("student_id", user.id)
      .maybeSingle();
    linkedBook = book;
  }

  // 학생의 교재 목록 조회 (연결된 교재 선택용)
  const { data: studentBooks } = await supabase
    .from("books")
    .select("id, title")
    .eq("student_id", user.id)
    .order("title", { ascending: true });

  // 강의 episode 정보 조회 (학생 강의 episode 우선, 없으면 마스터 참조)
  let lectureEpisodes: Array<{ 
    id: string; 
    lecture_id: string; 
    episode_number: number; 
    title: string | null;  // 변경: episode_title → title
    duration: number | null; 
    display_order: number;
    created_at: string;
  }> = [];
  
  // 먼저 학생 강의 episode 조회
  const { data: studentEpisodes } = await supabase
    .from("student_lecture_episodes")
    .select("id,episode_number,title,duration,display_order,created_at")  // 변경: episode_title → title, created_at 추가
    .eq("lecture_id", id)
    .order("display_order", { ascending: true })
    .order("episode_number", { ascending: true });

  if (studentEpisodes && studentEpisodes.length > 0) {
    lectureEpisodes = studentEpisodes.map(e => ({
      id: e.id,
      lecture_id: lecture.id,  // 추가: lecture_id 필수 필드
      episode_number: e.episode_number,
      title: e.title,  // 변경: episode_title → title
      duration: e.duration,
      display_order: e.display_order,
      created_at: e.created_at || "",  // 추가: created_at 필수 필드
    }));
  } else if (lecture.master_content_id) {
    // 학생 강의 episode가 없으면 마스터 참조
    try {
      const { episodes } = await getMasterLectureById(lecture.master_content_id);
      lectureEpisodes = episodes.map(e => ({
        id: e.id,
        lecture_id: lecture.id,  // 추가: lecture_id 필수 필드
        episode_number: e.episode_number,
        title: e.title,  // 변경: episode_title → title
        duration: e.duration,
        display_order: e.display_order,
        created_at: "",  // 추가: created_at 필수 필드
      }));
    } catch (err) {
      console.error("마스터 강의 episode 정보 조회 실패:", err);
    }
  }

  // 총 회차 자동 계산 (회차 정보 기반)
  const calculatedTotalEpisodes = lectureEpisodes.length > 0
    ? Math.max(...lectureEpisodes.map(e => e.episode_number || 0))
    : null;
  
  // DB의 total_episodes와 계산된 값이 다르면 업데이트
  if (calculatedTotalEpisodes !== null && calculatedTotalEpisodes !== lecture.total_episodes) {
    // 백그라운드에서 업데이트 (에러는 무시)
    supabase
      .from("lectures")
      .update({ total_episodes: calculatedTotalEpisodes })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[lecture] 총 회차 자동 업데이트 실패:", error);
        }
      });
    // 표시용으로 계산된 값 사용
    lecture.total_episodes = calculatedTotalEpisodes;
  }

  const deleteAction = deleteLecture.bind(null, lecture.id);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <Suspense fallback={<div className="py-8 text-center text-gray-500">로딩 중...</div>}>
          <LectureDetailTabs
            lecture={lecture}
            deleteAction={deleteAction}
            linkedBook={linkedBook}
            studentBooks={studentBooks || []}
            initialEpisodes={lectureEpisodes.map((e) => ({
              id: e.id,
              lecture_id: e.lecture_id,  // 변경: lecture.id → e.lecture_id (이미 포함됨)
              episode_number: e.episode_number,
              title: e.title,  // 변경: episode_title → title
              duration: e.duration,
              display_order: e.display_order,
              created_at: e.created_at,  // 변경: "" → e.created_at (이미 포함됨)
            }))}
            isFromMaster={!!lecture.master_content_id}
          />
        </Suspense>
      </div>
    </section>
  );
}
