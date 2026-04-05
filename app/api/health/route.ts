import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {};
  let overallStatus: "ok" | "degraded" | "error" = "ok";

  // 1. Database connectivity
  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      checks.database = false;
      overallStatus = "error";
    } else {
      const { error } = await supabase.from("tenants").select("id").limit(1);
      checks.database = !error;
      if (error) overallStatus = "degraded";
    }
  } catch {
    checks.database = false;
    overallStatus = "error";
  }

  // 2. Required environment variables
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  checks.environment = missingEnvVars.length === 0;
  if (!checks.environment) overallStatus = "error";

  // 3. Optional services
  checks.cronSecret = !!process.env.CRON_SECRET;
  if (!checks.cronSecret && overallStatus === "ok") overallStatus = "degraded";

  const httpStatus = overallStatus === "error" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      database: checks.database ?? false,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: httpStatus },
  );
}
