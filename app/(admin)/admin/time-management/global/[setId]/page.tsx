
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import TemplateBlockSetDetail from "../../[templateId]/[setId]/_components/TemplateBlockSetDetail";
import Link from "next/link";

type PageProps = {
  params: Promise<{ setId: string }>;
};

export default async function GlobalBlockSetDetailPage({ params }: PageProps) {
  const { setId } = await params;
  
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 테넌트 블록 세트 조회
  const { data: blockSet, error: setError } = await supabase
    .from("tenant_block_sets")
    .select("id, name, description")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (setError || !blockSet) {
    redirect("/admin/time-management");
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

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/time-management"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 시간 관리
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-gray-900">블록 세트 상세</h1>
          <p className="text-sm text-gray-500">
            템플릿에 연결되지 않은 블록 세트
          </p>
        </div>
      </div>
      <TemplateBlockSetDetail
        templateId={null}
        blockSet={blockSet}
        blocks={(blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? []}
        isSelected={false}
      />
    </section>
  );
}

