import { redirect } from "next/navigation";

type TimeManagementPageProps = {
  params: Promise<{ id: string }>;
};

// 기존 경로를 새 경로로 리다이렉트
export default async function TimeManagementPage({
  params,
}: TimeManagementPageProps) {
  const { id } = await params;
  redirect(`/admin/time-management/${id}`);
}

