export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BlockSetDetail from "./_components/BlockSetDetail";

type PageProps = {
  params: Promise<{ setId: string }>;
};

export default async function BlockSetDetailPage({ params }: PageProps) {
  const { setId } = await params;
  
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 블록 세트 조회
  const { data: blockSet, error: setError } = await supabase
    .from("student_block_sets")
    .select("id, name, description, display_order")
    .eq("id", setId)
    .eq("student_id", user.id)
    .single();

  if (setError || !blockSet) {
    redirect("/blocks");
  }

  // 해당 세트의 블록 조회
  const { data: blocks, error: blocksError } = await supabase
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time")
    .eq("block_set_id", setId)
    .eq("student_id", user.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    console.error("블록 조회 실패:", blocksError);
  }

  // 활성 세트 여부 확인
  const { data: student } = await supabase
    .from("students")
    .select("active_block_set_id")
    .eq("id", user.id)
    .maybeSingle();

  const isActive = student?.active_block_set_id === setId;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <BlockSetDetail
        blockSet={blockSet}
        blocks={(blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? []}
        isActive={isActive}
      />
    </section>
  );
}

