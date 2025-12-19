import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { calculateCampAttendanceStats } from "@/lib/domains/camp/attendance";
import { CampAttendanceDashboard } from "./_components/CampAttendanceDashboard";

export default async function CampAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getCampTemplateById(id);

  if (!result.success || !result.template) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">템플릿을 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  // 출석 통계 조회
  const attendanceStats = await calculateCampAttendanceStats(id);

  return (
    <CampAttendanceDashboard
      template={result.template}
      attendanceStats={attendanceStats}
    />
  );
}

