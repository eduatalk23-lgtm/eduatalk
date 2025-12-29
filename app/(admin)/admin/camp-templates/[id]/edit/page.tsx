import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/lib/domains/camp/actions";
import { getTenantBlockSets } from "@/lib/domains/tenant";
import { getTemplateBlockSet } from "@/lib/domains/camp/actions";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplateImpactSummary } from "@/lib/data/campTemplates";
import { CampTemplateEditForm } from "./CampTemplateEditForm";

export default async function EditCampTemplatePage({
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
          <p className="text-red-800">
            템플릿을 찾을 수 없습니다.
          </p>
        </div>
      </section>
    );
  }

  // 활성 상태의 템플릿은 수정 불가
  if (result.template.status === "active") {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-amber-900">템플릿 수정 불가</h2>
          <p className="mb-4 text-sm text-amber-800">
            활성 상태의 템플릿은 수정할 수 없습니다. 템플릿을 초안 상태로 변경한 후 수정해주세요.
          </p>
          <div className="flex gap-3">
            <a
              href={`/admin/camp-templates/${id}`}
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              템플릿 상세로 돌아가기
            </a>
          </div>
        </div>
      </section>
    );
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">기관 정보를 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  const impactSummary = await getCampTemplateImpactSummary(
    id,
    tenantContext.tenantId
  );

  // 테넌트 블록 세트 조회 및 템플릿에 연결된 블록 세트 확인
  let initialBlockSets: Array<{ id: string; name: string; blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }> = [];
  let selectedBlockSetId: string | null = null;
  
  try {
    // 모든 테넌트 블록 세트 조회
    const allBlockSets = await getTenantBlockSets();
    initialBlockSets = allBlockSets.map(bs => ({
      id: bs.id,
      name: bs.name,
      blocks: bs.blocks || []
    }));
    
    // 템플릿에 연결된 블록 세트 조회
    const linkedBlockSet = await getTemplateBlockSet(id);
    if (linkedBlockSet) {
      selectedBlockSetId = linkedBlockSet.id;
      
      // 연결된 블록 세트가 initialBlockSets에 없으면 추가
      const hasBlockSet = initialBlockSets.some(set => set.id === linkedBlockSet.id);
      if (!hasBlockSet) {
        initialBlockSets = [{ ...linkedBlockSet, blocks: linkedBlockSet.blocks || [] }, ...initialBlockSets];
      }
      
    }
  } catch (error) {
    console.error("[EditCampTemplatePage] 블록 세트 조회 실패:", {
      template_id: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // 에러가 발생해도 빈 배열로 계속 진행
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">캠프 템플릿 수정</h1>
          <p className="text-sm text-gray-500">템플릿 정보를 수정하세요.</p>
        </div>

        <CampTemplateEditForm 
          template={result.template} 
          initialBlockSets={initialBlockSets}
          selectedBlockSetId={selectedBlockSetId}
          impactSummary={impactSummary}
        />
      </div>
    </section>
  );
}

