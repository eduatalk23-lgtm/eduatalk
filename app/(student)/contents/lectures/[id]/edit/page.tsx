import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { LectureEditForm } from "./LectureEditForm";
import { Lecture } from "@/app/types/content";
import { ContentFormLayout } from "@/app/(student)/contents/_components/ContentFormLayout";
import { getBooks } from "@/lib/data/studentContents";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

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

  const tenantContext = await getTenantContext();

  const selectLecture = () =>
    supabase
      .from("lectures")
      .select(
        "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,linked_book_id,created_at"
      )
      .eq("id", id);

  let { data: lecture, error } = await selectLecture()
    .eq("student_id", user.id)
    .maybeSingle<Lecture & { linked_book_id?: string | null }>();

  if (ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data: lecture, error } = await selectLecture().maybeSingle<Lecture & { linked_book_id?: string | null }>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!lecture) notFound();

  // 교재 목록 조회
  const books = await getBooks(user.id, tenantContext?.tenantId || null);
  const studentBooks = books.map((book) => ({
    id: book.id,
    title: book.title,
  }));

  // 연결된 교재 정보 조회
  let linkedBook: { id: string; title: string } | null = null;
  if (lecture.linked_book_id) {
    const book = books.find((b) => b.id === lecture.linked_book_id);
    if (book) {
      linkedBook = { id: book.id, title: book.title };
    }
  }

  return (
    <ContentFormLayout
      title="강의 정보 수정"
      description="등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다."
      backHref={`/contents/lectures/${lecture.id}`}
    >
      <LectureEditForm 
        lecture={lecture} 
        studentBooks={studentBooks}
        linkedBookId={lecture.linked_book_id || null}
      />
    </ContentFormLayout>
  );
}

