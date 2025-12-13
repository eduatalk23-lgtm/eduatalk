import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterCustomContentById } from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { CopyMasterCustomContentButton } from "./_components/CopyMasterCustomContentButton";
import { getContainerClass } from "@/lib/constants/layout";

export default async function StudentMasterCustomContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getCurrentUserRole();

  if (role !== "student") {
    redirect("/login");
  }

  // 커스텀 콘텐츠 조회
  const { content } = await getMasterCustomContentById(id);

  if (!content) notFound();

  return (
    <section className={`${getContainerClass("CONTENT_DETAIL", "lg")} flex flex-col gap-8`}>
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <ContentHeader
          title={content.title}
          subtitle={content.content_type || ""}
          icon="📝 커스텀 콘텐츠"
          createdAt={content.created_at}
        />

        <ContentDetailTable
          rows={[
            { label: "개정교육과정", value: content.revision },
            { label: "교과", value: content.subject_category },
            { label: "과목", value: content.subject },
            { label: "콘텐츠 유형", value: content.content_type },
            {
              label: content.content_type === "book" ? "총 페이지" : "총 시간",
              value: content.total_page_or_time
                ? content.content_type === "book"
                  ? `${content.total_page_or_time}p`
                  : `${content.total_page_or_time}분`
                : null,
            },
            { label: "난이도", value: content.difficulty_level },
            { label: "콘텐츠 카테고리", value: content.content_category },
            { label: "메모", value: content.notes },
          ]}
        />

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-4 border-t pt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contents/master-custom-contents"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              목록으로
            </Link>
            <CopyMasterCustomContentButton masterContentId={id} />
          </div>
        </div>
      </div>
    </section>
  );
}

