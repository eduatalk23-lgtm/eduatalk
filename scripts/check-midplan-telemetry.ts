#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

async function main() {
  const sb = createSupabaseAdminClient()!;

  const { data: pipelines, error } = await sb
    .from("student_record_analysis_pipelines")
    .select("*")
    .eq("student_id", STUDENT_ID)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("query error:", error);
    return;
  }
  if (!pipelines?.length) {
    console.log("no pipelines at all");
    return;
  }
  console.log(`found ${pipelines.length} pipelines`);
  for (const p of pipelines) {
    console.log(`\n=== ${p.id?.slice(0, 8)} / type=${p.pipeline_type} / status=${p.status} / created=${p.created_at} ===`);
    console.log("all columns:", Object.keys(p).join(", "));
    const tr = (p.task_results ?? {}) as Record<string, unknown>;
    const keys = Object.keys(tr);
    console.log("task_results keys:", keys.slice(0, 20).join(", "));
    // midPlan 검색
    const midPlanHits: string[] = [];
    function walk(obj: unknown, path: string) {
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const p2 = path ? `${path}.${k}` : k;
        if (k === "midPlan" || k.toLowerCase().includes("midplan")) {
          midPlanHits.push(`${p2} = ${JSON.stringify(v).slice(0, 500)}`);
        }
        if (v && typeof v === "object") walk(v, p2);
      }
    }
    walk(tr, "");
    if (midPlanHits.length > 0) {
      console.log("midPlan hits:");
      for (const h of midPlanHits) console.log(" ", h);
    } else {
      console.log("(no midPlan)");
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
