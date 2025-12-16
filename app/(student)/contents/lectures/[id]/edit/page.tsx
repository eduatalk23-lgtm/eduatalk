import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LectureEditForm } from "./LectureEditForm";
import { Lecture } from "@/app/types/content";
import { ContentFormLayout } from "@/app/(student)/contents/_components/ContentFormLayout";

export default async function EditLecturePage({
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
        "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at"
      )
      .eq("id", id);

  let { data: lecture, error } = await selectLecture()
    .eq("student_id", user.id)
    .maybeSingle<Lecture>();

  if (error && error.code === "42703") {
    ({ data: lecture, error } = await selectLecture().maybeSingle<Lecture>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!lecture) notFound();

  return (
    <ContentFormLayout
      title="강의 정보 수정"
      description="등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다."
      backHref={`/contents/lectures/${lecture.id}`}
    >
      <LectureEditForm lecture={lecture} />
    </ContentFormLayout>
  );
}

