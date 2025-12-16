import Link from "next/link";
import { notFound } from "next/navigation";
import { getMasterBookById } from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { BookDetailsDisplay } from "@/app/(student)/contents/_components/BookDetailsDisplay";
import { ContentDetailLayout } from "@/app/(student)/contents/_components/ContentDetailLayout";
import { CopyMasterBookButton } from "./_components/CopyMasterBookButton";

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
    <ContentDetailLayout
      header={
        <ContentHeader
          title={book.title}
          subtitle={book.publisher || ""}
          icon="📚 교재"
          contentType="book"
          createdAt={book.created_at}
          coverImageUrl={book.cover_image_url}
        />
      }
      detailTable={
        <ContentDetailTable
          sections={[
            {
              title: "기본 정보",
              rows: [
                { label: "개정교육과정", value: book.revision ?? null },
                { label: "교과", value: book.subject_category ?? null },
                { label: "과목", value: book.subject ?? null },
                { label: "출판사", value: book.publisher ?? null },
              ],
            },
            {
              title: "상세 정보",
              rows: [
                { label: "총 페이지", value: book.total_pages ? `${book.total_pages}p` : null },
                { label: "난이도", value: book.difficulty_level ?? null },
                { label: "메모", value: book.notes ?? null },
                { label: "출처 URL", value: book.source_url ?? null, isUrl: !!book.source_url },
              ],
            },
          ]}
        />
      }
      additionalSections={[
        details.length > 0 ? <BookDetailsDisplay key="details" details={details} /> : null,
      ]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/contents/master-books"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            목록으로
          </Link>
          <CopyMasterBookButton masterBookId={id} />
        </div>
      }
    />
  );
}

