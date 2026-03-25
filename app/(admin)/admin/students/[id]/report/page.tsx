import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";

const ReportClient = dynamic(
  () => import("../_components/report/ReportClient").then((m) => ({ default: m.ReportClient })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-sm text-gray-500">리포트 로딩 중...</div>
      </div>
    ),
  },
);

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: Props) {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const { id: studentId } = await params;

  return (
    <div className="min-h-dvh bg-white">
      <ReportClient studentId={studentId} />
    </div>
  );
}
