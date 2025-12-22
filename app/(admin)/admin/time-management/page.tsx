
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getTenantBlockSets } from "@/app/(admin)/actions/tenantBlockSets";
import TemplateBlockSetManagement from "./_components/TemplateBlockSetManagement";

export default async function TimeManagementPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
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

  // 모든 테넌트 블록 세트 목록 조회
  let blockSets: Array<{
    id: string;
    name: string;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }> = [];

  try {
    blockSets = await getTenantBlockSets();
  } catch (error) {
    console.error("블록 세트 조회 실패:", error);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900">시간 블록 관리</h1>
        <p className="text-sm text-gray-500">
          블록 세트를 생성하고 관리할 수 있습니다. 템플릿을 생성하지 않아도 시간 블록을 생성할 수 있습니다.
        </p>
      </div>

      <TemplateBlockSetManagement
        initialBlockSets={blockSets.map(set => ({
          ...set,
          blocks: set.blocks ? set.blocks.map(block => ({
            ...block,
            day_of_week: block.day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          })) : undefined,
        }))}
      />
    </section>
  );
}

