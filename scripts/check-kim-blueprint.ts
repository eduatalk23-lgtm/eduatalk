import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

async function main() {
  const sb = createSupabaseAdminClient()!;

  // student
  const { data: student, error: se } = await sb
    .from("students")
    .select("id, grade, desired_career_field, target_major, school_name")
    .eq("id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();
  console.log("student:", student, "error:", se);

  // all main_explorations
  const { data: mes } = await sb
    .from("student_main_explorations")
    .select("grade, semester, scope, direction, is_active, theme_label")
    .eq("student_id", STUDENT_ID);
  console.log("\nall main_explorations:");
  console.table(mes);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
