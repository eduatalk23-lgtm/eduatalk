import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, deleteMasterBook } from "@/lib/data/contentMasters";
import { getContainerClass } from "@/lib/constants/layout";
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
  const { role } = await getCachedUserRole();

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
    <section className={getContainerClass("CONTENT_DETAIL", "lg")}>
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <ContentHeader
          title={book.title}
          subtitle={book.publisher || ""}
          icon="📚 교재"
          createdAt={book.created_at}
          coverImageUrl={book.cover_image_url}
        />

        <ContentDetailTable
          rows={[
            { label: "개정교육과정", value: book.revision },
            { label: "교과", value: book.subject_category ?? null },
            { label: "과목", value: book.subject ?? null },
            { label: "출판사", value: book.publisher ?? null },
            { label: "저자", value: book.author ?? null },
            { label: "총 페이지", value: book.total_pages ? `${book.total_pages}p` : null },
            { label: "난이도", value: book.difficulty_level },
            { label: "메모", value: book.notes },
            { label: "PDF URL", value: book.pdf_url, isUrl: !!book.pdf_url },
            { label: "출처 URL", value: book.source_url, isUrl: !!book.source_url },
          ]}
        />

        {/* 교재 목차 (계층적 표시) */}
        {details.length > 0 && <BookDetailsDisplay details={details} />}

        {/* 액션 버튼 (관리자/컨설턴트만 표시) */}
        {(role === "admin" || role === "consultant") && (
          <div className="flex flex-col gap-4 border-t pt-8">
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

