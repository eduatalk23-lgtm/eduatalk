export const dynamic = "force-dynamic";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AcademicSourcesView } from "./_components/AcademicSourcesView";

export default async function AcademicSourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminOrConsultant();
  const params = await searchParams;

  const supabase = createSupabaseAdminClient();

  // 필터 적용
  let query = supabase
    .from("academic_sources")
    .select("*")
    .order("hit_count", { ascending: false });

  if (params.source_db) {
    query = query.eq("source_db", params.source_db);
  }
  if (params.subject) {
    query = query.contains("subject_areas", [params.subject]);
  }
  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,keywords.cs.{${params.q}}`);
  }
  if (params.valid === "false") {
    query = query.eq("is_valid", false);
  }

  const { data: sources } = await query;

  // 통계 (별도 쿼리 — 필터 무관 전체 통계)
  const { data: stats } = await createSupabaseAdminClient()
    .from("academic_sources")
    .select("source_db, is_valid, embedding_status")
    .then(({ data }) => {
      if (!data) return { data: null };
      return {
        data: {
          total: data.length,
          valid: data.filter((s) => s.is_valid).length,
          embedded: data.filter((s) => s.embedding_status === "completed").length,
          byDb: Object.entries(
            data.reduce(
              (acc, s) => {
                acc[s.source_db] = (acc[s.source_db] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          ),
        },
      };
    });

  return (
    <AcademicSourcesView
      sources={sources ?? []}
      stats={stats}
      currentFilter={{
        source_db: params.source_db,
        subject: params.subject,
        q: params.q,
        valid: params.valid,
      }}
    />
  );
}
