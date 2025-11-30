import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, deleteMasterBook } from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { ContentActionButtons } from "@/app/(student)/contents/_components/ContentActionButtons";
import { BookDetailsDisplay } from "@/app/(student)/contents/_components/BookDetailsDisplay";

export default async function MasterBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getCurrentUserRole();

  // 교재 조회
  const { book, details } = await getMasterBookById(id);

  if (!book) notFound();

  // 삭제 액션
  const deleteAction = async () => {
    "use server";
    await deleteMasterBook(id);
    redirect("/admin/master-books");
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <ContentHeader
          title={book.title}
          subtitle={book.publisher || ""}
          icon="📚 교재"
          createdAt={book.created_at}
        />

        <ContentDetailTable
          rows={[
            { label: "개정교육과정", value: book.revision },
            { label: "학년/학기", value: book.semester },
            { label: "교과", value: book.subject_category },
            { label: "과목", value: book.subject },
            { label: "출판사", value: book.publisher },
            { label: "저자", value: book.author },
            { label: "총 페이지", value: book.total_pages ? `${book.total_pages}p` : null },
            { label: "난이도", value: book.difficulty_level },
            { label: "메모", value: book.notes },
          ]}
        />

        {/* 교재 목차 (계층적 표시) */}
        {details.length > 0 && <BookDetailsDisplay details={details} />}

        {/* 액션 버튼 (관리자/컨설턴트만 표시) */}
        {(role === "admin" || role === "consultant") && (
          <div className="mt-8 flex flex-col gap-4 border-t pt-8">
            <ContentActionButtons
              editHref={`/admin/master-books/${book.id}/edit`}
              deleteAction={deleteAction}
              listHref="/admin/master-books"
            />
          </div>
        )}
      </div>
    </section>
  );
}

