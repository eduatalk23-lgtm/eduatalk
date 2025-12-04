import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { CampTemplateDetail } from "./CampTemplateDetail";
import { getTemplateBlockSet } from "@/app/(admin)/actions/campTemplateBlockSets";

export default async function CampTemplateDetailPage({
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

  // 템플릿 블록 세트 정보 조회 (camp_template_block_sets 테이블을 통해 조회)
  const templateBlockSet = await getTemplateBlockSet(id);

  return (
    <CampTemplateDetail
      template={result.template}
      templateBlockSet={templateBlockSet}
    />
  );
}
