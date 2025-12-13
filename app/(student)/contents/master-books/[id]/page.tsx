import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMasterBookById } from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { BookDetailsDisplay } from "@/app/(student)/contents/_components/BookDetailsDisplay";
import { CopyMasterBookButton } from "./_components/CopyMasterBookButton";
import { getContainerClass } from "@/lib/constants/layout";

export default async function StudentMasterBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 교재 조회
  const { book, details } = await getMasterBookById(id);

  if (!book) notFound();

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
            { label: "개정교육과정", value: book.revision ?? null },
            { label: "교과", value: book.subject_category ?? null },
            { label: "과목", value: book.subject ?? null },
            { label: "출판사", value: book.publisher ?? null },
            { label: "총 페이지", value: book.total_pages ? `${book.total_pages}p` : null },
            { label: "난이도", value: book.difficulty_level ?? null },
            { label: "메모", value: book.notes ?? null },
            { label: "출처 URL", value: book.source_url ?? null, isUrl: !!book.source_url },
          ]}
        />

        {/* 교재 목차 (계층적 표시) */}
        {details.length > 0 && <BookDetailsDisplay details={details} />}

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-4 border-t pt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contents/master-books"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              목록으로
            </Link>
            <CopyMasterBookButton masterBookId={id} />
          </div>
        </div>
      </div>
    </section>
  );
}

