
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; setId: string }>;
};

// 기존 경로를 새 경로로 리다이렉트
export default async function TemplateBlockSetDetailPage({ params }: PageProps) {
  const { id, setId } = await params;
  redirect(`/admin/time-management/${id}/${setId}`);
}

