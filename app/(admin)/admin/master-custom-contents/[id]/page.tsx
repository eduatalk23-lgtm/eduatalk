import { notFound, redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterCustomContentById, deleteMasterCustomContent } from "@/lib/data/contentMasters";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { ContentDetailLayout } from "@/app/(student)/contents/_components/ContentDetailLayout";
import { ContentActionButtons } from "@/app/(student)/contents/_components/ContentActionButtons";

export default async function MasterCustomContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getCachedUserRole();

  // 커스텀 콘텐츠 조회
  const { content } = await getMasterCustomContentById(id);

  if (!content) notFound();

  // 삭제 액션
  const deleteAction = async () => {
    "use server";
    await deleteMasterCustomContent(id);
    redirect("/admin/master-custom-contents");
  };

  return (
    <ContentDetailLayout
      header={
        <ContentHeader
          title={content.title}
          subtitle={content.content_type || ""}
          icon="📝 커스텀 콘텐츠"
          contentType="custom"
          createdAt={content.created_at}
        />
      }
      detailTable={
        <ContentDetailTable
          rows={[
            { label: "개정교육과정", value: content.revision },
            { label: "교과", value: content.subject_category ?? null },
            { label: "과목", value: content.subject ?? null },
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
            { label: "콘텐츠 URL", value: content.content_url, isUrl: !!content.content_url },
            { label: "메모", value: content.notes },
          ]}
        />
      }
      actions={
        (role === "admin" || role === "consultant") ? (
          <ContentActionButtons
            editHref={`/admin/master-custom-contents/${content.id}/edit`}
            deleteAction={deleteAction}
            listHref="/admin/master-custom-contents"
          />
        ) : null
      }
    />
  );
}

