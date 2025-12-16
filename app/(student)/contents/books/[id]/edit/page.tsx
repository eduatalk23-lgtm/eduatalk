import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookEditForm } from "./BookEditForm";
import { Book } from "@/app/types/content";
import { ContentFormLayout } from "@/app/(student)/contents/_components/ContentFormLayout";

export default async function EditBookPage({
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

  const selectBook = () =>
    supabase
      .from("books")
      .select(
        "id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at"
      )
      .eq("id", id);

  let { data: book, error } = await selectBook()
    .eq("student_id", user.id)
    .maybeSingle<Book>();

  if (error && error.code === "42703") {
    ({ data: book, error } = await selectBook().maybeSingle<Book>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!book) notFound();

  return (
    <ContentFormLayout
      title="책 정보 수정"
      description="등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다."
      backHref={`/contents/books/${book.id}`}
    >
      <BookEditForm book={book} />
    </ContentFormLayout>
  );
}

