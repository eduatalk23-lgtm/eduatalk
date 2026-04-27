#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

(async () => {
  const sb = createSupabaseAdminClient()!;

  const { data: cq } = await sb
    .from("student_record_content_quality")
    .select("record_id, record_type, grade, overall_score, issues, source, item")
    .eq("student_id", STUDENT_ID);
  console.log("== content_quality ==");
  console.log("total rows:", cq?.length);
  if (cq?.[0]) console.log("sample:", JSON.stringify(cq[0], null, 2).slice(0, 400));
  const byGrade: Record<string, number> = {};
  const sources = new Set<string>();
  for (const c of cq ?? []) {
    sources.add((c as any).source ?? "null");
    const k = `G${c.grade}/${(c as any).source ?? "null"}/${c.record_type ?? "null"}`;
    byGrade[k] = (byGrade[k] ?? 0) + 1;
  }
  console.log("source values:", [...sources]);
  console.log("distribution:", byGrade);

  // Records actually in DB
  for (const t of ["seteks", "changche", "haengteuk"]) {
    const { data } = await sb
      .from(`student_record_${t}`)
      .select("id, grade, content, imported_content, deleted_at")
      .eq("student_id", STUDENT_ID)
      .is("deleted_at", null);
    console.log(`\n${t}: ${data?.length} rows`);
    const byGr: Record<number, number> = {};
    for (const r of data ?? []) {
      const g = (r as any).grade;
      if (g != null) byGr[g] = (byGr[g] ?? 0) + 1;
    }
    console.log("  by grade:", byGr);
  }
})();
