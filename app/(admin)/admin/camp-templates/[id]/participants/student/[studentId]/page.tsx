import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { getParticipantStatsForCamp } from "./_utils/getParticipantStats";
import { CampParticipantDetailView } from "./_components/CampParticipantDetailView";

export default async function CampParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, studentId } = await params;
  const result = await getCampTemplateById(templateId);

  if (!result.success || !result.template) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">템플릿을 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  // 참여자 통계 조회
  const participantStats = await getParticipantStatsForCamp(templateId, studentId);

  return (
    <CampParticipantDetailView
      template={result.template}
      studentId={studentId}
      participantStats={participantStats}
    />
  );
}

