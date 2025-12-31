import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteBook } from "@/lib/domains/content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { Book } from "@/app/types/content";
import { BookDetailTabs } from "./_components/BookDetailTabs";
import { getMasterBookById } from "@/lib/data/contentMasters";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";

export default async function BookDetailPage({
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
        "id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,master_content_id,created_at"
      )
      .eq("id", id);

  let { data: book, error } = await selectBook()
    .eq("student_id", user.id)
    .maybeSingle<Book & { master_content_id?: string | null }>();

  if (ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data: book, error } = await selectBook().maybeSingle<Book & { master_content_id?: string | null }>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!book) notFound();

  // 교재 상세 정보 조회 (학생 교재 상세 정보 우선, 없으면 마스터 참조)
  let bookDetails: Array<{ id: string; major_unit: string | null; minor_unit: string | null; page_number: number | null; display_order: number }> = [];
  
  // 먼저 학생 교재 상세 정보 조회
  const { data: studentDetails } = await supabase
    .from("student_book_details")
    .select("id,major_unit,minor_unit,page_number,display_order")
    .eq("book_id", id)
    .order("display_order", { ascending: true })
    .order("page_number", { ascending: true });

  if (studentDetails && studentDetails.length > 0) {
    bookDetails = studentDetails.map(d => ({
      id: d.id,
      major_unit: d.major_unit,
      minor_unit: d.minor_unit,
      page_number: d.page_number,
      display_order: d.display_order,
    }));
  } else if (book.master_content_id) {
    // 학생 교재 상세 정보가 없으면 마스터 참조
    try {
      const { details } = await getMasterBookById(book.master_content_id);
      bookDetails = details.map(d => ({
        id: d.id,
        major_unit: d.major_unit,
        minor_unit: d.minor_unit,
        page_number: d.page_number,
        display_order: d.display_order,
      }));
    } catch (err) {
      console.error("마스터 교재 상세 정보 조회 실패:", err);
    }
  }

  const deleteAction = deleteBook.bind(null, book.id);

  return (
    <section className={getContainerClass("CONTENT_DETAIL", "lg")}>
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <Suspense fallback={<SuspenseFallback />}>
          <BookDetailTabs
            book={book}
            deleteAction={deleteAction}
            initialDetails={bookDetails.map((d) => ({
              id: d.id,
              book_id: book.id,
              major_unit: d.major_unit,
              minor_unit: d.minor_unit,
              page_number: d.page_number || 0,
              display_order: d.display_order || 0,
              created_at: "",
            }))}
            isFromMaster={!!book.master_content_id}
          />
        </Suspense>
      </div>
    </section>
  );
}
