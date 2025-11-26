import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { getTemplateBlockSets } from "@/app/(admin)/actions/templateBlockSets";
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

  // 템플릿 블록 세트 조회 (실제 DB에서)
  let initialBlockSets: Array<{ id: string; name: string; blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }> = [];
  
  try {
    const blockSets = await getTemplateBlockSets(id);
    initialBlockSets = blockSets.map(bs => ({
      id: bs.id,
      name: bs.name,
      blocks: bs.blocks || []
    }));
    
    // template_data에 저장된 block_set_id가 initialBlockSets에 있는지 확인
    const templateData = result.template.template_data as any;
    const savedBlockSetId = templateData?.block_set_id;
    
    if (savedBlockSetId) {
      const hasBlockSet = initialBlockSets.some(set => set.id === savedBlockSetId);
      
      if (!hasBlockSet) {
        // template_data에 저장된 block_set_id가 initialBlockSets에 없으면
        // 해당 블록 세트를 별도로 조회하여 추가
        const { createSupabaseServerClient } = await import("@/lib/supabase/server");
        const supabase = await createSupabaseServerClient();
        
        const { data: missingBlockSet, error: blockSetError } = await supabase
          .from("template_block_sets")
          .select("id, name")
          .eq("id", savedBlockSetId)
          .eq("template_id", id)
          .single();
        
        if (!blockSetError && missingBlockSet) {
          // 블록 세트의 블록도 조회
          const { data: blocks, error: blocksError } = await supabase
            .from("template_blocks")
            .select("id, day_of_week, start_time, end_time")
            .eq("template_block_set_id", savedBlockSetId)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });
          
          if (!blocksError && blocks) {
            // 맨 앞에 추가하여 기본값으로 표시
            initialBlockSets = [
              {
                id: missingBlockSet.id,
                name: missingBlockSet.name,
                blocks: blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>,
              },
              ...initialBlockSets,
            ];
          }
        } else {
          // 블록 세트를 찾을 수 없으면 경고 로그만 출력
          console.warn("[EditCampTemplatePage] template_data에 저장된 block_set_id를 찾을 수 없습니다:", {
            block_set_id: savedBlockSetId,
            template_id: id,
          });
        }
      }
    }
  } catch (error) {
    console.error("[EditCampTemplatePage] 템플릿 블록 세트 조회 실패:", error);
    // 에러가 발생해도 빈 배열로 계속 진행
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">캠프 템플릿 수정</h1>
          <p className="text-sm text-gray-500">템플릿 정보를 수정하세요.</p>
        </div>

        <CampTemplateEditForm template={result.template} initialBlockSets={initialBlockSets} />
      </div>
    </section>
  );
}

