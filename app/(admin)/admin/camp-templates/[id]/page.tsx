import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { CampTemplateDetail } from "./CampTemplateDetail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // 템플릿 블록 세트 정보 조회
  let templateBlockSet: {
    id: string;
    name: string;
    blocks: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  } | null = null;

  const template = result.template;
  const tenantContext = await getTenantContext();
  
  // template_data에서 block_set_id 확인
  let templateData: any = null;
  if (template.template_data) {
    if (typeof template.template_data === "string") {
      try {
        templateData = JSON.parse(template.template_data);
      } catch (parseError) {
        console.error("[CampTemplateDetailPage] template_data 파싱 에러:", parseError);
        templateData = null;
      }
    } else {
      templateData = template.template_data;
    }
  }

  const blockSetId = templateData?.block_set_id;

  if (blockSetId) {
    const supabase = await createSupabaseServerClient();

    // 템플릿 블록 세트 조회 (template_id 검증 포함)
    const { data: blockSet, error: blockSetError } = await supabase
      .from("template_block_sets")
      .select("id, name, template_id")
      .eq("id", blockSetId)
      .eq("template_id", id)
      .eq("tenant_id", tenantContext?.tenantId || "")
      .maybeSingle();

    if (blockSetError) {
      console.error("[CampTemplateDetailPage] 템플릿 블록 세트 조회 에러:", blockSetError);
    } else if (blockSet) {
      // 템플릿 블록 조회
      const { data: blocks, error: blocksError } = await supabase
        .from("template_blocks")
        .select("id, day_of_week, start_time, end_time")
        .eq("template_block_set_id", blockSet.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error("[CampTemplateDetailPage] 템플릿 블록 조회 에러:", blocksError);
      } else if (blocks && blocks.length > 0) {
        templateBlockSet = {
          id: blockSet.id,
          name: blockSet.name,
          blocks: blocks.map((b) => ({
            id: b.id,
            day_of_week: b.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
        };
      }
    }
  }

  return (
    <CampTemplateDetail
      template={result.template}
      templateBlockSet={templateBlockSet}
    />
  );
}
