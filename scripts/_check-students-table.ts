#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

(async () => {
  const sb = createSupabaseAdminClient()!;
  const { data, error, count } = await sb
    .from("students")
    .select("id, name, target_major, grade, tenant_id", { count: "exact" })
    .limit(8);
  console.log("error:", error);
  console.log("total count:", count);
  for (const r of data ?? []) {
    console.log(`${r.id} grade=${r.grade} major=${r.target_major ?? "-"} name=${r.name ?? "-"} tenant=${r.tenant_id?.slice(0, 8)}`);
  }

  const { data: target, error: e2 } = await sb
    .from("students")
    .select("*")
    .eq("id", "35ee94b6-9484-4bee-8100-c761c1c56831")
    .maybeSingle();
  console.log("\n인제고 직접 조회 error:", e2);
  console.log("인제고 row:", target ? Object.keys(target).join(",") : "null");

  const { data: byMajor } = await sb
    .from("students")
    .select("id, name, target_major, grade, tenant_id")
    .eq("target_major", "의학·약학")
    .limit(3);
  console.log("\n target_major=의학·약학 학생들:");
  for (const r of byMajor ?? []) {
    console.log(`  ${r.id} grade=${r.grade} name=${r.name ?? "-"}`);
  }
})();
