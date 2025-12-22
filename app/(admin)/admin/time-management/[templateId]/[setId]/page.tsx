
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import TemplateBlockSetDetail from "./_components/TemplateBlockSetDetail";
import Link from "next/link";

type PageProps = {
  params: Promise<{ templateId: string; setId: string }>;
};

export default async function TemplateBlockSetDetailPage({ params }: PageProps) {
  const { templateId, setId } = await params;
  
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 템플릿 조회 및 권한 확인
  const result = await getCampTemplateById(templateId);
  if (!result.success || !result.template) {
    redirect(`/admin/time-management/${templateId}`);
  }

  const supabase = await createSupabaseServerClient();

  // 연결 테이블에서 템플릿에 연결된 블록 세트 확인
  const { data: templateBlockSetLink } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", templateId)
    .eq("tenant_block_set_id", setId)
    .maybeSingle();

  if (!templateBlockSetLink) {
    redirect(`/admin/time-management/${templateId}`);
  }

  // 테넌트 블록 세트 조회
  const { data: blockSet, error: setError } = await supabase
    .from("tenant_block_sets")
    .select("id, name, description")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (setError || !blockSet) {
    redirect(`/admin/time-management/${templateId}`);
  }

  // 해당 세트의 블록 조회
  const { data: blocks, error: blocksError } = await supabase
    .from("tenant_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("tenant_block_set_id", setId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    console.error("블록 조회 실패:", blocksError);
  }

  // 템플릿 데이터에서 선택된 블록 세트 확인
  const templateData = result.template.template_data;
  const isSelected = templateData?.block_set_id === setId;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/time-management/${templateId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 시간 관리
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-gray-900">블록 세트 상세</h1>
          <p className="text-sm text-gray-500">
            템플릿: {result.template.name}
          </p>
        </div>
      </div>
      <TemplateBlockSetDetail
        templateId={templateId}
        blockSet={blockSet}
        blocks={(blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? []}
        isSelected={isSelected}
      />
    </section>
  );
}

