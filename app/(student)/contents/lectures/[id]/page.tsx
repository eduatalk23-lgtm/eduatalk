import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteLecture } from "@/app/(student)/actions/contentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Lecture } from "@/app/types/content";
import { LectureDetailTabs } from "./_components/LectureDetailTabs";
import { getMasterLectureById, getLectureEpisodesWithFallback } from "@/lib/data/contentMasters";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";

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
        "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,total_episodes,notes,master_lecture_id,linked_book_id,created_at,content_category,lecture_type,subtitle,series_name,instructor_name,description,toc,curriculum_revision_id,subject_id,subject_group_id,grade_level,platform_id,lecture_source_url,source,source_product_code,cover_image_url,total_duration,video_url,transcript,episode_analysis,overall_difficulty,target_exam_type,tags,is_active"
      )
      .eq("id", id);

  let { data: lecture, error } = await selectLecture()
    .eq("student_id", user.id)
    .maybeSingle<Lecture & { master_lecture_id?: string | null; linked_book_id?: string | null; total_episodes?: number | null }>();

  if (error && error.code === "42703") {
    ({ data: lecture, error } = await selectLecture().maybeSingle<Lecture & { master_lecture_id?: string | null; linked_book_id?: string | null }>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!lecture) notFound();

  // 마스터 강의 정보 조회 및 병합 (master_lecture_id가 있는 경우)
  let masterLecture = null;
  if (lecture.master_lecture_id) {
    try {
      const { lecture: master } = await getMasterLectureById(lecture.master_lecture_id);
      if (master) {
        masterLecture = master;
        // 마스터 강의 정보를 lecture 객체에 병합 (학생 강의에 값이 없으면 마스터 값 사용)
        lecture = {
          ...lecture,
          content_category: lecture.content_category || master.content_category || null,
          lecture_type: lecture.lecture_type || master.lecture_type || null,
          subtitle: lecture.subtitle || null, // MasterLecture에는 subtitle 필드가 없음
          series_name: lecture.series_name || null, // MasterLecture에는 series_name 필드가 없음
          instructor_name: lecture.instructor_name || master.instructor_name || null,
          description: lecture.description || null, // MasterLecture에는 description 필드가 없음
          toc: lecture.toc || null, // MasterLecture에는 toc 필드가 없음
          curriculum_revision_id: lecture.curriculum_revision_id || null, // MasterLecture에는 curriculum_revision_id 필드가 없음
          subject_id: lecture.subject_id || null, // MasterLecture에는 subject_id 필드가 없음
          subject_group_id: lecture.subject_group_id || null, // MasterLecture에는 subject_group_id 필드가 없음
          grade_level: lecture.grade_level || master.grade_level || null,
          platform_id: lecture.platform_id || master.platform_id || null,
          lecture_source_url: lecture.lecture_source_url || master.lecture_source_url || null,
          source: lecture.source || null, // MasterLecture에는 source 필드가 없음
          source_product_code: lecture.source_product_code || null, // MasterLecture에는 source_product_code 필드가 없음
          cover_image_url: lecture.cover_image_url || null, // MasterLecture에는 cover_image_url 필드가 없음
          total_duration: lecture.total_duration || master.total_duration || null,
          video_url: lecture.video_url || master.video_url || null,
          transcript: lecture.transcript || master.transcript || null,
          episode_analysis: lecture.episode_analysis || master.episode_analysis || null,
          overall_difficulty: lecture.overall_difficulty || master.overall_difficulty || null,
          target_exam_type: lecture.target_exam_type || null, // MasterLecture에는 target_exam_type 필드가 없음
          tags: lecture.tags || null, // MasterLecture에는 tags 필드가 없음
          is_active: lecture.is_active ?? true, // MasterLecture에는 is_active 필드가 없음
          // 플랫폼명도 병합 (platform이 없으면 platform_name 사용)
          platform: lecture.platform || master.platform_name || master.platform || null,
        };
      }
    } catch (err) {
      console.error("마스터 강의 정보 조회 실패:", err);
    }
  }

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
  const lectureEpisodes = await getLectureEpisodesWithFallback(
    id,
    lecture.master_lecture_id,
    user.id
  );

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
    <section className={getContainerClass("CONTENT_DETAIL", "lg")}>
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <Suspense fallback={<SuspenseFallback />}>
          <LectureDetailTabs
            lecture={lecture}
            deleteAction={deleteAction}
            linkedBook={linkedBook}
            studentBooks={studentBooks || []}
            initialEpisodes={lectureEpisodes.map((e) => ({
              id: e.id,
              lecture_id: e.lecture_id,
              episode_number: e.episode_number,
              episode_title: e.episode_title,
              duration: e.duration,
              display_order: e.display_order,
              created_at: e.created_at,
            }))}
            isFromMaster={!!lecture.master_lecture_id}
            masterLecture={masterLecture}
          />
        </Suspense>
      </div>
    </section>
  );
}
